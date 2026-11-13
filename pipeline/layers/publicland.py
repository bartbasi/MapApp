# MapApp. Copyright 2026 Play, Inc.
# Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
"""Layer 'publicland': public land boundaries and managers, zoom 6 to 14.

Source: USGS PAD-US 4.1 (public domain), from the USGS feature service, with
corrections from open datasets listed in publicland-mapping.json (the regional
planning commission's open spaces, ODbL) where they have land of a listed
manager. All mapping tables are in publicland-mapping.json.

Usage: python3 -I pipeline/layers/publicland.py <county-id>   (normally via build.sh)
"""

import collections
import datetime
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True   # keep __pycache__ out of the repository
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
import mapdata as md  # noqa: E402

LAYER = "publicland"
PADUS_LAYER = "https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Manager_Name_PADUS/FeatureServer/0"

# Features are fetched for every tile at the layer's lowest zoom that touches
# the county, plus a margin for tippecanoe's tile buffer. That makes every
# tile in the archive complete (contract rule 1).
MARGIN_DEG = 0.003
# A feature first appears at the zoom where it is at least this many 256 px
# tile pixels across, and from FULL_ZOOM on whatever its size.
MIN_PIXELS = 2
FULL_ZOOM = 12
ACRE_M2 = 4046.8564224

gdal, ogr, osr = md.gdal_modules()
log = md.log


# ------------------------------------------------------------------ geometry

def polygonal(g):
    """Valid MultiPolygon from any geometry, or None if nothing polygonal is left."""
    if g is None:
        return None
    gdal.PushErrorHandler("CPLQuietErrorHandler")   # GEOS explains each invalid shape; MakeValid repairs it
    try:
        if not g.IsValid():
            g = g.MakeValid()
    finally:
        gdal.PopErrorHandler()
    out = ogr.Geometry(ogr.wkbMultiPolygon)
    t = ogr.GT_Flatten(g.GetGeometryType())
    if t == ogr.wkbPolygon:
        out.AddGeometry(g)
    elif t in (ogr.wkbMultiPolygon, ogr.wkbGeometryCollection):
        for i in range(g.GetGeometryCount()):
            part = polygonal(g.GetGeometryRef(i))
            if part:
                for j in range(part.GetGeometryCount()):
                    out.AddGeometry(part.GetGeometryRef(j))
    if out.GetGeometryCount() == 0:
        return None
    out.AssignSpatialReference(md.wgs84())
    return out


def from_geojson(geom):
    if not geom:
        return None
    g = ogr.CreateGeometryFromJson(json.dumps(geom))
    g.FlattenTo2D()
    g.AssignSpatialReference(md.wgs84())
    return polygonal(g)


def acres(g):
    return g.GeodesicArea() / ACRE_M2


def covered_share(g, cover):
    """Share of g's area that lies under cover (planar ratio, fine at this scale)."""
    if cover is None or g.Area() == 0 or not g.Intersects(cover):
        return 0.0
    return g.Intersection(cover).Area() / g.Area()


def union(geoms):
    geoms = [g for g in geoms if g is not None]
    if not geoms:
        return None
    m = ogr.Geometry(ogr.wkbMultiPolygon)
    for g in geoms:
        for i in range(g.GetGeometryCount()):
            m.AddGeometry(g.GetGeometryRef(i))
    return m.UnionCascaded()


def feature_minzoom(g, minzoom, full_zoom):
    """Zoom where the feature's largest part is MIN_PIXELS wide, kept between
    minzoom and full_zoom. Parts, not the whole, because some PAD-US records
    bundle small parks that lie far apart."""
    r = 6378137.0

    def merc_y(lat):
        lat = max(min(lat, 85.0511), -85.0511)
        return r * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    size = 0.0
    for i in range(g.GetGeometryCount()):
        minx, maxx, miny, maxy = g.GetGeometryRef(i).GetEnvelope()
        size = max(size, r * math.radians(maxx - minx), merc_y(maxy) - merc_y(miny))
    if size <= 0:
        return full_zoom
    z = math.ceil(math.log2(156543.03392804097 * MIN_PIXELS / size))
    return max(minzoom, min(full_zoom, z))


