# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Measure the distance from test points to the nearest property line, from
the county's own outlines, fetched fresh from its service.

    python3 -I pipeline/checks/parcels_line_distance.py <county-id> \
        --pid <parcel id> [--pid ...] \
        --point <lng>,<lat>,<meters the app's readout gave> [--point ...] \
        [--out file.md]

This is the independent side of the Step 2 check "the readout's distance to
the line agrees with a measurement made from the county's own outline to
within 2 m". The app's side is read from the archive; this side never touches
the archive. Each parcel named with --pid is fetched from the county service
by parcel ID with the same field list the build uses (one small request each,
logged to data/logs/parcels/requests-<county-id>.log). Each point is measured
in an azimuthal equidistant projection centered on that point, so distances
from it are true.

It prints no owner names. Runs in WSL (needs the GDAL Python bindings).
"""

import argparse
import datetime
import json
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
import mapdata as md  # noqa: E402
import parcelsvc  # noqa: E402

LIMIT_M = 2.0

gdal, ogr, osr = md.gdal_modules()


def service_outline(svc, pid):
    """The county's outline of one parcel as a MultiPolygon in WGS84, or None."""
    parts = ogr.Geometry(ogr.wkbMultiPolygon)
    for f in svc.by_pid(pid):
        if not f.get("geometry"):
            continue
        g = ogr.CreateGeometryFromJson(json.dumps(f["geometry"]))
        g.FlattenTo2D()
        t = ogr.GT_Flatten(g.GetGeometryType())
        if t == ogr.wkbPolygon:
            parts.AddGeometry(g)
        elif t == ogr.wkbMultiPolygon:
            for i in range(g.GetGeometryCount()):
                parts.AddGeometry(g.GetGeometryRef(i))
    return parts if parts.GetGeometryCount() else None


def local_transform(lng, lat):
    src = md.wgs84()
    dst = osr.SpatialReference()
    dst.ImportFromProj4(f"+proj=aeqd +lat_0={lat!r} +lon_0={lng!r} +datum=WGS84 +units=m +no_defs")
    src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(src, dst)


def measure(lng, lat, outlines):
    """(distance in m to the nearest outline edge, parcel ID of that edge, parcel ID the point is in or None)."""
    tr = local_transform(lng, lat)
    origin = ogr.Geometry(ogr.wkbPoint)
    origin.AddPoint_2D(0.0, 0.0)
    best, best_pid, inside = None, None, None
    for pid, g in outlines.items():
        local = g.Clone()
        local.Transform(tr)
        if local.Contains(origin):
            inside = pid
        d = local.GetBoundary().Distance(origin)
        if best is None or d < best:
            best, best_pid = d, pid
    return best, best_pid, inside


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("county")
    ap.add_argument("--pid", action="append", required=True)
    ap.add_argument("--point", action="append", required=True, help="lng,lat,meters from the app's readout")
    ap.add_argument("--out")
    args = ap.parse_args(argv)

    svc = parcelsvc.ParcelService(args.county, "line-distance-check")
    layer_cache = os.path.join(md.CACHE, "parcels", args.county, "layer.json")
    if os.path.exists(layer_cache):
        svc.oid_field = md.read_json(layer_cache).get("objectIdField")
    else:
        svc.layer_info()

    outlines = {}
    for pid in args.pid:
        g = service_outline(svc, pid)
        if g is None:
            raise md.PipelineError(f"the service has no outline for parcel {pid}")
        outlines[pid] = g

    rows, ok = [], True
    for spec in args.point:
        lng, lat, app_m = (float(v) for v in spec.split(","))
        d, pid, inside = measure(lng, lat, outlines)
        diff = abs(d - app_m)
        passed = diff <= LIMIT_M
        ok = ok and passed
        rows.append((lng, lat, inside or "none of these", app_m, d, pid, diff, "pass" if passed else "FAIL"))
        md.log(f"  {lng}, {lat}: app {app_m:.3f} m, county outline {d:.3f} m, difference {diff:.3f} m")

    lines = [
        f"# Distance to the property line, measured from the county's own outlines: {args.county}",
        "",
        f"Run {datetime.date.today().isoformat()}. Service: {svc.url}.",
        f"Parcels fetched by parcel ID: {', '.join(args.pid)}. Requests made: {svc.requests}.",
        "",
        "The app's distance is what its parcel source gave for the point, read from the archive.",
        "The county distance is from the outline the county's service returned today, measured in a",
        "projection centered on the point. The archive was not read for the county distance.",
        f"Pass when the two differ by {LIMIT_M:g} m or less.",
        "",
        "| Point (longitude, latitude) | In parcel | App's distance | From the county's outline | Nearest line belongs to | Difference | Result |",
        "|---|---|---|---|---|---|---|",
    ]
    for lng, lat, inside, app_m, d, pid, diff, res in rows:
        lines.append(f"| {lng}, {lat} | {inside} | {app_m:.3f} m | {d:.3f} m | {pid} | {diff:.3f} m | {res} |")
    lines += ["", "All points pass." if ok else "At least one point FAILS.", ""]
    text = "\n".join(lines)
    if args.out:
        with open(args.out, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    print(text)
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except md.PipelineError as e:
        md.log(f"error: {e}")
        sys.exit(2)
