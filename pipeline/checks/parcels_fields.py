# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Check a built parcel archive against the contract of D27.

    python3 -I pipeline/checks/parcels_fields.py <county-id> [--archive path] [--out file.md]

Walks every tile of data/build/<county-id>/parcels.pmtiles and reports:

- the archive header: tile type, zooms, bounds against the county outline box;
- per zoom: tiles, bytes, the largest tile (gzip and unpacked);
- at zoom 16: every property key found, the type of each, the number of
  features, distinct feature ids and distinct parcel IDs, against the
  service's count from the download manifest (no request is made);
- at zooms 13 to 15: distinct parcel IDs per zoom, and for every tile the
  parcel IDs present in its zoom 16 tiles but missing from it (a dropped
  parcel shows up here).

It prints keys and counts only. It never prints an owner name.
"""

import argparse
import collections
import json
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
import vtiles  # noqa: E402

PIPELINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(PIPELINE)
LAYER = "parcels"
ALLOWED = {"pid": str, "owner": str, "acres": (int, float), "county": str}
MAXZ = 16


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def outline_box(county):
    counties = {c["id"]: c for c in read_json(os.path.join(PIPELINE, "counties.json"))}
    path = os.path.join(REPO, "data", "cache", "census", f"county-{counties[county]['fips']}.geojson")
    if not os.path.exists(path):
        return None
    xs, ys = [], []

    def walk(c):
        if c and isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for p in c:
                walk(p)
    for f in read_json(path)["features"]:
        walk(f["geometry"]["coordinates"])
    return [min(xs), min(ys), max(xs), max(ys)]


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("county")
    ap.add_argument("--archive")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    archive = args.archive or os.path.join(REPO, "data", "build", args.county, f"{LAYER}.pmtiles")
    lines = []
    out = lines.append
    problems = []

    a = vtiles.Archive(archive)
    h = a.header()
    out(f"# Parcel archive field check: {args.county}")
    out("")
    out(f"Archive: `data/build/{args.county}/{LAYER}.pmtiles`, {os.path.getsize(archive)} bytes.")
    out("")
    out("## Header")
    out("")
    out(f"- Tile type {h['tile_type']}, compression {h['tile_compression']}, zoom {h['minzoom']} to {h['maxzoom']}.")
    out(f"- Bounds {h['bounds']}.")
    box = outline_box(args.county)
    if box:
        covers = (h["bounds"][0] <= box[0] and h["bounds"][1] <= box[1]
                  and h["bounds"][2] >= box[2] and h["bounds"][3] >= box[3])
        out(f"- County outline box {[round(v, 5) for v in box]}: {'covered' if covers else 'NOT covered'} by the archive bounds.")
        if not covers:
            problems.append("archive bounds do not cover the county outline")
    if (h["minzoom"], h["maxzoom"]) != (13, 16):
        problems.append(f"zooms are {h['minzoom']} to {h['maxzoom']}, the contract says 13 to 16")
    if h["tile_type"] != "mvt" or h["tile_compression"] != "gzip":
        problems.append("tiles are not gzip vector tiles")

    per_zoom = collections.OrderedDict()
    tiles_by_zoom = collections.defaultdict(dict)    # z -> {(x, y): set(feature id)}
    pids_by_zoom = collections.defaultdict(set)
    keys = collections.Counter()
    types = collections.defaultdict(collections.Counter)
    other_layers = collections.Counter()
    z16_pieces = 0
    z16_ids = set()
    z16_pids = set()
    empty_pid_ids = set()
    no_acres_ids = set()
    counties = collections.Counter()
    for z, x, y, off, length in a.entries():
        data = a.tile_data(off, length)
        s = per_zoom.setdefault(z, {"tiles": 0, "gzip": 0, "max_gzip": 0, "max_gzip_tile": "", "max_raw": 0, "max_raw_tile": "", "pieces": 0})
        s["tiles"] += 1
        s["gzip"] += length
        if length > s["max_gzip"]:
            s["max_gzip"], s["max_gzip_tile"] = length, f"{z}/{x}/{y}"
        if len(data) > s["max_raw"]:
            s["max_raw"], s["max_raw_tile"] = len(data), f"{z}/{x}/{y}"
        layers = vtiles.decode_tile(data, geometry=False)
        for name in layers:
            if name != LAYER:
                other_layers[name] += 1
        feats = layers.get(LAYER, {}).get("features", [])
        s["pieces"] += len(feats)
        pids = set()
        recs = set()
        for f in feats:
            p = f["properties"]
            pids.add(p.get("pid"))
            recs.add(f["id"])
            if z == MAXZ:
                z16_pieces += 1
                z16_ids.add(f["id"])
                for k, v in p.items():
                    keys[k] += 1
                    types[k][type(v).__name__] += 1
                if not (p.get("pid") or "").strip():
                    empty_pid_ids.add(f["id"])
                if "acres" not in p:
                    no_acres_ids.add(f["id"])
                counties[p.get("county")] += 1
        tiles_by_zoom[z][(x, y)] = recs
        pids_by_zoom[z] |= pids
        if z == MAXZ:
            z16_pids |= pids

    out("")
    out("## Tiles per zoom")
    out("")
    out("| Zoom | Tiles | Bytes (gzip) | Largest tile, gzip | Largest tile, unpacked | Feature pieces |")
    out("|---|---|---|---|---|---|")
    for z, s in per_zoom.items():
        out(f"| {z} | {s['tiles']} | {s['gzip']} | {s['max_gzip']} ({s['max_gzip_tile']}) | {s['max_raw']} ({s['max_raw_tile']}) | {s['pieces']} |")

    out("")
    out("## Properties at zoom 16")
    out("")
    out(f"- Property keys found: {', '.join(f'`{k}`' for k in sorted(keys))}.")
    for k in sorted(keys):
        out(f"  - `{k}`: on {keys[k]} feature pieces, value types {dict(types[k])}.")
    extra = set(keys) - set(ALLOWED)
    if extra:
        problems.append(f"keys outside the contract: {sorted(extra)}")
    for k in ("pid", "owner", "county"):
        if keys[k] != z16_pieces:
            problems.append(f"`{k}` is missing on {z16_pieces - keys[k]} feature pieces")
    for k, want in ALLOWED.items():
        bad = [t for t in types[k] if not isinstance({"str": "", "int": 0, "float": 0.0, "bool": True}.get(t), want)]
        if bad:
            problems.append(f"`{k}` has values of type {bad}")
    if other_layers:
        problems.append(f"tile layers other than `{LAYER}`: {dict(other_layers)}")
    out(f"- `county` values: {dict(counties)}.")
    out(f"- Feature pieces (a parcel cut by tile edges counts once per tile): {z16_pieces}.")
    out(f"- Distinct feature ids (one per service record): {len(z16_ids)}.")
    blank = {p for p in z16_pids if not (p or "").strip()}
    out(f"- Distinct parcel IDs (`pid`), not counting blank ones: {len(z16_pids - blank)}. "
        f"Records whose `pid` is empty or only spaces: {len(empty_pid_ids)}.")
    out(f"- Records with no `acres`: {len(no_acres_ids)}.")

    manifest_path = os.path.join(REPO, "data", "cache", "parcels", args.county, "manifest.json")
    if os.path.exists(manifest_path):
        m = read_json(manifest_path)
        out("")
        out("## Against the service")
        out("")
        out(f"- Service count on {m['fetched']} (data last edited {m['dataDate']}): {m['count']} records.")
        out(f"- Archive at zoom 16: {len(z16_ids)} distinct records, {len(z16_pids - blank)} distinct non-blank parcel IDs, "
            f"{len(empty_pid_ids)} records with a blank parcel ID.")
        if len(z16_ids) != m["count"]:
            out(f"- Difference: {m['count'] - len(z16_ids)} service records are not in the archive "
                "(records with no outline cannot be drawn; see the build log).")
            no_outline = 0
            meta_path = os.path.join(REPO, "data", "build", args.county, f"{LAYER}.meta.json")
            if os.path.exists(meta_path):
                no_outline = read_json(meta_path).get("provenance", {}).get("noOutline", 0)
            if m["count"] - len(z16_ids) != no_outline:
                problems.append(f"{m['count'] - len(z16_ids)} records missing at zoom 16, of which only {no_outline} have no outline")

    out("")
    out("## Zooms 13 to 15: nothing dropped")
    out("")
    out("For each tile, every record (feature id) found in the zoom 16 tiles under it must be in it. Records, not "
        "parcel IDs, are compared, because some parcel IDs are on more than one record.")
    out("")
    out("| Zoom | Distinct records | Distinct non-blank parcel IDs | Tiles checked | Tiles missing a record | Records missing |")
    out("|---|---|---|---|---|---|")
    z16 = tiles_by_zoom.get(MAXZ, {})
    for z in sorted(k for k in tiles_by_zoom if k < MAXZ):
        shift = MAXZ - z
        below = collections.defaultdict(set)
        for (x, y), recs in z16.items():
            below[(x >> shift, y >> shift)] |= recs
        tiles_missing = 0
        missing = set()
        for xy, want in below.items():
            have = tiles_by_zoom[z].get(xy, set())
            gone = want - have
            if gone:
                tiles_missing += 1
                missing |= gone
        all_z = set().union(*tiles_by_zoom[z].values()) if tiles_by_zoom[z] else set()
        nb = {p for p in pids_by_zoom[z] if (p or "").strip()}
        out(f"| {z} | {len(all_z)} | {len(nb)} | {len(below)} | {tiles_missing} | {len(missing)} |")
        if missing:
            problems.append(f"zoom {z}: {len(missing)} records missing from at least one tile, e.g. feature ids {sorted(missing)[:10]}")

    out("")
    out("## Result")
    out("")
    if problems:
        out("FAIL:")
        for p in problems:
            out(f"- {p}")
    else:
        out("PASS: only the four contract keys, every service record with an outline is at zoom 16, and no parcel is missing at zooms 13 to 15.")
    text = "\n".join(lines) + "\n"
    print(text, end="")
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