def esri_polygon(g):
    """OGR polygon to ArcGIS JSON, outer rings clockwise."""
    rings = []
    for i in range(g.GetGeometryCount()):
        poly = g.GetGeometryRef(i) if ogr.GT_Flatten(g.GetGeometryType()) == ogr.wkbMultiPolygon else g
        for j in range(poly.GetGeometryCount()):
            pts = [[round(x, 6), round(y, 6)] for x, y in (p[:2] for p in poly.GetGeometryRef(j).GetPoints())]
            signed = sum(pts[k][0] * pts[k + 1][1] - pts[k + 1][0] * pts[k][1] for k in range(len(pts) - 1))
            clockwise = signed < 0
            if (j == 0) != clockwise:
                pts.reverse()
            rings.append(pts)
        if ogr.GT_Flatten(g.GetGeometryType()) != ogr.wkbMultiPolygon:
            break
    return {"rings": rings, "spatialReference": {"wkid": 4326}}


# ------------------------------------------------------------------ downloads

def query_area(county):
    outline = md.outline_geometry(county)
    cover, ntiles = md.tile_cover(outline, md.LAYERS[LAYER]["minzoom"])
    area = cover.Buffer(MARGIN_DEG, 1)
    area.AssignSpatialReference(md.wgs84())
    return outline, area, ntiles


def fetch_padus(county, area):
    """PAD-US features intersecting the query area, cached per county and area."""
    d = os.path.join(md.CACHE, "padus")
    path = os.path.join(d, f"{county['id']}.geojson")
    side = os.path.join(d, f"{county['id']}.query.json")
    geometry = json.dumps(esri_polygon(area), separators=(",", ":"))
    key = hashlib.sha256((PADUS_LAYER + geometry).encode()).hexdigest()[:16]
    if md.cached(path) and os.path.exists(side) and md.read_json(side).get("key") == key:
        log(f"Reusing cached PAD-US features {path}")
        return md.read_json(path), md.read_json(side)

    log(f"Querying PAD-US 4.1 ({PADUS_LAYER})")
    info = md.arcgis_json(PADUS_LAYER)
    base = {"geometry": geometry, "geometryType": "esriGeometryPolygon", "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects", "where": "1=1"}
    count = md.arcgis_query(PADUS_LAYER, dict(base, returnCountOnly="true", f="json"))["count"]
    page = min(int(info.get("maxRecordCount") or 1000), 1000)
    feats, seen = [], set()
    offset = 0
    while offset < count:
        res = md.arcgis_query(PADUS_LAYER, dict(base, outFields="*", returnGeometry="true", outSR="4326",
                                                orderByFields="OBJECTID", resultOffset=str(offset),
                                                resultRecordCount=str(page), f="geojson"))
        got = res.get("features", [])
        if not got:
            break
        for f in got:
            oid = f["properties"]["OBJECTID"]
            if oid not in seen:
                seen.add(oid)
                feats.append(f)
        offset += len(got)
    if len(feats) != count:
        raise md.PipelineError(f"PAD-US returned {len(feats)} features, the count query said {count}")
    fc = {"type": "FeatureCollection", "features": feats}
    meta = {"key": key, "service": PADUS_LAYER, "layerName": info.get("name"),
            "dataLastEditDate": (info.get("editingInfo") or {}).get("dataLastEditDate"),
            "fetched": datetime.date.today().isoformat(), "count": count}
    md.atomic_write_json(path, fc)
    md.atomic_write_json(side, meta)
    log(f"  {count} features, {os.path.getsize(path)} bytes, saved to {path}")
    return fc, meta


