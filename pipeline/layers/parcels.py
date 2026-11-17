# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Layer 'parcels': property lines with parcel ID, owner name and acreage,
zoom 13 to 16, from the county's own parcel service (docs/DECISIONS.md D25,
D27).

Where each county's parcels come from is in parcels-services.json. A county
whose entry is not 'approved' stops here with the reason.

Every tile property is one of pid, owner, acres, county. Zoom 16 holds every
parcel at full detail: no simplification, no dropping, no tiny polygon
reduction. Zooms 13 to 15 are simplified but nothing is dropped.

The raw service pages are cached in data/cache/parcels/<county-id>/ so a
rebuild does not ask the service again (REFRESH=1 downloads again). Every
request is logged to data/logs/parcels/requests-<county-id>.log.

The metadata carries the county outline as 'coverage', so the app can tell
a place with no parcel inside the county from a place outside it.

Usage: python3 -I pipeline/layers/parcels.py <county-id>   (normally via build.sh)
       python3 -I pipeline/layers/parcels.py --update-meta <county-id>
           Rewrites the metadata of an existing archive (notes, source entry,
           coverage) from local files only. No request, archive unchanged.
"""

import datetime
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

sys.dont_write_bytecode = True   # keep __pycache__ out of the repository
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
import mapdata as md  # noqa: E402
import parcelsvc  # noqa: E402
import vtiles  # noqa: E402

LAYER = "parcels"
log = md.log


# ------------------------------------------------------------------ download

def cache_dir(county_id):
    return os.path.join(md.CACHE, "parcels", county_id)


def fetch(county_id):
    """All parcels of the county as a list of GeoJSON features (only the
    configured fields), plus the manifest describing the download."""
    d = cache_dir(county_id)
    manifest_path = os.path.join(d, "manifest.json")
    if md.cached(manifest_path):
        manifest = md.read_json(manifest_path)
        feats = []
        for p in manifest["pages"]:
            feats.extend(md.read_json(os.path.join(d, p["file"]))["features"])
        if len(feats) != manifest["count"]:
            raise md.PipelineError(f"the cache in {d} holds {len(feats)} parcels, its manifest says {manifest['count']}. Rerun with REFRESH=1.")
        log(f"Reusing the cached download in {d}: {len(feats)} parcels in {len(manifest['pages'])} pages, "
            f"fetched {manifest['fetched']}. No request is made. REFRESH=1 downloads again.")
        return feats, manifest

    svc = parcelsvc.ParcelService(county_id, "build")
    cfg = svc.cfg
    os.makedirs(d, exist_ok=True)
    log(f"Reading the parcel service {svc.url}")
    log(f"  fields requested: {svc.out_fields}")
    info = svc.layer_info()
    md.atomic_write_json(os.path.join(d, "layer.json"), info)
    edited = (info.get("editingInfo") or {}).get("dataLastEditDate")
    data_date = (datetime.datetime.fromtimestamp(edited / 1000, datetime.timezone.utc).date().isoformat()
                 if edited else None)
    if not data_date:
        raise md.PipelineError("the service gives no last edit date, so the archive would have no data date")

    ids_path = os.path.join(d, "ids.json")
    if os.path.exists(ids_path) and os.environ.get("REFRESH") != "1":
        ids_doc = md.read_json(ids_path)
        if ids_doc.get("service") != svc.url or ids_doc.get("dataLastEditDate") != edited:
            ids_doc = None
    else:
        ids_doc = None
    if ids_doc:
        log(f"  resuming the download started {ids_doc['run']}")
    else:
        ids = svc.object_ids()
        ids_doc = {"service": svc.url, "dataLastEditDate": edited, "oidField": svc.oid_field,
                   "run": datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
                   "ids": ids}
        md.atomic_write_json(ids_path, ids_doc)
    svc.oid_field = ids_doc["oidField"]
    ids = ids_doc["ids"]
    count = svc.count()
    if count != len(ids):
        raise md.PipelineError(f"the service counts {count} parcels but lists {len(ids)} ids")
    log(f"  {count} parcels, data last edited {data_date}")

    size = int(cfg["pageSize"])
    max_rec = int(info.get("maxRecordCount") or size)
    size = min(size, max_rec)
    chunks = [ids[i:i + size] for i in range(0, len(ids), size)]
    pages, feats = [], []
    for n, chunk in enumerate(chunks, 1):
        lo, hi = chunk[0], chunk[-1]
        name = f"page-{n:04d}-{lo}-{hi}.geojson"
        path = os.path.join(d, name)
        doc = md.read_json(path) if os.path.exists(path) else None
        if doc is None or doc.get("run") != ids_doc["run"]:
            # The service returns no object id unless it is requested, and
            # only the configured fields are requested. A page is a closed
            # range of the service's own id list, so its count must match.
            got = svc.page(lo, hi)
            if len(got) != len(chunk):
                raise md.PipelineError(f"page {n} ({svc.oid_field} {lo} to {hi}) returned {len(got)} parcels, "
                                       f"expected {len(chunk)}. The service changed during the download; rerun with REFRESH=1.")
            doc = {"type": "FeatureCollection", "run": ids_doc["run"], "features": got}
            md.atomic_write_json(path, doc)
            log(f"  page {n} of {len(chunks)}: {len(got)} parcels, {os.path.getsize(path)} bytes")
        pages.append({"file": name, "first": lo, "last": hi, "count": len(doc["features"])})
        feats.extend(doc["features"])
    keep = {p["file"] for p in pages} | {"manifest.json", "layer.json", "ids.json"}
    for f in os.listdir(d):
        if f.startswith("page-") and f not in keep:
            os.remove(os.path.join(d, f))

    manifest = {
        "service": svc.url, "layerName": info.get("name"), "outFields": svc.out_fields,
        "oidField": svc.oid_field, "count": count, "dataLastEditDate": edited, "dataDate": data_date,
        "fetched": datetime.date.today().isoformat(), "requests": svc.requests,
        "spatialReference": (info.get("extent") or {}).get("spatialReference"),
        "copyrightText": info.get("copyrightText") or "", "pages": pages,
    }
    md.atomic_write_json(manifest_path, manifest)
    total = sum(os.path.getsize(os.path.join(d, p["file"])) for p in pages)
    log(f"Downloaded {count} parcels in {len(pages)} pages, {total} bytes, with {svc.requests} requests "
        f"(log: {os.path.relpath(svc.log_path, md.REPO)})")
    return feats, manifest


# ------------------------------------------------------------------ build

def flat2d(coords):
    """Drop any third coordinate, keep full precision."""
    if coords and isinstance(coords[0], (int, float)):
        return coords[:2]
    return [flat2d(c) for c in coords]


def build(county_id):
    county = md.get_county(county_id)
    spec = md.LAYERS[LAYER]
    svc_cfg = parcelsvc.load_config(county_id)   # stops here for a blocked county
    out_dir = os.environ.get("OUT_DIR") or os.path.join(md.BUILD, county_id)
    os.makedirs(out_dir, exist_ok=True)
    outline_path, outline_prov = md.county_outline(county)

    feats, manifest = fetch(county_id)
    shaper = parcelsvc.ParcelService(county_id, "build")

    work = tempfile.mkdtemp(prefix="parcels-")
    try:
        src = os.path.join(work, "parcels.geojsonl")
        written = no_geom = 0
        pids = set()
        with open(src, "w", encoding="utf-8") as fh:
            # The tile feature id is the record's number in this build (in
            # the service's object id order). It lets the pieces of one record
            # cut by tile edges be joined. It is not stable across builds.
            for n, f in enumerate(feats, 1):
                g = f.get("geometry")
                if not g or not g.get("coordinates") or g.get("type") not in ("Polygon", "MultiPolygon"):
                    no_geom += 1
                    continue
                props = shaper.tile_properties(f["properties"])
                pids.add(props["pid"])
                out = {"type": "Feature", "id": n, "properties": props,
                       "geometry": {"type": g["type"], "coordinates": flat2d(g["coordinates"])}}
                fh.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
                written += 1
        log(f"Parcels for tiling: {written} features, {len(pids)} distinct parcel IDs, "
            f"{no_geom} records with no outline left out")

        sources = [md.source_entry(svc_cfg["source"], manifest["dataDate"])]
        attribution = sources[0]["credit"]
        full = os.path.join(work, "full.pmtiles")
        cmd = ["tippecanoe", "-o", full, "--force", "-q", "-t", work,
               "-l", LAYER, "-n", spec["title"], "-A", attribution,
               f"-Z{spec['minzoom']}", f"-z{spec['maxzoom']}",
               "--full-detail=12", "--low-detail=12",
               "--no-feature-limit", "--no-tile-size-limit",
               "--no-tiny-polygon-reduction",
               "--simplify-only-low-zooms",
               "--detect-shared-borders",
               # No sample values in the archive's JSON metadata: they would
               # repeat owner names where tools print them.
               "--no-tile-stats",
               "-P", src]
        md.wait_for_quiet_machine("tiling the parcels")
        timer = ["/usr/bin/time", "-f", "tippecanoe: %e s, peak memory %M KB"] if os.path.exists("/usr/bin/time") else []
        log("Running tippecanoe " + " ".join(a for a in cmd[13:] if a != src) + " <parcels>")
        t0 = time.time()
        subprocess.run(timer + cmd, check=True)
        log(f"  tiled in {time.time() - t0:.0f} s")

        # The archive's own bounds must cover the county outline's box (the
        # metadata 'bounds'), even where the parcels stop short of it.
        hdr = md.pmtiles_header(full)
        ob = md.outline_bounds(county)
        hb = hdr["bounds"]
        nb = [min(hb[0], ob[0]), min(hb[1], ob[1]), max(hb[2], ob[2]), max(hb[3], ob[3])]
        if nb != hb:
            hdr["bounds"] = nb
            hpath = os.path.join(work, "header.json")
            with open(hpath, "w") as fh:
                json.dump(hdr, fh)
            subprocess.run([md.PMTILES, "edit", full, f"--header-json={hpath}", "-q"], check=True)
            log(f"  archive bounds widened from the parcels' extent {hb} to cover the county outline box {ob}")

        tmp_out = os.path.join(out_dir, f".{LAYER}.pmtiles.tmp-{os.getpid()}")
        shutil.copyfile(full, tmp_out)
        final = os.path.join(out_dir, f"{LAYER}.pmtiles")
        os.replace(tmp_out, final)
    finally:
        shutil.rmtree(work, ignore_errors=True)

    # Counts per zoom, from the archive itself.
    per_zoom = {}
    with vtiles.Archive(final) as a:
        for z, x, y, off, length in a.entries():
            s = per_zoom.setdefault(z, {"tiles": 0, "bytes": 0, "largest": 0, "largestTile": None})
            s["tiles"] += 1
            s["bytes"] += length
            if length > s["largest"]:
                s["largest"], s["largestTile"] = length, f"{z}/{x}/{y}"
    log(f"Wrote {final} ({os.path.getsize(final)} bytes)")
    for z in sorted(per_zoom):
        s = per_zoom[z]
        log(f"  zoom {z}: {s['tiles']} tiles, {s['bytes']} bytes, largest {s['largest']} bytes (gzip) at {s['largestTile']}")
    log("\n".join(subprocess.run([md.PMTILES, "show", final], capture_output=True, text=True).stdout.splitlines()[:13]))

    prov = {
        "service": manifest["service"], "layerName": manifest["layerName"], "outFields": manifest["outFields"],
        "pidField": svc_cfg["pid"], "pidReason": svc_cfg.get("pidReason", ""),
        "serviceCount": manifest["count"], "features": written, "distinctPids": len(pids),
        "noOutline": no_geom, "fetched": manifest["fetched"], "requests": manifest["requests"],
        "serviceSpatialReference": manifest["spatialReference"],
        "tiles": {str(z): {"tiles": s["tiles"], "largestBytes": s["largest"]} for z, s in sorted(per_zoom.items())},
        "countyOutline": outline_prov,
        "buildNotes": BUILD_NOTES,
    }
    meta = md.make_meta(LAYER, county, final, sources, user_notes(county), provenance=prov,
                        coverage=md.coverage_geometry(county))
    md.write_meta(os.path.join(out_dir, f"{LAYER}.meta.json"), meta, final)
    log(f"Wrote {os.path.join(out_dir, LAYER + '.meta.json')}")


# ------------------------------------------------------------------ metadata text

def user_notes(county):
    """The 'notes' the app shows on its sources screen. Written for a user:
    where the lines come from and what they are not. Nothing about the build."""
    return (f"Property lines and owner names from the tax assessment records of {md.county_label(county)}, "
            "as of the data date above. They are not a legal survey. A line can sit several meters off the "
            "true property line.")


# Notes for the people who build and check the archive. Kept in 'provenance',
# which the app does not show.
BUILD_NOTES = ("Each tile holds only this county's parcels. Edges where a parcel is cut at a tile boundary are not "
               "property lines. Not to be published on any public host until the project owner says so (D25).")


def update_meta(county_id):
    """Brings an existing parcel metadata file up to date without rebuilding
    the archive and without any request: the user notes, the source entry
    from sources.json (same data date), the build notes, and the 'coverage'
    outline from the cached county outline. The archive is not touched."""
    county = md.get_county(county_id)
    svc_cfg = parcelsvc.load_config(county_id)
    out_dir = os.environ.get("OUT_DIR") or os.path.join(md.BUILD, county_id)
    final = os.path.join(out_dir, f"{LAYER}.pmtiles")
    meta_path = os.path.join(out_dir, f"{LAYER}.meta.json")
    if not (os.path.exists(final) and os.path.exists(meta_path)):
        raise md.PipelineError(f"no parcel archive and metadata in {out_dir} to update")
    meta = md.read_json(meta_path)
    old = meta["sources"][0]
    meta["sources"] = [md.source_entry(svc_cfg["source"], old["dataDate"])]
    meta["notes"] = user_notes(county)
    meta["coverage"] = md.coverage_geometry(county)
    prov = meta.setdefault("provenance", {})
    prov["buildNotes"] = BUILD_NOTES
    prov["metaUpdated"] = datetime.date.today().isoformat()
    # The members in the contract's order, with provenance last.
    order = ["schema", "layer", "county", "countyName", "kind", "title", "minzoom", "maxzoom", "bounds", "bytes",
             "buildDate", "sources", "notes", "coverage", "provenance"]
    meta = {k: meta[k] for k in order if k in meta} | {k: v for k, v in meta.items() if k not in order}
    md.write_meta(meta_path, meta, final)
    rings = meta["coverage"]["coordinates"] if meta["coverage"]["type"] == "MultiPolygon" else [meta["coverage"]["coordinates"]]
    points = sum(len(r) for poly in rings for r in poly)
    log(f"Updated {meta_path}: notes, source entry, coverage ({meta['coverage']['type']}, {points} points). "
        "The archive is unchanged and no request was made.")


USAGE = ("usage: python3 -I pipeline/layers/parcels.py <county-id>\n"
         "       python3 -I pipeline/layers/parcels.py --update-meta <county-id>   (no request, archive unchanged)")


if __name__ == "__main__":
    args = sys.argv[1:]
    try:
        if len(args) == 2 and args[0] == "--update-meta":
            update_meta(args[1])
        elif len(args) == 1 and not args[0].startswith("-"):
            build(args[0])
        else:
            log(USAGE)
            sys.exit(2)
    except md.PipelineError as e:
        log(f"error: {e}")
        sys.exit(1)
