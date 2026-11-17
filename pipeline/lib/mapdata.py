# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Shared helpers for the data pipeline.

Used as a module by the layer scripts and as a small command line tool by the
bash scripts:

    python3 -I pipeline/lib/mapdata.py county-field <county-id> <field>
    python3 -I pipeline/lib/mapdata.py outline <county-id>
    python3 -I pipeline/lib/mapdata.py write-meta <args...>
    python3 -I pipeline/lib/mapdata.py validate-meta <meta.json> [archive.pmtiles]

Nothing in this file names a county. Counties come from pipeline/counties.json.
"""

import argparse
import datetime
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PIPELINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(PIPELINE)
CACHE = os.path.join(REPO, "data", "cache")
BUILD = os.path.join(REPO, "data", "build")
PMTILES = os.environ.get("PMTILES", os.path.join(REPO, ".tools", "pmtiles-linux", "pmtiles"))

# Generic client name. Never put a person's or the project's name in requests.
USER_AGENT = "map-data-build"

# The layers of the archive contract (pipeline/README.md).
LAYERS = {
    "basemap": {"kind": "vector", "title": "Base map", "minzoom": 0, "maxzoom": 15},
    "aerial": {"kind": "raster", "title": "Aerial imagery", "minzoom": 7, "maxzoom": 16},
    "publicland": {"kind": "vector", "title": "Public land", "minzoom": 10, "maxzoom": 14},
    "parcels": {"kind": "vector", "title": "Parcels", "minzoom": 13, "maxzoom": 16},
}

# Census TIGERweb, current vintage, "Counties" layer. A single-county query is
# about 60 KB, far lighter than the national cartographic boundary file.
TIGERWEB_COUNTIES = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1"


def log(msg):
    print(msg, file=sys.stderr, flush=True)


class PipelineError(Exception):
    pass


# ---------------------------------------------------------------- counties

def load_counties():
    with open(os.path.join(PIPELINE, "counties.json"), encoding="utf-8") as f:
        return json.load(f)


def get_county(county_id):
    counties = load_counties()
    for c in counties:
        if c["id"] == county_id:
            for key in ("id", "name", "state", "stateName", "fips"):
                if not c.get(key):
                    raise PipelineError(f"counties.json entry {county_id} has no '{key}'")
            if not re.fullmatch(r"\d{5}", c["fips"]):
                raise PipelineError(f"counties.json entry {county_id} has a bad FIPS code '{c['fips']}'")
            return c
    known = ", ".join(c["id"] for c in counties)
    raise PipelineError(f"unknown county '{county_id}'. Known counties: {known}")


def county_label(county):
    return f"{county['name']}, {county['stateName']}"


# ---------------------------------------------------------------- files

def atomic_write_bytes(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp-{os.getpid()}"
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def atomic_write_json(path, obj):
    atomic_write_bytes(path, (json.dumps(obj, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- downloads

def http(url, data=None, tries=5, timeout=180, json_body=None):
    """GET (or POST form data, or POST a JSON body) and return the body.
    Retries on network errors, HTTP 429 and 5xx."""
    headers = {"User-Agent": USER_AGENT}
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    if json_body is not None:
        body = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    for attempt in range(1, tries + 1):
        req = urllib.request.Request(url, data=body, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500 or attempt == tries:
                raise PipelineError(f"HTTP {e.code} from {url.split('?')[0]}") from e
            wait = 65 if e.code == 429 else 10 * attempt
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == tries:
                raise PipelineError(f"download failed from {url.split('?')[0]}: {e}") from e
            wait = 10 * attempt
        log(f"  retrying in {wait} s (attempt {attempt} of {tries})")
        time.sleep(wait)


def arcgis_query(layer_url, params, tries=5):
    """POST a query to an ArcGIS REST layer and return parsed JSON. ArcGIS
    reports some errors, including rate limits, inside an HTTP 200 body."""
    for attempt in range(1, tries + 1):
        res = json.loads(http(layer_url + "/query", data=params))
        err = res.get("error") if isinstance(res, dict) else None
        if not err:
            return res
        if attempt == tries:
            raise PipelineError(f"ArcGIS error from {layer_url}: {err}")
        wait = 65 if err.get("code") == 429 else 10 * attempt
        log(f"  service said: {err.get('message')}. Retrying in {wait} s")
        time.sleep(wait)


def arcgis_json(url):
    res = json.loads(http(url + ("&" if "?" in url else "?") + "f=json"))
    if isinstance(res, dict) and res.get("error"):
        raise PipelineError(f"ArcGIS error from {url}: {res['error']}")
    return res


def wait_for_quiet_machine(what):
    """This machine has 12 GB of RAM. Before a heavy step, wait while a Gradle
    build (a java.exe using CPU) or the Android emulator (qemu) runs on
    Windows; see busy.ps1. Checks once a minute. Skipped where Windows is not
    reachable (not WSL). tasklist.exe is not used: called from WSL it can
    take minutes."""
    script = os.path.join(PIPELINE, "lib", "busy.ps1")
    first = True
    while True:
        try:
            win = subprocess.run(["wslpath", "-w", script], capture_output=True, text=True, timeout=30).stdout.strip()
            out = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", win],
                                 capture_output=True, text=True, timeout=180).stdout
        except (OSError, subprocess.SubprocessError):
            return
        busy = sorted({line.strip() for line in out.splitlines() if line.strip()})
        if not busy:
            if not first:
                log(f"  machine is quiet again, starting: {what}")
            return
        if first:
            log(f"  waiting before {what}: {', '.join(busy)} running on Windows (checking each minute)")
            first = False
        time.sleep(60)


def cached(path):
    """True when a cached file may be reused. REFRESH=1 forces a new download."""
    return os.path.exists(path) and os.environ.get("REFRESH") != "1"


# ---------------------------------------------------------------- county outline

def county_outline(county):
    """Return (path to the county outline GeoJSON in EPSG:4326, provenance dict).
    Downloaded once from Census TIGERweb by FIPS code and cached."""
    fips = county["fips"]
    d = os.path.join(CACHE, "census")
    path = os.path.join(d, f"county-{fips}.geojson")
    prov_path = os.path.join(d, f"county-{fips}.source.json")
    if cached(path) and os.path.exists(prov_path):
        return path, read_json(prov_path)

    log(f"Downloading the county outline for FIPS {fips} from Census TIGERweb")
    info = arcgis_json(TIGERWEB_COUNTIES)
    desc = info.get("description", "")
    if info.get("name") != "Counties":
        raise PipelineError(f"TIGERweb layer is '{info.get('name')}', expected 'Counties'. The service layout changed.")
    m = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4}) vintage", desc)
    vintage = datetime.datetime.strptime(" ".join(m.groups()), "%B %d %Y").date().isoformat() if m else None

    res = arcgis_query(TIGERWEB_COUNTIES, {
        "where": f"GEOID='{fips}'", "outFields": "GEOID,NAME", "returnGeometry": "true",
        "outSR": "4326", "f": "geojson"})
    feats = res.get("features", [])
    if len(feats) != 1 or feats[0]["properties"].get("GEOID") != fips:
        raise PipelineError(f"TIGERweb returned {len(feats)} features for FIPS {fips}, expected 1")
    got_name = feats[0]["properties"].get("NAME")
    if got_name != county["name"]:
        log(f"  warning: Census names FIPS {fips} '{got_name}', counties.json says '{county['name']}'")
    fc = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"GEOID": fips, "NAME": got_name},
        "geometry": feats[0]["geometry"]}]}
    prov = {
        "source": "US Census Bureau TIGERweb, State_County MapServer, layer 1 'Counties', single-county query by GEOID",
        "url": TIGERWEB_COUNTIES,
        "vintage": desc,
        "dataDate": vintage,
        "fetched": datetime.date.today().isoformat(),
    }
    atomic_write_json(path, fc)
    atomic_write_json(prov_path, prov)
    log(f"  saved {path} ({os.path.getsize(path)} bytes, {desc})")
    return path, prov


def gdal_modules():
    """Import the GDAL bindings with exceptions switched on."""
    from osgeo import gdal, ogr, osr
    for mod in (gdal, ogr, osr):
        mod.UseExceptions()
    return gdal, ogr, osr


def outline_geometry(county):
    """The county outline as an OGR geometry in EPSG:4326 (lon, lat order)."""
    _, ogr, _ = gdal_modules()
    path, _ = county_outline(county)
    fc = read_json(path)
    g = ogr.CreateGeometryFromJson(json.dumps(fc["features"][0]["geometry"]))
    g.AssignSpatialReference(wgs84())
    return g


def wgs84():
    _, _, osr = gdal_modules()
    s = osr.SpatialReference()
    s.ImportFromEPSG(4326)
    s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return s


def buffer_meters(geom, meters):
    """Buffer a lon/lat geometry by a distance in metres, using an
    azimuthal equidistant projection centred on the geometry."""
    _, ogr, osr = gdal_modules()
    c = geom.Centroid()
    local = osr.SpatialReference()
    local.ImportFromProj4(f"+proj=aeqd +lat_0={c.GetY()} +lon_0={c.GetX()} +datum=WGS84 +units=m +no_defs")
    to_local = osr.CoordinateTransformation(wgs84(), local)
    to_wgs = osr.CoordinateTransformation(local, wgs84())
    g = geom.Clone()
    g.Transform(to_local)
    g = g.Buffer(meters, 8)
    g.Transform(to_wgs)
    g.AssignSpatialReference(wgs84())
    return g


def polygonal_simplify(geom, tolerance_deg=0.001):
    """A simpler polygon that still contains geom, for search queries."""
    g = geom.Buffer(2 * tolerance_deg, 2).SimplifyPreserveTopology(tolerance_deg)
    g.AssignSpatialReference(wgs84())
    return g


def cached_outline_path(county):
    """The cached county outline file, or a PipelineError if it is not cached.
    Never downloads: for steps that must make no request."""
    path = os.path.join(CACHE, "census", f"county-{county['fips']}.geojson")
    if not os.path.exists(path):
        raise PipelineError(f"the county outline is not cached at {path}. A full build fetches it once.")
    return path


def round_coords(coords, digits):
    if coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], digits), round(coords[1], digits)]
    return [round_coords(c, digits) for c in coords]


# The county outline in the metadata 'coverage' member is simplified to this
# tolerance, in meters. The Census line and a county's own parcel edges differ
# by more than this anyway, so nothing the app decides is changed by it.
COVERAGE_TOLERANCE_M = 5.0


def coverage_geometry(county, tolerance_m=COVERAGE_TOLERANCE_M):
    """The county outline as a GeoJSON geometry for the metadata 'coverage'
    member: Polygon or MultiPolygon, WGS84, longitude first, simplified to
    about tolerance_m meters, coordinates rounded to 6 decimals (about 0.1 m).
    Read from the cached outline only, so it never makes a request."""
    _, ogr, osr = gdal_modules()
    fc = read_json(cached_outline_path(county))
    g = ogr.CreateGeometryFromJson(json.dumps(fc["features"][0]["geometry"]))
    g.AssignSpatialReference(wgs84())
    c = g.Centroid()
    local = osr.SpatialReference()
    local.ImportFromProj4(f"+proj=aeqd +lat_0={c.GetY()} +lon_0={c.GetX()} +datum=WGS84 +units=m +no_defs")
    g.Transform(osr.CoordinateTransformation(wgs84(), local))
    g = g.SimplifyPreserveTopology(tolerance_m)
    g.AssignSpatialReference(local)
    g.Transform(osr.CoordinateTransformation(local, wgs84()))
    out = json.loads(g.ExportToJson())
    if out.get("type") not in ("Polygon", "MultiPolygon"):
        raise PipelineError(f"the simplified county outline is a {out.get('type')}, expected a polygon")
    out = {"type": out["type"], "coordinates": round_coords(out["coordinates"], 6)}
    problems = validate_coverage(out)
    if problems:
        raise PipelineError("the simplified county outline is not usable: " + "; ".join(problems))
    return out


def validate_coverage(geom, bounds=None):
    """Problems with a metadata 'coverage' geometry; empty means valid."""
    p = []
    if not isinstance(geom, dict) or geom.get("type") not in ("Polygon", "MultiPolygon"):
        return ["coverage must be a GeoJSON Polygon or MultiPolygon"]
    polys = [geom.get("coordinates")] if geom["type"] == "Polygon" else geom.get("coordinates")
    if not isinstance(polys, list) or not polys:
        return ["coverage has no coordinates"]
    xs, ys = [], []
    for poly in polys:
        if not isinstance(poly, list) or not poly:
            p.append("coverage has an empty polygon")
            continue
        for ring in poly:
            if not isinstance(ring, list) or len(ring) < 4:
                p.append("coverage has a ring with fewer than 4 positions")
                continue
            for pos in ring:
                if not (isinstance(pos, list) and len(pos) == 2 and all(isinstance(v, (int, float)) for v in pos)
                        and -180 <= pos[0] <= 180 and -90 <= pos[1] <= 90):
                    p.append(f"coverage position {pos!r} is not [longitude, latitude]")
                    return p
                xs.append(pos[0])
                ys.append(pos[1])
            if ring[0] != ring[-1]:
                p.append("coverage has a ring that is not closed")
    if bounds and xs and (min(xs) < bounds[0] - 1e-3 or min(ys) < bounds[1] - 1e-3
                          or max(xs) > bounds[2] + 1e-3 or max(ys) > bounds[3] + 1e-3):
        p.append(f"coverage reaches outside the metadata bounds {bounds}")
    return p


def outline_bounds(county, digits=4):
    """Bounding box of the county outline, rounded outward."""
    env = outline_geometry(county).GetEnvelope()  # minx, maxx, miny, maxy
    f = 10 ** digits
    return [math.floor(env[0] * f) / f, math.floor(env[2] * f) / f,
            math.ceil(env[1] * f) / f, math.ceil(env[3] * f) / f]


# ---------------------------------------------------------------- tiles

def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    lat = max(min(lat, 85.0511), -85.0511)
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def tile_bounds(z, x, y):
    n = 2 ** z
    west = x / n * 360.0 - 180.0
    east = (x + 1) / n * 360.0 - 180.0
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return west, south, east, north


def tile_cover(geom, z):
    """Union of all zoom-z tiles that intersect geom, as an OGR polygon."""
    _, ogr, _ = gdal_modules()
    minx, maxx, miny, maxy = geom.GetEnvelope()
    x0, y0 = lonlat_to_tile(minx, maxy, z)
    x1, y1 = lonlat_to_tile(maxx, miny, z)
    union = ogr.Geometry(ogr.wkbMultiPolygon)
    count = 0
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            w, s, e, n = tile_bounds(z, x, y)
            ring = ogr.Geometry(ogr.wkbLinearRing)
            for px, py in ((w, s), (e, s), (e, n), (w, n), (w, s)):
                ring.AddPoint_2D(px, py)
            sq = ogr.Geometry(ogr.wkbPolygon)
            sq.AddGeometry(ring)
            if sq.Intersects(geom):
                union.AddGeometry(sq)
                count += 1
    out = union.UnionCascaded()
    out.AssignSpatialReference(wgs84())
    return out, count


# ---------------------------------------------------------------- PMTiles

def pmtiles_header(path):
    out = subprocess.run([PMTILES, "show", "--header-json", path], check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def raster_tile_size(path):
    """Width in pixels of a decoded tile of a raster archive (the tile at the
    archive's centre, at its highest zoom). Raises if the tile is not square."""
    gdal, _, _ = gdal_modules()
    h = pmtiles_header(path)
    lon, lat = h["center"][0], h["center"][1]
    x, y = lonlat_to_tile(lon, lat, h["maxzoom"])
    data = subprocess.run([PMTILES, "tile", path, str(h["maxzoom"]), str(x), str(y)],
                          check=True, capture_output=True).stdout
    if not data:
        raise PipelineError(f"no tile at the centre of {path} to measure")
    name = f"/vsimem/tilesize-{os.getpid()}"
    gdal.FileFromMemBuffer(name, data)
    try:
        ds = gdal.Open(name)
        w, hgt = ds.RasterXSize, ds.RasterYSize
        ds = None
    finally:
        gdal.Unlink(name)
    if w != hgt:
        raise PipelineError(f"tiles of {path} are {w} by {hgt} pixels, not square")
    return w


# ---------------------------------------------------------------- metadata

DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def source_entry(key, data_date=None, name_suffix="", **fields):
    """One entry of the metadata 'sources' list, from pipeline/sources.json.
    Placeholders such as {year} in the name and credit are filled from fields."""
    s = read_json(os.path.join(PIPELINE, "sources.json"))[key]
    date = data_date or s.get("dataDate")
    if not date:
        raise PipelineError(f"no data date for source {key}")
    return {"name": s["name"].format(**fields) + name_suffix, "license": s["license"],
            "credit": s["credit"].format(**fields), "url": s["url"], "dataDate": date}


def make_meta(layer, county, archive, sources, notes, bounds=None, provenance=None, coverage=None):
    """Metadata for an archive. For raster archives, tileSize is read back
    from a decoded tile. coverage, when given, is the area the archive's data
    covers, as a GeoJSON geometry (see coverage_geometry)."""
    spec = LAYERS[layer]
    meta = {
        "schema": 1,
        "layer": layer,
        "county": county["id"],
        "countyName": county_label(county),
        "kind": spec["kind"],
        "title": spec["title"],
        "minzoom": spec["minzoom"],
        "maxzoom": spec["maxzoom"],
        "bounds": bounds or outline_bounds(county),
        "bytes": os.path.getsize(archive),
        "buildDate": datetime.date.today().isoformat(),
        "sources": sources,
        "notes": notes,
    }
    if spec["kind"] == "raster":
        meta["tileSize"] = raster_tile_size(archive)
    if coverage:
        meta["coverage"] = coverage
    if provenance:
        meta["provenance"] = provenance
    return meta


def validate_meta(meta, archive=None):
    """Check a metadata object against the contract in pipeline/README.md.
    Returns a list of problems; empty means valid."""
    p = []
    allowed = {"schema", "layer", "county", "countyName", "kind", "title", "minzoom", "maxzoom",
               "bounds", "bytes", "buildDate", "sources", "notes", "provenance", "tileSize", "coverage"}
    required = allowed - {"provenance", "tileSize", "coverage"}
    for k in sorted(required - meta.keys()):
        p.append(f"missing '{k}'")
    for k in sorted(meta.keys() - allowed):
        p.append(f"unexpected field '{k}'")
    if p:
        return p
    if meta["schema"] != 1:
        p.append("schema must be 1")
    spec = LAYERS.get(meta["layer"])
    if not spec:
        p.append(f"unknown layer '{meta['layer']}'")
    else:
        for k in ("kind", "minzoom", "maxzoom"):
            if meta[k] != spec[k]:
                p.append(f"{k} is {meta[k]!r}, the contract says {spec[k]!r}")
        if spec["kind"] == "raster":
            ts = meta.get("tileSize")
            if not isinstance(ts, int) or ts <= 0:
                p.append("tileSize is required for raster archives and must be a positive integer")
            elif archive and raster_tile_size(archive) != ts:
                p.append(f"tileSize is {ts} but a decoded tile is {raster_tile_size(archive)} pixels")
        elif "tileSize" in meta:
            p.append("tileSize must be absent for vector archives")
    try:
        c = get_county(meta["county"])
        if meta["countyName"] != county_label(c):
            p.append(f"countyName '{meta['countyName']}' does not match '{county_label(c)}'")
    except PipelineError as e:
        p.append(str(e))
    if not isinstance(meta["title"], str) or not meta["title"]:
        p.append("title must be a non-empty string")
    b = meta["bounds"]
    if not (isinstance(b, list) and len(b) == 4 and all(isinstance(v, (int, float)) for v in b)
            and -180 <= b[0] < b[2] <= 180 and -90 <= b[1] < b[3] <= 90):
        p.append(f"bounds {b} must be [west, south, east, north] in degrees")
    if not isinstance(meta["bytes"], int) or meta["bytes"] <= 0:
        p.append("bytes must be a positive integer")
    elif archive and os.path.getsize(archive) != meta["bytes"]:
        p.append(f"bytes is {meta['bytes']} but the archive is {os.path.getsize(archive)}")
    if not (isinstance(meta["buildDate"], str) and DATE_RE.fullmatch(meta["buildDate"])):
        p.append("buildDate must be YYYY-MM-DD")
    if not isinstance(meta["sources"], list) or not meta["sources"]:
        p.append("sources must be a non-empty list")
    else:
        for i, s in enumerate(meta["sources"]):
            for k in ("name", "license", "credit", "url", "dataDate"):
                if not isinstance(s.get(k), str) or not s.get(k):
                    p.append(f"sources[{i}].{k} must be a non-empty string")
            if isinstance(s.get("dataDate"), str) and not DATE_RE.fullmatch(s["dataDate"]):
                p.append(f"sources[{i}].dataDate must be YYYY-MM-DD")
            extra = s.keys() - {"name", "license", "credit", "url", "dataDate"}
            if extra:
                p.append(f"sources[{i}] has unexpected fields {sorted(extra)}")
    if not isinstance(meta["notes"], str):
        p.append("notes must be a string")
    if "provenance" in meta and not isinstance(meta["provenance"], dict):
        p.append("provenance must be an object")
    if "coverage" in meta:
        p.extend(validate_coverage(meta["coverage"], b if isinstance(b, list) and len(b) == 4 else None))

    if archive and spec:
        h = pmtiles_header(archive)
        want_type = "mvt" if spec["kind"] == "vector" else "webp"
        if h.get("tile_type") != want_type:
            p.append(f"archive tile type is {h.get('tile_type')}, expected {want_type}")
        if spec["kind"] == "vector" and h.get("tile_compression") != "gzip":
            p.append(f"archive tile compression is {h.get('tile_compression')}, expected gzip")
        if h.get("minzoom") != spec["minzoom"] or h.get("maxzoom") != spec["maxzoom"]:
            p.append(f"archive zooms are {h.get('minzoom')} to {h.get('maxzoom')}, expected {spec['minzoom']} to {spec['maxzoom']}")
        hb = h.get("bounds")
        if hb and isinstance(b, list) and len(b) == 4:
            if hb[0] > b[0] + 1e-3 or hb[1] > b[1] + 1e-3 or hb[2] < b[2] - 1e-3 or hb[3] < b[3] - 1e-3:
                p.append(f"archive bounds {hb} do not cover metadata bounds {b}")
    return p


def write_meta(path, meta, archive):
    problems = validate_meta(meta, archive)
    if problems:
        raise PipelineError("metadata does not match the contract:\n  " + "\n  ".join(problems))
    atomic_write_json(path, meta)


# ---------------------------------------------------------------- command line

def main(argv):
    ap = argparse.ArgumentParser(prog="mapdata.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("county-field")
    a.add_argument("county")
    a.add_argument("field")
    a = sub.add_parser("outline")
    a.add_argument("county")
    a = sub.add_parser("bounds")
    a.add_argument("county")
    a = sub.add_parser("write-meta")
    a.add_argument("--layer", required=True)
    a.add_argument("--county", required=True)
    a.add_argument("--archive", required=True)
    a.add_argument("--out", required=True)
    a.add_argument("--sources", required=True, help="JSON list of [source key, data date] pairs")
    a.add_argument("--notes", required=True)
    a.add_argument("--provenance", default=None, help="JSON object")
    a = sub.add_parser("validate-meta")
    a.add_argument("meta")
    a.add_argument("archive", nargs="?")
    args = ap.parse_args(argv)

    if args.cmd == "county-field":
        print(get_county(args.county)[args.field])
    elif args.cmd == "outline":
        print(county_outline(get_county(args.county))[0])
    elif args.cmd == "bounds":
        print(",".join(str(v) for v in outline_bounds(get_county(args.county))))
    elif args.cmd == "write-meta":
        county = get_county(args.county)
        sources = [source_entry(k, d) for k, d in json.loads(args.sources)]
        prov = json.loads(args.provenance) if args.provenance else None
        meta = make_meta(args.layer, county, args.archive, sources, args.notes, provenance=prov)
        write_meta(args.out, meta, args.archive)
    elif args.cmd == "validate-meta":
        problems = validate_meta(read_json(args.meta), args.archive)
        if problems:
            print("INVALID: " + args.meta)
            for x in problems:
                print("  " + x)
            return 1
        print("valid: " + args.meta)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except PipelineError as e:
        log(f"error: {e}")
        sys.exit(1)
