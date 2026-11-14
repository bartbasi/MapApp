# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Layer 'aerial': natural color NAIP imagery, WebP 512 px tiles, zoom 7 to 16.

Images come from the cloud-optimized GeoTIFF copies of NAIP on the Microsoft
Planetary Computer (anonymous access with a free SAS token). The newest year
that covers the county is used; ground it does not cover is filled from the
newest earlier year that does. Each image is read at the overview level
nearest 1.2 m and saved, three color bands, under data/cache/naip/.

Raster archives are clipped to the county outline plus CLIP_MARGIN_M and are
transparent outside it (see pipeline/README.md).

Usage: python3 -I pipeline/layers/aerial.py <county-id>   (normally via build.sh)
"""

import collections
import concurrent.futures
import datetime
import glob
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time

sys.dont_write_bytecode = True   # keep __pycache__ out of the repository
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
import mapdata as md  # noqa: E402

LAYER = "aerial"
STAC_SEARCH = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
STAC_COLLECTION = "naip"
SAS_TOKEN_URL = "https://planetarycomputer.microsoft.com/api/sas/v1/token/naip"

TARGET_GSD = 1.2          # metres; read each image at the overview level nearest this
CLIP_MARGIN_M = 300       # clip to the county outline plus this, so neighbours overlap
MIN_GAP_M2 = 10_000       # ground left uncovered by a year below this is ignored
WEBP_QUALITY = 78
TILE_SIZE = 512
DOWNLOADS_AT_ONCE = 2
MAX_GB = float(os.environ.get("AERIAL_MAX_GB", "15"))   # stop if one county would transfer more
CACHE_JPEG_QUALITY = 90
WINDOW_MARGIN_M = 150     # read this much past the ground an image is needed for

gdal, ogr, osr = md.gdal_modules()
log = md.log
CACHE = os.path.join(md.CACHE, "naip")

GDAL_ENV = dict(os.environ,
                GDAL_HTTP_USERAGENT=md.USER_AGENT,
                GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
                GDAL_HTTP_MAX_RETRY="6",
                GDAL_HTTP_RETRY_DELAY="10",
                GDAL_HTTP_MULTIRANGE="YES",
                GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
                GDAL_CACHEMAX="512",
                GDAL_NUM_THREADS="2")


def run(cmd, **kw):
    subprocess.run(cmd, check=True, env=GDAL_ENV, **kw)


def rx_bytes():
    """Bytes received by this machine's network interfaces (WSL side)."""
    total = 0
    for p in glob.glob("/sys/class/net/*/statistics/rx_bytes"):
        if "/lo/" not in p:
            with open(p) as f:
                total += int(f.read())
    return total


# ------------------------------------------------------------------ finding images

def stac_items(county, clip):
    """All NAIP items that touch the clip area, cached per county."""
    path = os.path.join(CACHE, f"{county['id']}.stac.json")
    if md.cached(path):
        items = md.read_json(path)
        if items and "bbox_proj" in items[0]:
            return items
    query = md.polygonal_simplify(clip)
    body = {"collections": [STAC_COLLECTION], "intersects": json.loads(query.ExportToJson()), "limit": 500}
    url, items = STAC_SEARCH, []
    log("Searching the NAIP catalog on the Planetary Computer")
    while url:
        res = json.loads(md.http(url, json_body=body))
        items += res.get("features", [])
        nxt = [link for link in res.get("links", []) if link.get("rel") == "next"]
        url = nxt[0]["href"] if nxt else None
        if nxt:
            body = nxt[0].get("body", body)
    slim = [{"id": i["id"], "year": int(i["properties"]["naip:year"]), "gsd": i["properties"].get("gsd"),
             "datetime": i["properties"]["datetime"],
             "epsg": i["properties"].get("proj:code") or i["properties"].get("proj:epsg"),
             "bbox_proj": i["properties"].get("proj:bbox"),
             "href": i["assets"]["image"]["href"], "geometry": i["geometry"]} for i in items]
    md.atomic_write_json(path, slim)
    log(f"  {len(slim)} items in years {sorted({i['year'] for i in slim})}")
    return slim


