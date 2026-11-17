# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Access to a county's parcel service, shared by the 'parcels' layer and the
parcel checks, so that both send exactly the same field list.

Rules this module enforces (docs/DECISIONS.md D25, D27):

- The field list sent to the service is the county's 'outFields' from
  pipeline/layers/parcels-services.json and nothing else. Field names that
  look like an address, phone, tax or legal description are refused.
- A response with any other attribute is refused before anything is written.
- One request at a time, at least PAUSE_S seconds apart, generic User-Agent
  (mapdata.http), retries with backoff.
- Every request URL is appended to data/logs/parcels/requests-<county>.log.
"""

import datetime
import json
import os
import re
import time
import urllib.parse

import mapdata as md

CONFIG = os.path.join(md.PIPELINE, "layers", "parcels-services.json")
LOG_DIR = os.path.join(md.REPO, "data", "logs", "parcels")
PAUSE_S = 1.0

# Field names that must never be requested from a parcel service.
FORBIDDEN_FIELD = re.compile(r"(?i)addr|mail|phone|tel|site|street|city|zip|tax|legal|descr|ssn|email")


def load_config(county_id):
    cfg = md.read_json(CONFIG)
    entry = cfg.get(county_id)
    if not isinstance(entry, dict):
        raise md.PipelineError(f"no parcel service is configured for {county_id} in {os.path.relpath(CONFIG, md.REPO)}")
    if entry.get("status") != "approved":
        raise md.PipelineError(f"parcels for {county_id} are {entry.get('status')}: {entry.get('reason', 'no reason given')}")
    for key in ("source", "service", "outFields", "pid", "owner", "pageSize"):
        if not entry.get(key):
            raise md.PipelineError(f"parcel service entry {county_id} has no '{key}'")
    fields = entry["outFields"]
    bad = [f for f in fields if FORBIDDEN_FIELD.search(f)]
    if bad:
        raise md.PipelineError(f"parcel service entry {county_id} asks for forbidden fields {bad}")
    for role in ("pid", "owner", "acres"):
        if entry.get(role) and entry[role] not in fields:
            raise md.PipelineError(f"parcel service entry {county_id}: {role} field '{entry[role]}' is not in outFields")
    return entry


class ParcelService:
    def __init__(self, county_id, purpose):
        self.county_id = county_id
        self.cfg = load_config(county_id)
        self.url = self.cfg["service"]
        self.out_fields = ",".join(self.cfg["outFields"])
        self.purpose = purpose
        self.log_path = os.path.join(LOG_DIR, f"requests-{county_id}.log")
        self.requests = 0
        self._last = 0.0
        self.oid_field = None

    # -------------------------------------------------------------- requests

    def _get(self, path, params, note=""):
        """GET url+path?params, logged, paced, and retried on ArcGIS errors."""
        url = self.url + path + "?" + urllib.parse.urlencode(params)
        for attempt in range(1, 6):
            wait = PAUSE_S - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            self.requests += 1
            status = "ok"
            try:
                body = md.http(url)
                res = json.loads(body)
            except md.PipelineError as e:
                self._log(url, f"failed: {e}")
                raise
            err = res.get("error") if isinstance(res, dict) else None
            if err:
                status = f"service error {err.get('code')}: {err.get('message')}"
            self._log(url, status if err else f"ok {len(body)} bytes{note}")
            if not err:
                self._last = time.monotonic()
                return res
            if attempt == 5:
                raise md.PipelineError(f"service error from {self.url}: {err}")
            backoff = 65 if err.get("code") == 429 else 10 * attempt
            md.log(f"  service said: {err.get('message')}. Retrying in {backoff} s")
            time.sleep(backoff)

    def _log(self, url, status):
        os.makedirs(LOG_DIR, exist_ok=True)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(f"{stamp}\t{self.purpose}\tGET\t{url}\t{status}\n")

    # -------------------------------------------------------------- service calls

    def layer_info(self):
        info = self._get("", {"f": "json"})
        names = {f["name"] for f in info.get("fields", [])}
        missing = [f for f in self.cfg["outFields"] if f not in names]
        if missing:
            raise md.PipelineError(f"the service has no fields {missing}. Its layout changed; check the config.")
        self.oid_field = info.get("objectIdField")
        if not self.oid_field:
            raise md.PipelineError("the service names no object id field")
        return info

    def object_ids(self):
        res = self._get("/query", {"where": "1=1", "returnIdsOnly": "true", "f": "json"})
        self.oid_field = res.get("objectIdFieldName") or self.oid_field
        return sorted(res.get("objectIds") or [])

    def count(self):
        return int(self._get("/query", {"where": "1=1", "returnCountOnly": "true", "f": "json"})["count"])

    def _features(self, where, extra_note=""):
        params = {"where": where, "outFields": self.out_fields, "returnGeometry": "true",
                  "outSR": "4326", "returnZ": "false", "returnM": "false", "f": "geojson"}
        res = self._get("/query", params, extra_note)
        if res.get("exceededTransferLimit") or (res.get("properties") or {}).get("exceededTransferLimit"):
            raise md.PipelineError(f"the service cut a response short ({where}). Lower pageSize.")
        return self.clean(res.get("features") or [])

    def page(self, lo, hi):
        """Features with lo <= object id <= hi."""
        if not self.oid_field:
            raise md.PipelineError("call layer_info() first")
        return self._features(f"{self.oid_field} >= {int(lo)} AND {self.oid_field} <= {int(hi)}")

    def by_pid(self, pid):
        value = str(pid).replace("'", "''")
        return self._features(f"{self.cfg['pid']} = '{value}'")

    # -------------------------------------------------------------- records

    def clean(self, features):
        """Keep only the requested attributes. Refuse anything else."""
        allowed = set(self.cfg["outFields"])
        out = []
        for f in features:
            props = dict(f.get("properties") or {})
            fid = f.get("id")
            if self.oid_field and self.oid_field in props:
                fid = props.pop(self.oid_field) if fid is None else fid
                props.pop(self.oid_field, None)
            extra = set(props) - allowed
            if extra:
                raise md.PipelineError(f"the service returned fields that were not requested: {sorted(extra)}. Nothing was written.")
            out.append({"type": "Feature", "id": fid, "properties": props, "geometry": f.get("geometry")})
        return out

    def tile_properties(self, props):
        """The four tile properties of D27 from one service record."""
        pid = props.get(self.cfg["pid"])
        owner = props.get(self.cfg["owner"])
        out = {"pid": "" if pid is None else str(pid),
               "owner": "" if owner is None else str(owner)}
        # No parcel has a true area of 0. A county that writes 0 (or less)
        # has no acreage for that parcel, so 'acres' is left out (D27).
        acres_field = self.cfg.get("acres")
        if acres_field and props.get(acres_field) is not None and float(props[acres_field]) > 0:
            out["acres"] = float(props[acres_field])
        out["county"] = self.county_id
        return out
