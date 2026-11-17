# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Compare twenty random parcels of a built archive with the county's own
records, fetched fresh from its service.

    python3 -I pipeline/checks/parcels_sample.py <county-id> [--seed N] [--n 20] [--out file.md]

The parcels are drawn from the distinct parcel IDs at zoom 16 with a fixed
seed, recorded in the output. Each one is fetched from the county service by
parcel ID with the same field list the build uses (one small request each,
logged to data/logs/parcels/requests-<county-id>.log). For each parcel:

- owner: the archive's owner name equals the service's, character for character;
- acres: the archive's acreage equals the service's;
- outline: the largest distance between the archive outline at zoom 16 (the
  pieces from every zoom 16 tile joined) and the service outline, in meters.
  Pass when under 0.5 m.

It prints "match" or "differs" for owners and never the names.
Runs in WSL (needs the GDAL Python bindings).
"""

import argparse
import collections
import datetime
import json
import os
import random
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
import mapdata as md  # noqa: E402
import parcelsvc  # noqa: E402
import vtiles  # noqa: E402

LAYER = "parcels"
Z = 16
LIMIT_M = 0.5
STEP_M = 0.1          # boundaries are sampled every 10 cm for the distance
DEFAULT_SEED = 20261117

gdal, ogr, osr = md.gdal_modules()


def valid(g):
    gdal.PushErrorHandler("CPLQuietErrorHandler")
    try:
        if not g.IsValid():
            g = g.MakeValid()
    finally:
        gdal.PopErrorHandler()
    return g


def add_polygons(multi, g):
    """Add every polygon inside g (any geometry type) to a MultiPolygon."""
    t = ogr.GT_Flatten(g.GetGeometryType())
    if t == ogr.wkbPolygon:
        multi.AddGeometry(g)
    elif t in (ogr.wkbMultiPolygon, ogr.wkbGeometryCollection):
        for i in range(g.GetGeometryCount()):
            add_polygons(multi, g.GetGeometryRef(i))


def archive_parcel(a, pid, tiles):
    """Join the zoom 16 pieces of one parcel. Returns (geometry, owners, acres, pieces)."""
    parts = ogr.Geometry(ogr.wkbMultiPolygon)
    owners, acres, pieces = set(), set(), 0
    for x, y in sorted(tiles):
        lay = vtiles.decode_tile(a.tile(Z, x, y), layer_names={LAYER}).get(LAYER)
        for f in lay["features"]:
            p = f["properties"]
            if p.get("pid") != pid:
                continue
            pieces += 1
            owners.add(p.get("owner"))
            acres.add(p.get("acres"))
            for poly in vtiles.polygons(f["geometry"]):
                pg = ogr.Geometry(ogr.wkbPolygon)
                for ring in poly:
                    r = ogr.Geometry(ogr.wkbLinearRing)
                    for px, py in ring:
                        r.AddPoint_2D(*vtiles.tile_to_lonlat(Z, x, y, lay["extent"], px, py))
                    pg.AddGeometry(r)
                add_polygons(parts, valid(pg))
    g = parts.UnionCascaded()
    g.AssignSpatialReference(md.wgs84())
    return g, owners, acres, pieces


def service_parcel(svc, feats):
    parts = ogr.Geometry(ogr.wkbMultiPolygon)
    owners, acres = set(), set()
    for f in feats:
        tp = svc.tile_properties(f["properties"])
        owners.add(tp["owner"])
        acres.add(tp.get("acres"))
        if not f.get("geometry"):
            continue
        g = ogr.CreateGeometryFromJson(json.dumps(f["geometry"]))
        g.FlattenTo2D()
        add_polygons(parts, valid(g))
    g = parts.UnionCascaded() if parts.GetGeometryCount() else None
    if g is not None:
        g.AssignSpatialReference(md.wgs84())
    return g, owners, acres


def _points(line):
    t = ogr.GT_Flatten(line.GetGeometryType())
    if t in (ogr.wkbLineString, ogr.wkbLinearRing):
        return line.GetPoints() or []
    out = []
    for i in range(line.GetGeometryCount()):
        out.extend(_points(line.GetGeometryRef(i)))
    return out


def _directed(a, b):
    la = a.Clone()
    la.Segmentize(STEP_M)
    p = ogr.Geometry(ogr.wkbPoint)
    worst = 0.0
    for pt in _points(la):
        p.SetPoint_2D(0, pt[0], pt[1])
        d = p.Distance(b)
        if d > worst:
            worst = d
    return worst


def outline_distance(g1, g2):
    """Largest distance in meters between the two outlines (Hausdorff distance
    of the boundaries, sampled every STEP_M)."""
    c = g2.Centroid()
    local = osr.SpatialReference()
    local.ImportFromProj4(f"+proj=aeqd +lat_0={c.GetY()} +lon_0={c.GetX()} +datum=WGS84 +units=m +no_defs")
    tr = osr.CoordinateTransformation(md.wgs84(), local)
    a, b = g1.Clone(), g2.Clone()
    a.Transform(tr)
    b.Transform(tr)
    ba, bb = a.GetBoundary(), b.GetBoundary()
    return max(_directed(ba, bb), _directed(bb, ba))


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("county")
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--archive")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    archive = args.archive or os.path.join(md.BUILD, args.county, f"{LAYER}.pmtiles")
    meta_path = os.path.join(md.BUILD, args.county, f"{LAYER}.meta.json")
    meta = md.read_json(meta_path) if os.path.exists(meta_path) else {}

    a = vtiles.Archive(archive)
    where = collections.defaultdict(set)
    for z, x, y, off, length in a.entries():
        if z != Z:
            continue
        lay = vtiles.decode_tile(a.tile_data(off, length), geometry=False, layer_names={LAYER}).get(LAYER)
        for f in lay["features"] if lay else []:
            pid = f["properties"].get("pid")
            if pid:
                where[pid].add((x, y))
    pids = sorted(where)
    rng = random.Random(args.seed)
    sample = rng.sample(pids, min(args.n, len(pids)))

    svc = parcelsvc.ParcelService(args.county, "sample-check")
    layer_cache = os.path.join(md.CACHE, "parcels", args.county, "layer.json")
    if os.path.exists(layer_cache):
        svc.oid_field = md.read_json(layer_cache).get("objectIdField")
    else:
        svc.layer_info()

    rows = []
    for pid in sample:
        ag, a_owners, a_acres, pieces = archive_parcel(a, pid, where[pid])
        feats = svc.by_pid(pid)
        sg, s_owners, s_acres = service_parcel(svc, feats)
        row = {"pid": pid, "tiles": len(where[pid]), "pieces": pieces, "records": len(feats)}
        if not feats:
            row.update(owner="not in service", acres="not in service", dist=None, outline="FAIL")
        else:
            row["owner"] = "match" if a_owners == s_owners else "differs"
            if a_acres != s_acres:
                row["acres"] = "differs"
            else:
                row["acres"] = "match (none recorded)" if a_acres == {None} else "match"
            if sg is None:
                row.update(dist=None, outline="FAIL (no service outline)")
            else:
                d = outline_distance(ag, sg)
                row.update(dist=d, outline="pass" if d < LIMIT_M else "FAIL")
        rows.append(row)
        md.log(f"  {pid}: owner {row['owner']}, acres {row['acres']}, outline {row['outline']}"
               + (f" ({row['dist']:.3f} m)" if row["dist"] is not None else ""))

    n = len(rows)
    passed = {k: sum(1 for r in rows if r[k] in ("match", "match (none recorded)", "pass")) for k in ("owner", "acres", "outline")}
    worst = max((r["dist"] for r in rows if r["dist"] is not None), default=None)
    lines = [
        f"# Random parcel check: {args.county}",
        "",
        f"Run {datetime.date.today().isoformat()} by `pipeline/checks/parcels_sample.py`.",
        "",
        f"- Archive: `data/build/{args.county}/{LAYER}.pmtiles`, built {meta.get('buildDate', '?')}, "
        f"data date {(meta.get('sources') or [{}])[0].get('dataDate', '?')}.",
        f"- {n} parcels drawn at random from the {len(pids)} distinct parcel IDs at zoom {Z}, with seed {args.seed} "
        "(Python `random.Random(seed).sample` over the sorted IDs).",
        f"- Each parcel fetched from the county service by parcel ID with fields `{svc.out_fields}` plus its outline, "
        f"{svc.requests} requests in all.",
        "- Owner: exact text equality. The names are not printed.",
        "- Acres: equality of the numbers. The archive leaves `acres` out where the county records 0; "
        "\"match (none recorded)\" means both sides have no acreage.",
        f"- Outline: largest distance between the archive outline at zoom {Z} (pieces from every zoom {Z} tile joined) "
        f"and the service outline, sampled every {STEP_M} m. Pass under {LIMIT_M} m.",
        "",
        "| # | Parcel ID | Zoom 16 tiles | Service records | Owner | Acres | Outline, largest distance (m) | Outline |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(rows, 1):
        d = f"{r['dist']:.3f}" if r["dist"] is not None else "-"
        lines.append(f"| {i} | {r['pid']} | {r['tiles']} | {r['records']} | {r['owner']} | {r['acres']} | {d} | {r['outline']} |")
    lines += [
        "",
        f"Result: owner {passed['owner']} of {n} match, acres {passed['acres']} of {n} match, "
        f"outline {passed['outline']} of {n} pass. Largest outline distance {worst:.3f} m." if worst is not None else
        f"Result: owner {passed['owner']} of {n} match, acres {passed['acres']} of {n} match, outline {passed['outline']} of {n} pass.",
    ]
    text = "\n".join(lines) + "\n"
    print(text, end="")
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
    return 0 if all(v == n for v in passed.values()) else 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except md.PipelineError as e:
        md.log(f"error: {e}")
        sys.exit(1)