def choose_items(items, clip):
    """Newest year first; older years only for ground the newer ones miss."""
    def quad(item):
        m = re.search(r"m_\d{7}_(ne|nw|se|sw)", item["id"])
        return m.group(0) if m else item["id"]

    newest = {}
    for it in items:   # one image per quarter-quad and year: the latest flight
        k = (it["year"], quad(it))
        if k not in newest or it["datetime"] > newest[k]["datetime"]:
            newest[k] = it
    by_year = collections.defaultdict(list)
    for it in newest.values():
        g = ogr.CreateGeometryFromJson(json.dumps(it["geometry"]))
        g.AssignSpatialReference(md.wgs84())
        it["_geom"] = g
        by_year[it["year"]].append(it)

    remaining = clip.Clone()
    chosen, per_year = [], collections.OrderedDict()
    for year in sorted(by_year, reverse=True):
        if remaining.IsEmpty() or remaining.GeodesicArea() < MIN_GAP_M2:
            break
        use = []
        for it in by_year[year]:
            if it["_geom"].Intersects(remaining):
                part = it["_geom"].Intersection(remaining)
                part.AssignSpatialReference(md.wgs84())
                if not part.IsEmpty() and part.GeodesicArea() >= MIN_GAP_M2:
                    use.append(it)
        if not use:
            continue
        for it in use:   # the ground this image is needed for
            it["_need"] = it["_geom"].Intersection(remaining)
            it["_need"].AssignSpatialReference(md.wgs84())
        cover = ogr.Geometry(ogr.wkbMultiPolygon)
        for it in use:
            g = it["_geom"]
            for i in range(g.GetGeometryCount()) if g.GetGeometryType() == ogr.wkbMultiPolygon else [None]:
                cover.AddGeometry(g.GetGeometryRef(i) if i is not None else g)
        remaining = remaining.Difference(cover.UnionCascaded())
        remaining.AssignSpatialReference(md.wgs84())
        chosen += use
        per_year[year] = use
        gap = 0 if remaining.IsEmpty() else remaining.GeodesicArea()
        log(f"  NAIP {year}: {len(use)} images; ground still uncovered: {gap / 1e6:.3f} km2")
    gap = 0 if remaining.IsEmpty() else remaining.GeodesicArea()
    return chosen, per_year, gap


# ------------------------------------------------------------------ downloads

class Token:
    """The Planetary Computer's anonymous SAS token, renewed before it expires."""

    def __init__(self):
        self.lock = threading.Lock()
        self.value, self.expiry = None, datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)

    def get(self):
        with self.lock:
            now = datetime.datetime.now(datetime.timezone.utc)
            if not self.value or self.expiry - now < datetime.timedelta(minutes=15):
                res = json.loads(md.http(SAS_TOKEN_URL))
                self.value = res["token"]
                self.expiry = datetime.datetime.fromisoformat(res["msft:expiry"].replace("Z", "+00:00"))
            return self.value


def cached_image(item):
    return os.path.join(CACHE, str(item["year"]), item["id"] + ".tif")


def needed_window(item):
    """The part of the image to read, [minx, miny, maxx, maxy] in the image's
    own CRS: the ground it is needed for plus WINDOW_MARGIN_M, or None for the
    whole image. Edge images and images that only fill a gap are read in part."""
    if not item.get("bbox_proj") or not item.get("epsg"):
        return None
    srs = osr.SpatialReference()
    srs.SetFromUserInput(crs_code(item))
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    g = item["_need"].Clone()
    g.Transform(osr.CoordinateTransformation(md.wgs84(), srs))
    minx, maxx, miny, maxy = g.GetEnvelope()
    bx0, by0, bx1, by1 = item["bbox_proj"]
    w = [max(bx0, minx - WINDOW_MARGIN_M), max(by0, miny - WINDOW_MARGIN_M),
         min(bx1, maxx + WINDOW_MARGIN_M), min(by1, maxy + WINDOW_MARGIN_M)]
    if (w[2] - w[0]) * (w[3] - w[1]) >= 0.9 * (bx1 - bx0) * (by1 - by0):
        return None
    return [round(v) for v in w]


def crs_code(item):
    """The image's CRS as 'EPSG:n'. The catalog gives 'EPSG:26916' (proj:code)
    for some years and a bare 26916 (proj:epsg) for others."""
    v = str(item.get("epsg") or "")
    return v if not v or ":" in v else f"EPSG:{v}"


def is_cached(item):
    """A saved image serves if it holds at least the window needed now.
    An image saved without a window record is a whole image."""
    out = cached_image(item)
    if not os.path.exists(out):
        return False
    side = out + ".json"
    have = md.read_json(side).get("window") if os.path.exists(side) else None
    if have is None:
        return True
    need = item["_window"]
    return need is not None and have[0] <= need[0] and have[1] <= need[1] and have[2] >= need[2] and have[3] >= need[3]