def fetch_correction(corr):
    """Download (once) the correction dataset named in the mapping file."""
    d = os.path.join(md.CACHE, corr["source"])
    path = os.path.join(d, "data.geojson")
    side = os.path.join(d, "source.json")
    if md.cached(path) and os.path.exists(side):
        return md.read_json(path), md.read_json(side)
    log(f"Downloading correction dataset '{corr['source']}'")
    pkg = json.loads(md.http(corr["ckanPackageApi"]))["result"]
    res = [r for r in pkg["resources"] if (r.get("format") or "").lower() == corr["resourceFormat"].lower()]
    if len(res) != 1:
        raise md.PipelineError(f"expected one {corr['resourceFormat']} resource in {corr['ckanPackageApi']}, found {len(res)}")
    body = md.http(res[0]["url"])
    data = json.loads(body)
    meta = {"package": pkg.get("name"), "title": pkg.get("title"), "license": pkg.get("license_title"),
            "metadataModified": pkg.get("metadata_modified"), "resourceUrl": res[0]["url"].split("?")[0],
            "fetched": datetime.date.today().isoformat(), "features": len(data.get("features", []))}
    md.atomic_write_bytes(path, body)
    md.atomic_write_json(side, meta)
    log(f"  {meta['features']} features, {len(body)} bytes, saved to {path}")
    return data, meta


# ------------------------------------------------------------------ mapping

class Mapper:
    def __init__(self, mapping, county):
        self.m = mapping
        self.county = county
        self.unmapped = collections.Counter()   # names that fell back to the code table
        self.passed = set()                     # local names used exactly as PAD-US gives them

    def manager(self, p):
        raw = re.sub(r"\s+", " ", (p.get("Loc_Mang") or "").replace(", <Null>", "")).strip()
        names = self.m["managerNames"]
        if raw in names:
            name = names[raw]
        else:
            name = raw
            for rule in self.m["managerNamePatterns"]:
                mt = re.match(rule["pattern"], raw)
                if mt:
                    name = rule["replace"]
                    for i, grp in enumerate(mt.groups(), 1):
                        name = name.replace("{%d}" % i, grp[:1].upper() + grp[1:])
                    break
            else:
                if raw and raw not in self.m["unknownManagerValues"]:
                    self.passed.add(raw)
        if not name or name in self.m["unknownManagerValues"]:
            code = p.get("Mang_Name") or "UNK"
            name = self.m["managerByCode"].get(code, self.m["managerByCode"]["UNK"])
            self.unmapped[f"from code {code}: {name} (Loc_Mang '{raw}')"] += 1
        return name.replace("{stateName}", self.county["stateName"])

    def category(self, manager, mang_type):
        cat = self.m["categoryByManager"].get(manager)
        if not cat:
            for rule in self.m["categoryByPattern"]:
                if re.search(rule["pattern"], manager):
                    cat = rule["category"]
                    break
        if not cat:
            cat = self.m["categoryByMangType"].get(mang_type, "other")
        if cat not in self.m["categories"]:
            raise md.PipelineError(f"category '{cat}' for '{manager}' is not in the fixed list")
        return cat


def clean_name(*values):
    for v in values:
        v = re.sub(r"\s+", " ", v or "").strip()
        if v:
            return v
    return "Unnamed"


def padus_date(v):
    m = re.fullmatch(r"(\d{4})/(\d{2})/(\d{2})", (v or "").strip())
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


# ------------------------------------------------------------------ build

