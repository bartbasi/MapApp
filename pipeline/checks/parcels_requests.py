# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Summarise the parcel request logs for the evidence folder.

    python3 -I pipeline/checks/parcels_requests.py [--out file.md]

Reads data/logs/parcels/requests-<county-id>.log (tab separated: time,
purpose, method, URL, result) and prints, per county: each host, the number
of requests by purpose, the exact outFields values sent, and the dates. The
logs hold URLs only, never a response, so no owner name can appear here.
"""

import argparse
import collections
import glob
import os
import sys
import urllib.parse

PIPELINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(PIPELINE)
LOG_DIR = os.path.join(REPO, "data", "logs", "parcels")


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    lines = ["# Parcel service requests", "",
             "Made by `pipeline/checks/parcels_requests.py` from the request logs in `data/logs/parcels/` (not in git). "
             "Every request the pipeline and the parcel checks made is in those logs.", ""]
    for path in sorted(glob.glob(os.path.join(LOG_DIR, "requests-*.log"))):
        county = os.path.basename(path)[len("requests-"):-len(".log")]
        rows = []
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 5:
                    rows.append(parts)
        lines += [f"## {county}", "", "| Host | Purpose | Requests | Dates (UTC) | `outFields` sent | Results |",
                  "|---|---|---|---|---|---|"]
        groups = collections.OrderedDict()
        for t, purpose, method, url, *result in rows:
            u = urllib.parse.urlsplit(url)
            key = (u.netloc, purpose)
            g = groups.setdefault(key, {"n": 0, "dates": set(), "fields": collections.Counter(), "results": collections.Counter()})
            g["n"] += 1
            g["dates"].add(t[:10])
            q = urllib.parse.parse_qs(u.query)
            g["fields"][q.get("outFields", ["(none)"])[0]] += 1
            r = (result[0] if result else "").split(" ")[0]
            g["results"][r] += 1
        for (host, purpose), g in groups.items():
            fields = "; ".join(f"`{k}` ({v})" for k, v in g["fields"].items())
            results = ", ".join(f"{k} {v}" for k, v in g["results"].items())
            lines.append(f"| {host} | {purpose} | {g['n']} | {', '.join(sorted(g['dates']))} | {fields} | {results} |")
        lines += ["", f"{len(rows)} requests in all."]
        if any(g_key[1] == "discovery" for g_key in groups):
            lines += ["", "Discovery requests looked for a parcel service that can be read without a login. The "
                      "Results column shows the HTTP status. ArcGIS reports 'Token Required' (error 499) inside an "
                      "HTTP 200 answer, so each address and what came back is listed in "
                      "`docs/research/county-parcel-terms.md`."]
        lines.append("")
    text = "\n".join(lines)
    print(text)
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