def fetch_image(item, token):
    """Save one image's overview level nearest TARGET_GSD, bands 1 to 3."""
    out = cached_image(item)
    if is_cached(item):
        return "cached"
    window = item["_window"]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    src = f"/vsicurl/{item['href']}?{token.get()}"
    info = json.loads(subprocess.run(["gdalinfo", "-json", "-nomd", src], check=True, capture_output=True,
                                     text=True, env=GDAL_ENV).stdout)
    width = info["size"][0]
    gsd = float(item.get("gsd") or abs(info["geoTransform"][1]))
    want = TARGET_GSD / gsd
    ovr = None
    if want > 1.4:
        sizes = [o["size"][0] for o in info["bands"][0].get("overviews", [])]
        if sizes:
            ovr = min(range(len(sizes)), key=lambda i: abs(width / sizes[i] - want))
    tmp = out + f".part-{os.getpid()}-{threading.get_ident()}.tif"
    cmd = ["gdal_translate", "-q", "-b", "1", "-b", "2", "-b", "3",
           "-co", "COMPRESS=JPEG", "-co", f"JPEG_QUALITY={CACHE_JPEG_QUALITY}", "-co", "PHOTOMETRIC=YCBCR",
           "-co", "TILED=YES", "-co", "BLOCKXSIZE=512", "-co", "BLOCKYSIZE=512"]
    if ovr is not None:
        cmd += ["-ovr", str(ovr)]
    if window is not None:
        cmd += ["-projwin", str(window[0]), str(window[3]), str(window[2]), str(window[1])]
    try:
        run(cmd + [f"/vsicurl/{item['href']}?{token.get()}", tmp])
        # The window record first: an image without one counts as whole.
        md.atomic_write_json(out + ".json", {"window": window, "overview": ovr, "href": item["href"]})
        os.replace(tmp, out)
    finally:
        for f in (tmp, tmp + ".aux.xml"):
            if os.path.exists(f):
                os.remove(f)
    return ("ovr" + ("none" if ovr is None else str(ovr))) + (", part" if window else ", whole")


def fetch_all(chosen):
    for f in glob.glob(os.path.join(CACHE, "*", "*.part-*")):   # left by an interrupted run
        os.remove(f)
    for it in chosen:   # computed here, once, before the download threads start
        it["_window"] = needed_window(it)
    todo = [it for it in chosen if not is_cached(it)]
    log(f"Images: {len(chosen)} needed, {len(chosen) - len(todo)} already cached, {len(todo)} to download")
    if not todo:
        return 0
    md.wait_for_quiet_machine("downloading images")
    token = Token()
    start_bytes, start = rx_bytes(), time.time()
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=DOWNLOADS_AT_ONCE) as pool:
        futures = {pool.submit(fetch_image, it, token): it for it in todo}
        try:
            for fut in concurrent.futures.as_completed(futures):
                it = futures[fut]
                how = fut.result()
                done += 1
                got = rx_bytes() - start_bytes
                projected = got / done * len(todo)
                log(f"  [{done}/{len(todo)}] {it['id']} ({how}, {os.path.getsize(cached_image(it)) / 1e6:.1f} MB saved); "
                    f"{got / 1e9:.2f} GB received, about {projected / 1e9:.1f} GB projected, {time.time() - start:.0f} s")
                if done >= 4 and projected > MAX_GB * 1e9:
                    for f in futures:
                        f.cancel()
                    raise md.PipelineError(
                        f"projected transfer {projected / 1e9:.1f} GB is over the {MAX_GB} GB limit for one county. "
                        f"Stopped. Images saved so far are kept; set AERIAL_MAX_GB to allow more.")
        except BaseException:
            for f in futures:
                f.cancel()
            raise
    return rx_bytes() - start_bytes


# ------------------------------------------------------------------ tiles

def z_res(z):
    """Web Mercator metres per pixel at zoom z for TILE_SIZE pixel tiles."""
    return 2 * 20037508.342789244 / (2 ** z * TILE_SIZE)