def build(county_id):
    county = md.get_county(county_id)
    mapping = md.read_json(os.path.join(os.path.dirname(os.path.abspath(__file__)), "publicland-mapping.json"))
    mapper = Mapper(mapping, county)
    spec = md.LAYERS[LAYER]
    out_dir = os.environ.get("OUT_DIR") or os.path.join(md.BUILD, county_id)
    os.makedirs(out_dir, exist_ok=True)

    outline_path, outline_prov = md.county_outline(county)
    outline, area, ntiles = query_area(county)
    log(f"Query area: the {ntiles} zoom-{spec['minzoom']} tiles touching the county, plus {MARGIN_DEG} degrees")
    padus, padus_meta = fetch_padus(county, area)

    removed = collections.defaultdict(list)   # rule -> [description]
    records = []
    for f in padus["features"]:
        p = f["properties"]
        g = from_geojson(f.get("geometry"))
        if g is None:
            removed["no usable shape"].append(clean_name(p.get("Unit_Nm")))
            continue
        rec = {
            "id": int(p["OBJECTID"]),
            "featclass": p.get("FeatClass"),
            "pub_access": p.get("Pub_Access"),
            "own_type": p.get("Own_Type"),
            "name": clean_name(p.get("Unit_Nm"), p.get("Loc_Nm")),
            "manager": mapper.manager(p),
            "mang_type": p.get("Mang_Type"),
            "access": mapping["access"].get(p.get("Pub_Access"), "unknown"),
            "source": "padus",
            "src_date": padus_date(p.get("Src_Date")),
            "gis_acres": p.get("GIS_Acres"),
            "geom": g,
        }
        rec["category"] = mapper.category(rec["manager"], rec["mang_type"])
        records.append(rec)
    log(f"PAD-US: {len(records)} features read")

    def describe(r):
        return f"{r['featclass']} {r['pub_access']} | {r['name']} | {r['manager']} | own {r['own_type']} | {round(acres(r['geom']))} ac"

    # Rule: planning and designation boundaries are not land ownership.
    keep = []
    for r in records:
        if r["featclass"] in mapping["keepFeatClass"]:
            keep.append(r)
        else:
            removed["planning boundary"].append(describe(r))
    records = keep

    # Corrections from other open datasets, where they have land of a listed manager.
    used_sources = [("padus", md.read_json(os.path.join(md.PIPELINE, "sources.json"))["padus"]["dataDate"])]
    corrections_report = []
    for corr in mapping["corrections"]:
        data, cmeta = fetch_correction(corr)
        managers = set(corr["managers"])
        shapes = []
        for f in data.get("features", []):
            p = f["properties"]
            mgr = re.sub(r"\s+", " ", p.get(corr["managerField"]) or "").strip()
            if mgr not in managers:
                continue
            g = from_geojson(f.get("geometry"))
            if g is None or not g.Intersects(area):
                continue
            oid = p.get(corr["idField"])
            name = clean_name(p.get(corr["nameField"]))
            if oid is not None and str(oid).isdigit():
                fid = 1_000_000_000 + int(oid)
            else:
                fid = 1_900_000_000 + int(hashlib.sha256(f"{name}{g.Centroid().ExportToWkt()}".encode()).hexdigest()[:6], 16) % 100_000_000
            shapes.append({"id": fid, "name": name, "manager": mgr, "props": p, "geom": g})
        if not shapes:
            log(f"Correction '{corr['source']}': no land of {sorted(managers)} near this county, not used")
            continue
        # Shapes of this dataset that sit inside a larger one of the same manager are duplicates.
        shapes.sort(key=lambda s: -s["geom"].Area())
        kept_shapes = []
        for s in shapes:
            bigger = union([k["geom"] for k in kept_shapes if k["manager"] == s["manager"]])
            if covered_share(s["geom"], bigger) >= corr["containedOverlap"]:
                removed[f"{corr['source']}: inside a larger shape of the same dataset"].append(
                    f"{s['name']} | {round(acres(s['geom']))} ac")
            else:
                kept_shapes.append(s)
        cover = union([s["geom"] for s in kept_shapes])
        replaced, not_covered = [], []
        keep = []
        for r in records:
            if r["manager"] in managers:
                if covered_share(r["geom"], cover) >= corr["replaceOverlap"]:
                    replaced.append(r)
                    continue
                not_covered.append(f"{r['name']} | {round(acres(r['geom']))} ac")
            keep.append(r)
        records = keep
        for r in replaced:
            removed[f"replaced by {corr['source']}"].append(describe(r))
        # New records from the correction shapes. Access comes from the PAD-US
        # record they replace where there is one, else from the space type.
        for s in kept_shapes:
            best, best_area = None, 0.0
            for r in replaced:
                if r["geom"].Intersects(s["geom"]):
                    a = r["geom"].Intersection(s["geom"]).Area()
                    if a > best_area:
                        best, best_area = r, a
            if best:
                access = best["access"]
            else:
                access = corr["accessBySpaceType"].get(s["props"].get("space_type"), "unknown")
            manager = s["manager"]
            records.append({
                "id": s["id"], "featclass": "Fee", "pub_access": None, "own_type": None,
                "name": s["name"], "manager": manager, "mang_type": None,
                "category": mapper.category(manager, "DIST"), "access": access,
                "source": corr["featureSource"],
                "src_date": "", "gis_acres": s["props"].get("area_acres"), "geom": s["geom"]})
        # Any other PAD-US record that lies more than half inside a correction
        # shape repeats land the correction already draws, whoever PAD-US says
        # manages it.
        keep = []
        for r in records:
            share = covered_share(r["geom"], cover) if r["source"] == "padus" else 0.0
            if share > corr["dropPadusInside"]:
                removed[f"PAD-US record inside a {corr['source']} shape"].append(
                    describe(r) + f" | {round(100 * share)}% inside")
            else:
                keep.append(r)
        records = keep
        used_sources.append((corr["source"], (cmeta.get("metadataModified") or "")[:10]))
        corrections_report.append({
            "source": corr["source"], "managers": sorted(managers), "shapesUsed": len(kept_shapes),
            "padusReplaced": len(replaced), "padusKeptNotCovered": not_covered, "dataset": cmeta})
        log(f"Correction '{corr['source']}': {len(kept_shapes)} shapes replace {len(replaced)} PAD-US records")
        for x in not_covered:
            log(f"  kept from PAD-US, not in {corr['source']}: {x}")

    # Rule: easements on private land that are closed to access.
    fee_cover = union([r["geom"] for r in records if r["featclass"] == "Fee"])
    keep = []
    for r in records:
        if (r["featclass"] == "Easement" and r["access"] == "closed"
                and r["own_type"] not in mapping["publicOwnerTypes"]):
            share = covered_share(r["geom"], fee_cover)
            also = f" | also {round(100 * share)}% on a kept fee record" if share >= mapping["duplicateEasementOverlap"] else ""
            removed["easement on private land closed to access"].append(describe(r) + also)
        else:
            keep.append(r)
    records = keep

    # Rule: an easement that duplicates a fee record; the fee record is kept.
    fee_cover = union([r["geom"] for r in records if r["featclass"] == "Fee"])
    keep = []
    for r in records:
        if r["featclass"] == "Easement" and covered_share(r["geom"], fee_cover) >= mapping["duplicateEasementOverlap"]:
            removed["easement duplicating a fee record"].append(describe(r))
        else:
            keep.append(r)
    records = keep

    # Rule: privately owned land is not public land, except land of a
    # conservation organization (category ngo) that the public may enter.
    rule = mapping["privateLand"]
    keep = []
    for r in records:
        if (r["own_type"] in rule["ownerTypes"]
                and not (r["category"] in rule["keepCategories"] and r["access"] in rule["keepAccess"])):
            removed["privately owned land"].append(describe(r))
        else:
            keep.append(r)
    records = keep

    # Features for tippecanoe.
    records.sort(key=lambda r: (r["source"], r["id"]))
    features = []
    for r in records:
        features.append({
            "type": "Feature", "id": r["id"],
            "tippecanoe": {"minzoom": feature_minzoom(r["geom"], spec["minzoom"], FULL_ZOOM)},
            "properties": {
                "name": r["name"], "manager": r["manager"], "category": r["category"], "access": r["access"],
                "acres": int(round(acres(r["geom"]))), "source": r["source"], "src_date": r["src_date"]},
            "geometry": json.loads(r["geom"].ExportToJson())})
    if not features:
        raise md.PipelineError("no public land features left for this county")

    # Report what each rule removed and what the mapping did not know.
    log(f"Kept {len(features)} features")
    for rule, items in removed.items():
        log(f"Removed {len(items)}: {rule}")
        for x in items:
            log(f"    {x}")
    for k, v in sorted(mapper.unmapped.items()):
        log(f"  manager name note ({v}x): {k}")
    log(f"  {len(mapper.passed)} manager names used as PAD-US gives them (listed in the build report)")
    stats = collections.defaultdict(lambda: [0, 0])
    for f in features:
        s = stats[f["properties"]["category"]]
        s[0] += 1
        s[1] += f["properties"]["acres"]
    for cat in mapping["categories"]:
        if cat in stats:
            log(f"  {cat:16s} {stats[cat][0]:4d} features {stats[cat][1]:7d} acres")

    work = tempfile.mkdtemp(prefix="publicland-")
    try:
        src = os.path.join(work, "publicland.geojson")
        with open(src, "w", encoding="utf-8") as fh:
            json.dump({"type": "FeatureCollection", "features": features}, fh)
        sources_json = md.read_json(os.path.join(md.PIPELINE, "sources.json"))
        attribution = "; ".join(sources_json[k]["credit"] for k, _ in used_sources)
        full = os.path.join(work, "full.pmtiles")
        cmd = ["tippecanoe", "-o", full, "--force", "-q", "-t", work,
               "-l", LAYER, "-n", spec["title"], "-A", attribution,
               f"-Z{spec['minzoom']}", f"-z{spec['maxzoom']}",
               "--no-feature-limit", "--no-tile-size-limit", "--no-tiny-polygon-reduction",
               src]
        log("Running " + " ".join(cmd[:3] + ["..."] + cmd[-5:]))
        subprocess.run(cmd, check=True)
        # Keep the tippecanoe input beside the build report, for checking tiles against it.
        report_dir = os.path.join(md.REPO, "data", "reports", county_id)
        os.makedirs(report_dir, exist_ok=True)
        shutil.copyfile(src, os.path.join(report_dir, f".{LAYER}.input.tmp"))
        os.replace(os.path.join(report_dir, f".{LAYER}.input.tmp"), os.path.join(report_dir, f"{LAYER}.input.geojson"))
        # Keep only the tiles that touch the county (contract rule 1).
        tmp_out = os.path.join(out_dir, f".{LAYER}.pmtiles.tmp-{os.getpid()}")
        subprocess.run([md.PMTILES, "extract", full, tmp_out, f"--region={outline_path}", "-q"], check=True)
        final = os.path.join(out_dir, f"{LAYER}.pmtiles")
        os.replace(tmp_out, final)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    log(f"Wrote {final} ({os.path.getsize(final)} bytes)")
    log("\n".join(subprocess.run([md.PMTILES, "show", final], capture_output=True, text=True).stdout.splitlines()[:13]))

    names = [k for k, _ in used_sources]
    notes = ("'open' means open to the public on foot. It does not mean open to hunting: whether hunting is allowed "
             "is not in this layer. Boundaries are approximate and are not a legal survey. Left out: easements on "
             "private land that are closed to the public, planning boundaries such as military or proposed areas, "
             "and easement records that repeat a fee record.")
    for corr in mapping["corrections"]:
        if corr["source"] in names:
            notes += " " + corr["note"]
    sources = [md.source_entry(k, d) for k, d in used_sources]
    prov = {
        "padus": {k: padus_meta.get(k) for k in ("service", "layerName", "dataLastEditDate", "fetched", "count")},
        "queryArea": f"zoom-{spec['minzoom']} tiles touching the county outline ({ntiles} tiles) plus {MARGIN_DEG} degrees",
        "removed": {rule: len(items) for rule, items in removed.items()},
        "corrections": [{k: c[k] for k in ("source", "managers", "shapesUsed", "padusReplaced")} for c in corrections_report],
        "features": len(features),
        "countyOutline": outline_prov,
    }
    meta = md.make_meta(LAYER, county, final, sources, notes, provenance=prov)
    md.write_meta(os.path.join(out_dir, f"{LAYER}.meta.json"), meta, final)
    log(f"Wrote {os.path.join(out_dir, LAYER + '.meta.json')}")

    # A detailed build report, kept out of the build folder.
    report = {"county": county_id, "buildDate": meta["buildDate"], "features": len(features),
              "removed": dict(removed), "corrections": corrections_report,
              "managerNotes": dict(mapper.unmapped), "managerNamesAsGiven": sorted(mapper.passed),
              "managersInArchive": sorted({f["properties"]["manager"] for f in features}),
              "byCategory": {c: {"features": v[0], "acres": v[1]} for c, v in stats.items()}}
    md.atomic_write_json(os.path.join(md.REPO, "data", "reports", county_id, f"{LAYER}.report.json"), report)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        log("usage: python3 -I pipeline/layers/publicland.py <county-id>")
        sys.exit(2)
    try:
        build(sys.argv[1])
    except md.PipelineError as e:
        log(f"error: {e}")
        sys.exit(1)
