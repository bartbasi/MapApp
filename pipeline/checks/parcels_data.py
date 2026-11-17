# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Look for things in a county's parcel data that the app's position readout
must cope with. Reads the cached download only; makes no request.

    python3 -I pipeline/checks/parcels_data.py <county-id> [--out file.md]

Reports counts and parcel IDs only, never an owner name: records with no
outline, invalid outlines, multipart parcels, parcels with holes, empty or
repeated parcel IDs, empty owners, missing acreage, acreage against the drawn
area, parcels outside the county outline, overlapping parcels, very small
parcels, and records whose owner text marks a road or railroad right of way.
Runs in WSL (needs the GDAL Python bindings).
"""

import argparse
import collections
import json
import os
import re
import statistics
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
import mapdata as md  # noqa: E402
import parcelsvc  # noqa: E402

ACRE_M2 = 4046.8564224
OVERLAP_M2 = 1.0
CELL_DEG = 0.01
# Owner text that marks a right of way. Matched, counted, never printed.
ROW_TEXT = re.compile(r"(?i)\bR\.?\s?O\.?\s?W\b|RIGHT[\s-]*OF[\s-]*WAY|\bR/W\b|RAILROAD|RAILWAY|\bRR\b|HIGHWAY")

gdal, ogr, osr = md.gdal_modules()


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("county")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    county = md.get_county(args.county)
    cfg = parcelsvc.load_config(args.county)
    d = os.path.join(md.CACHE, "parcels", args.county)
    manifest = md.read_json(os.path.join(d, "manifest.json"))
    feats = []
    for p in manifest["pages"]:
        feats.extend(md.read_json(os.path.join(d, p["file"]))["features"])

    outline = md.outline_geometry(county)
    c = outline.Centroid()
    local = osr.SpatialReference()
    local.ImportFromProj4(f"+proj=aeqd +lat_0={c.GetY()} +lon_0={c.GetX()} +datum=WGS84 +units=m +no_defs")
    to_m = osr.CoordinateTransformation(md.wgs84(), local)
    county_m = outline.Clone()
    county_m.Transform(to_m)

    pid_f, own_f, ac_f = cfg["pid"], cfg["owner"], cfg.get("acres")
    recs = []
    n = collections.Counter()
    pid_count = collections.Counter()
    ratios = []
    examples = collections.defaultdict(list)

    def note(key, pid, limit=10):
        n[key] += 1
        if len(examples[key]) < limit:
            examples[key].append(pid if pid.strip() else f"`{pid!r}`")

    gdal.PushErrorHandler("CPLQuietErrorHandler")
    for f in feats:
        p = f["properties"]
        pid = p.get(pid_f) or ""
        pid_count[pid] += 1
        if not pid.strip():
            note("parcel ID empty or only spaces", pid, limit=1)
        if not (p.get(own_f) or "").strip():
            note("empty owner", pid)
        elif ROW_TEXT.search(p.get(own_f)):
            note("owner text names a road, highway or railroad body", pid)
        if ac_f and p.get(ac_f) is None:
            note("no acreage", pid)
        elif ac_f and p.get(ac_f) == 0:
            note("acreage 0", pid)
        if "PIN" in p and pid_f != "PIN":
            pin = p.get("PIN") or ""
            if not pin:
                note("PIN empty", pid)
            elif re.sub(r"\D", "", pid) == re.sub(r"\D", "", pin):
                n["PIN equals the parcel ID without punctuation"] += 1
            else:
                note("PIN differs from the parcel ID", pid)
        g = f.get("geometry")
        if not g or not g.get("coordinates"):
            note("no outline", pid)
            continue
        geom = ogr.CreateGeometryFromJson(json.dumps(g))
        geom.FlattenTo2D()
        if geom.GetGeometryType() == ogr.wkbMultiPolygon and geom.GetGeometryCount() > 1:
            note("multipart (more than one polygon)", pid)
        polys = [geom] if geom.GetGeometryType() == ogr.wkbPolygon else [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())]
        if any(pg.GetGeometryCount() > 1 for pg in polys):
            note("has a hole", pid)
        if not geom.IsValid():
            note("invalid outline (self-crossing or similar)", pid)
            geom = geom.MakeValid()
        gm = geom.Clone()
        gm.Transform(to_m)
        area = gm.Area()
        if area < 10:
            note("smaller than 10 square meters", pid)
        elif area < 100:
            note("10 to 100 square meters", pid)
        if not gm.Centroid().Within(county_m):
            note("centre outside the county outline", pid)
        if ac_f and p.get(ac_f):
            ratios.append(area / ACRE_M2 / p[ac_f])
        recs.append((pid, gm))
    gdal.PopErrorHandler()

    for pid, k in pid_count.items():
        if pid.strip() and k > 1:
            n["parcel IDs on more than one record"] += 1
            n["records sharing a parcel ID"] += k
            if len(examples["parcel IDs on more than one record"]) < 10:
                examples["parcel IDs on more than one record"].append(f"{pid} ({k})")

    # Overlaps: pairs whose shared area is over OVERLAP_M2.
    grid = collections.defaultdict(list)
    cell = CELL_DEG * 111000
    envs = []
    for i, (pid, gm) in enumerate(recs):
        e = gm.GetEnvelope()
        envs.append(e)
        for gx in range(int(e[0] // cell), int(e[1] // cell) + 1):
            for gy in range(int(e[2] // cell), int(e[3] // cell) + 1):
                grid[(gx, gy)].append(i)
    seen = set()
    overlaps = []
    gdal.PushErrorHandler("CPLQuietErrorHandler")
    for members in grid.values():
        for ai in range(len(members)):
            i = members[ai]
            ei = envs[i]
            for j in members[ai + 1:]:
                ej = envs[j]
                if ei[1] <= ej[0] or ej[1] <= ei[0] or ei[3] <= ej[2] or ej[3] <= ei[2]:
                    continue
                if (i, j) in seen:
                    continue
                seen.add((i, j))
                gi, gj = recs[i][1], recs[j][1]
                if not gi.Intersects(gj):
                    continue
                try:
                    a = gi.Intersection(gj).Area()
                except Exception:
                    continue
                if a > OVERLAP_M2:
                    overlaps.append((a, i, j))
    gdal.PopErrorHandler()
    overlaps.sort(reverse=True)
    total_area = sum(gm.Area() for _, gm in recs)

    # Sort the overlaps: the same outline drawn twice or more ("stacked"),
    # one parcel lying inside a larger one, and partial overlaps.
    areas = [gm.Area() for _, gm in recs]
    same, inside, partial = [], [], []
    for a, i, j in overlaps:
        small, big = sorted((areas[i], areas[j]))
        if a >= 0.99 * big:
            same.append((a, i, j))
        elif a >= 0.99 * small:
            inside.append((a, i, j))
        else:
            partial.append((a, i, j))
    parent = list(range(len(recs)))

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k
    for _, i, j in same:
        parent[find(i)] = find(j)
    stacks = collections.Counter(find(k) for k in {k for _, i, j in same for k in (i, j)})
    stack_sizes = sorted(stacks.values(), reverse=True)
    biggest = stacks.most_common(1)[0][0] if stacks else None
    biggest_pids = sorted(recs[k][0] for k in range(len(recs)) if biggest is not None and find(k) == biggest)

    def recs_in(pairs):
        return len({k for _, i, j in pairs for k in (i, j)})

    lines = [f"# Parcel data notes: {args.county}", "",
             f"From the cached download of {manifest['fetched']} ({manifest['count']} records, data last edited "
             f"{manifest['dataDate']}). Counts and parcel IDs only. Made by `pipeline/checks/parcels_data.py`.", "",
             "| What | Records | Examples (parcel IDs) |", "|---|---|---|"]
    order = ["no outline", "invalid outline (self-crossing or similar)", "multipart (more than one polygon)", "has a hole",
             "parcel ID empty or only spaces", "parcel IDs on more than one record", "records sharing a parcel ID", "empty owner",
             "owner text names a road, highway or railroad body", "no acreage", "acreage 0", "smaller than 10 square meters",
             "10 to 100 square meters", "centre outside the county outline",
             "PIN equals the parcel ID without punctuation", "PIN differs from the parcel ID", "PIN empty"]
    for k in order:
        if k in n or k in ("no outline", "empty owner", "multipart (more than one polygon)",
                           "parcel ID empty or only spaces", "centre outside the county outline"):
            lines.append(f"| {k} | {n.get(k, 0)} | {', '.join(examples.get(k, []))} |")
    lines += ["",
              "## Overlapping parcels",
              "",
              f"Pairs of records whose outlines share more than {OVERLAP_M2} square meter: {len(overlaps)}.",
              "",
              f"- Same outline drawn more than once (shared area at least 99 percent of both): {len(same)} pairs, "
              f"{recs_in(same)} records, in {len(stack_sizes)} stacks. Largest stacks: {stack_sizes[:10]} records. "
              f"The largest stack holds parcel IDs {', '.join(biggest_pids[:5])}{' and others' if len(biggest_pids) > 5 else ''}.",
              f"- One parcel lying inside a larger one (at least 99 percent of the smaller): {len(inside)} pairs, {recs_in(inside)} records.",
              f"- Partial overlaps: {len(partial)} pairs, {recs_in(partial)} records. Shared area per pair: "
              f"{sum(1 for a, _, _ in partial if a > 100)} over 100 square meters, {sum(1 for a, _, _ in partial if a > 1000)} over 1,000.",
              ]
    for label, pairs in (("same outline", same), ("inside", inside), ("partial", partial)):
        for a, i, j in pairs[:5]:
            p1, p2 = (p if p.strip() else f"`{p!r}`" for p in (recs[i][0], recs[j][0]))
            lines.append(f"  - {label}: {p1} and {p2}, {a:.0f} square meters")
    lines += [""]
    if ratios:
        r = sorted(ratios)
        off10 = sum(1 for x in r if abs(x - 1) > 0.10)
        off50 = sum(1 for x in r if abs(x - 1) > 0.50)
        lines += [f"- Drawn area against the county's acreage: median ratio {statistics.median(r):.3f}; "
                  f"{off10} records differ by more than 10 percent, {off50} by more than 50 percent."]
    lines += [f"- Sum of parcel areas: {total_area / 1e6:.1f} square km. County outline: {county_m.Area() / 1e6:.1f} square km "
              f"({100 * total_area / county_m.Area():.1f} percent). The rest is mostly road and water that the county does not draw as parcels."]
    text = "\n".join(lines) + "\n"
    print(text, end="")
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except md.PipelineError as e:
        md.log(f"error: {e}")
        sys.exit(1)