def build_tiles(county, chosen, clip_path, clip, work, spec):
    """Mosaic in Web Mercator at the zoom 16 grid, then tiles with GDAL's
    tiler (two threads), packed into an MBTiles file."""
    # The cutline is the clip area simplified to about 5 m: far fewer
    # vertices to test for every block, with no visible difference.
    cut = clip.SimplifyPreserveTopology(0.00005)
    cut_path = os.path.join(work, "cutline.geojson")
    with open(cut_path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {}, "geometry": json.loads(cut.ExportToJson())}]}, f)
    to_merc = osr.CoordinateTransformation(md.wgs84(), merc())
    c = clip.Clone()
    c.Transform(to_merc)
    minx, maxx, miny, maxy = c.GetEnvelope()
    res = z_res(spec["maxzoom"])
    # One warped mosaic per (year, CRS), oldest year first, so newer years lie
    # on top (gdalbuildvrt composites them by their alpha bands).
    groups = collections.defaultdict(list)
    for it in chosen:
        groups[(it["year"], crs_code(it))].append(it)
    warped = []
    for n, key in enumerate(sorted(groups)):
        files = [cached_image(it) for it in sorted(groups[key], key=lambda i: i["datetime"])]
        listfile = os.path.join(work, f"g{n}.txt")
        with open(listfile, "w") as f:
            f.write("\n".join(files) + "\n")
        vrt = os.path.join(work, f"g{n}.vrt")
        run(["gdalbuildvrt", "-q", "-addalpha", "-input_file_list", listfile, vrt])
        wvrt = os.path.join(work, f"g{n}_3857.vrt")
        run(["gdalwarp", "-q", "-overwrite", "-of", "VRT", "-t_srs", "EPSG:3857",
             "-tr", repr(res), repr(res), "-tap", "-te", repr(minx), repr(miny), repr(maxx), repr(maxy),
             "-r", "bilinear", "-cutline", cut_path, "-dstalpha", "-wm", "256",
             "-co", f"BLOCKXSIZE={TILE_SIZE}", "-co", f"BLOCKYSIZE={TILE_SIZE}", vrt, wvrt])
        warped.append(wvrt)
        log(f"  mosaic {n}: NAIP {key[0]}, {key[1]}, {len(files)} images")
    final_vrt = os.path.join(work, "mosaic.vrt")
    run(["gdalbuildvrt", "-q", final_vrt] + warped)

    tiles = os.path.join(work, "tiles")
    md.wait_for_quiet_machine("writing tiles")
    t = time.time()
    log(f"Writing tiles, zoom {spec['minzoom']} to {spec['maxzoom']} (WebP quality {WEBP_QUALITY}, {TILE_SIZE} px, "
        f"bilinear at zoom {spec['maxzoom']}, cubic below)")
    run(["gdal", "raster", "tile", "-q", "-f", "WEBP", "--co", f"QUALITY={WEBP_QUALITY}",
         "--tile-size", str(TILE_SIZE), "--min-zoom", str(spec["minzoom"]), "--max-zoom", str(spec["maxzoom"]),
         "-r", "bilinear", "--overview-resampling", "cubic", "--skip-blank", "--webviewer", "none",
         "-j", "2", "--parallel-method", "thread", final_vrt, tiles])
    log(f"  done in {time.time() - t:.0f} s")

    # Pack the z/x/y.webp files into MBTiles (rows counted from the bottom).
    mbt = os.path.join(work, "aerial.mbtiles")
    con = sqlite3.connect(mbt)
    con.execute("create table metadata (name text, value text)")
    con.execute("create table tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)")
    per_zoom = collections.Counter()
    for path in glob.glob(os.path.join(tiles, "*", "*", "*.webp")):
        z, x, y = (int(v) for v in os.path.relpath(path, tiles)[:-5].split(os.sep))
        with open(path, "rb") as f:
            con.execute("insert into tiles values (?, ?, ?, ?)", (z, x, (2 ** z - 1) - y, f.read()))
        per_zoom[z] += 1
    con.execute("create unique index tile_index on tiles (zoom_level, tile_column, tile_row)")
    w, e, s, n_ = clip.GetEnvelope()[0], clip.GetEnvelope()[1], clip.GetEnvelope()[2], clip.GetEnvelope()[3]
    for k, v in (("name", f"Aerial imagery, {md.county_label(county)}"), ("format", "webp"), ("type", "overlay"),
                 ("minzoom", str(min(per_zoom))), ("maxzoom", str(max(per_zoom))),
                 ("bounds", f"{w:.6f},{s:.6f},{e:.6f},{n_:.6f}")):
        con.execute("insert into metadata values (?, ?)", (k, v))
    con.commit()
    con.close()
    if (min(per_zoom), max(per_zoom)) != (spec["minzoom"], spec["maxzoom"]):
        raise md.PipelineError(f"tiles span zoom {min(per_zoom)} to {max(per_zoom)}, expected {spec['minzoom']} to {spec['maxzoom']}")
    log(f"  tiles per zoom: {dict(sorted(per_zoom.items()))}")
    return mbt, dict(per_zoom)


