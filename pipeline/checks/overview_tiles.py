# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Check a base map archive, built for the overview map: tiles and bytes per
zoom, then the tile at the archive's top zoom under each given point, decoded,
with its layers, road kinds, water features and place names.

    python3 -I pipeline/checks/overview_tiles.py <archive.pmtiles> \\
        --point "Name,<lon>,<lat>" [--point ...] [--require earth,roads]

Exits with 1 if a point has no tile or its tile lacks a required layer.
Reads the archive only; makes no request.
"""

import argparse
import collections
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
from vtiles import Archive, decode_tile  # noqa: E402
from mapdata import lonlat_to_tile  # noqa: E402


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("archive")
    ap.add_argument("--point", action="append", default=[], help="label,lon,lat")
    ap.add_argument("--require", default="earth,roads", help="layers every point's tile must have")
    args = ap.parse_args(argv)
    required = [x for x in args.require.split(",") if x]
    failed = False

    with Archive(args.archive) as a:
        h = a.header()
        print(f"{args.archive}: {os.path.getsize(args.archive)} bytes, {h['tile_type']}, {h['tile_compression']}, "
              f"zoom {h['minzoom']} to {h['maxzoom']}, bounds {h['bounds']}")
        per = collections.defaultdict(lambda: [0, 0, 0])
        for z, x, y, off, length in a.entries():
            s = per[z]
            s[0] += 1
            s[1] += length
            s[2] = max(s[2], length)
        print("zoom  tiles  bytes (compressed)  largest tile")
        for z in sorted(per):
            n, b, mx = per[z]
            print(f"{z:>4}  {n:>5}  {b:>18}  {mx:>12}")
        print(f"total {sum(v[0] for v in per.values())} tiles, {sum(v[1] for v in per.values())} bytes of tile data")

        z = h["maxzoom"]
        for spec in args.point:
            label, lon, lat = spec.rsplit(",", 2)
            x, y = lonlat_to_tile(float(lon), float(lat), z)
            data = a.tile(z, x, y)
            print(f"\n{label} ({lon}, {lat}): tile {z}/{x}/{y}")
            if data is None:
                print("  FAIL: no tile")
                failed = True
                continue
            layers = decode_tile(data, geometry=False)
            print("  layers: " + ", ".join(f"{k} {len(v['features'])}" for k, v in sorted(layers.items())))
            missing = [r for r in required if not layers.get(r, {}).get("features")]
            if missing:
                print(f"  FAIL: no features in {', '.join(missing)}")
                failed = True
            roads = collections.Counter(f["properties"].get("kind") for f in layers.get("roads", {}).get("features", []))
            print("  road kinds: " + ", ".join(f"{k} {n}" for k, n in roads.most_common()))
            refs = sorted({str(f["properties"]["ref"]) for f in layers.get("roads", {}).get("features", [])
                           if f["properties"].get("ref")})
            print("  road numbers: " + ", ".join(refs[:15]))
            water = collections.Counter(f["properties"].get("kind") for f in layers.get("water", {}).get("features", []))
            print("  water kinds: " + ", ".join(f"{k} {n}" for k, n in water.most_common()))
            wnames = sorted({f["properties"]["name"] for f in layers.get("water", {}).get("features", [])
                             if f["properties"].get("name")})
            print("  water names: " + ", ".join(wnames[:15]))
            places = [(f["properties"].get("kind"), f["properties"].get("name"))
                      for f in layers.get("places", {}).get("features", [])]
            print("  places: " + ", ".join(f"{n} ({k})" for k, n in places[:20]))
    print("\nFAIL" if failed else "\nPASS")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