def merc():
    s = osr.SpatialReference()
    s.ImportFromEPSG(3857)
    s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return s


# ------------------------------------------------------------------ build

def build(county_id):
    t0 = time.time()
    county = md.get_county(county_id)
    spec = md.LAYERS[LAYER]
    out_dir = os.environ.get("OUT_DIR") or os.path.join(md.BUILD, county_id)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)

    _, outline_prov = md.county_outline(county)
    outline = md.outline_geometry(county)
    clip = md.buffer_meters(outline, CLIP_MARGIN_M)
    clip_path = os.path.join(CACHE, f"{county_id}.clip.geojson")
    md.atomic_write_json(clip_path, {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {}, "geometry": json.loads(clip.ExportToJson())}]})

    items = stac_items(county, clip)
    chosen, per_year, gap = choose_items(items, clip)
    if not chosen:
        raise md.PipelineError("no NAIP images cover this county")
    if gap >= MIN_GAP_M2:
        log(f"warning: {gap / 1e6:.3f} km2 of the clip area has no NAIP image in any year")
    received = fetch_all(chosen)

    work = tempfile.mkdtemp(prefix="aerial-")
    try:
        mbt, per_zoom = build_tiles(county, chosen, clip_path, clip, work, spec)
        tmp_out = os.path.join(out_dir, f".{LAYER}.pmtiles.tmp-{os.getpid()}")
        subprocess.run([md.PMTILES, "convert", mbt, tmp_out], check=True, capture_output=True)
        final = os.path.join(out_dir, f"{LAYER}.pmtiles")
        os.replace(tmp_out, final)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    log(f"Wrote {final} ({os.path.getsize(final)} bytes)")
    log("\n".join(subprocess.run([md.PMTILES, "show", final], capture_output=True, text=True).stdout.splitlines()[:13]))

    sources, years = [], {}
    for year, use in per_year.items():
        dates = sorted(it["datetime"][:10] for it in use)
        years[str(year)] = {"images": len(use), "flown": [dates[0], dates[-1]],
                            "gsd": sorted({it["gsd"] for it in use})}
        sources.append(md.source_entry("naip", dates[-1], name_suffix=f", flown {dates[0]} to {dates[-1]}", year=year))
    notes = (f"Summer, leaf-on imagery, built from the {TARGET_GSD} m level of each NAIP image, so it is less sharp than "
             f"NAIP's full detail. Clipped to the county outline plus about {CLIP_MARGIN_M} m and transparent beyond it.")
    if len(per_year) > 1:
        older = [str(y) for y in list(per_year)[1:]]
        notes += (f" Where the newest year ({list(per_year)[0]}) has no image, {' and '.join(older)} imagery fills in, "
                  f"so colors and season can change at those edges.")
    prov = {
        "imagesPerYear": {y: v["images"] for y, v in years.items()},
        "years": years,
        "catalog": f"Microsoft Planetary Computer STAC, collection '{STAC_COLLECTION}' (cloud-optimized GeoTIFF copies of NAIP)",
        "level": f"overview nearest {TARGET_GSD} m, bands 1 to 3",
        "uncoveredSquareKm": round(gap / 1e6, 3),
        "bytesReceivedThisRun": received,
        "tilesPerZoom": {str(k): v for k, v in sorted(per_zoom.items())},
        "tiles": f"WebP quality {WEBP_QUALITY}, {TILE_SIZE} px; zoom {spec['maxzoom']} bilinear from the mosaic, lower zooms cubic (gdal raster tile)",
        "clip": f"county outline plus {CLIP_MARGIN_M} m",
        "countyOutline": outline_prov,
    }
    meta = md.make_meta(LAYER, county, final, sources, notes, provenance=prov)
    md.write_meta(os.path.join(out_dir, f"{LAYER}.meta.json"), meta, final)
    log(f"Wrote {os.path.join(out_dir, LAYER + '.meta.json')}")
    log(f"Images per year: {prov['imagesPerYear']}; received this run: {received / 1e9:.2f} GB; "
        f"total time {time.time() - t0:.0f} s")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        log("usage: python3 -I pipeline/layers/aerial.py <county-id>")
        sys.exit(2)
    try:
        build(sys.argv[1])
    except md.PipelineError as e:
        log(f"error: {e}")
        sys.exit(1)
