# Base data sources: license and logistics research (Phase 1)

- Scope: Champaign County, IL (FIPS 17019, about 998 sq mi) and Macon County, IL (FIPS 17115, about 586 sq mi).
- Use case: a free, open source (GPL-3.0) Android app. We build static PMTiles archives ahead of time, redistribute them publicly (inside the app or as free downloads), and keep running cost at zero.
- Research date: 2026-11-12. All requests used the generic User-Agent `map-research-test`.
- Method: license pages were read directly. Sizes come from HTTP HEAD requests, service JSON, PMTiles directory reads (byte ranges only), STAC/Box listings, and a few 256 px sample tiles. No bulk data was downloaded.
- Labels: "measured" means taken from a server response. "Estimated" means calculated, and the method is given. "NOT CONFIRMED" means we tried and could not verify it.
- Not legal advice. Where a license is ambiguous, this file says so.

County bounding boxes (WGS84, from TIGERweb `State_County/MapServer/1`, measured):

| County | West | South | East | North | Total area |
|---|---|---|---|---|---|
| Champaign 17019 | -88.464 | 39.879 | -87.929 | 40.401 | 998.5 sq mi |
| Macon 17115 | -89.218 | 39.653 | -88.745 | 40.055 | 585.7 sq mi |

---

## Summary

| # | Source | Usable for free GPL app + redistribution | License | Size for the two counties | Newest data |
|---|---|---|---|---|---|
| 1 | OpenStreetMap (via Protomaps daily build or Geofabrik) | **Yes**, with attribution and an ODbL notice | ODbL 1.0 (data). Protomaps code is BSD-3 and its map design is CC0. OpenMapTiles schema is CC-BY. | Vector PMTiles z0-14: **about 8.5 MB** (measured, bbox). z0-15: about 16.2 MB. Source: Illinois PBF is 346 MB (measured). | OSM 2026-11-12 (daily) |
| 2 | US Census TIGER/Line 2026 | **Yes** | US Government work, no copyright (17 USC 105). Citation requested. | About 7.3 MB of zipped county files plus state-level PLACE and AREALM (measured) | TIGER2026, published 2026-10-06; legal boundaries as of 2026-01-01 |
| 3 | USDA NAIP | **Yes** | Public domain (US PD label on data.gov). FPAC-BC asks to be credited. | 2025 compressed county mosaics: **1.62 GB** (measured). Tile pyramid: about 40-65 MB at z15, 140-240 MB at z16, 420-810 MB at z17 (estimated). | **2025** (flown 2025-07-05 to 09-15), **0.6 m**. 2023 is 0.3 m. |
| 4 | Illinois 2025 statewide orthoimagery (ISGS / Illinois 911 acquisition) | **Yes** (public domain per metadata), but there is no bulk download path for Champaign yet | "This data set is in the public domain" (dataset metadata) | Source estimated at about 700 GB uncompressed. Tile pyramid to z17 about 0.45-0.85 GB, to z18 about 1.5-3 GB (estimated). | 2025 publication. **Leaf-off**, 6-inch, 4-band. Flight date between 2023-01 and 2025-06, exact date NOT CONFIRMED. |
| 5 | NWS API (api.weather.gov) | **Yes**. Call it directly from the phone, with no key and no server. | Public domain / "open data, free to use for any purpose". User-Agent required. | n/a (live API, about 4 KB to 100 KB per response) | Live. Hourly forecast regenerated about hourly. |
| 6a | USGS 3DEP DEMs (later phase) | **Yes** | USGS public domain. "Credit: U.S. Geological Survey" suggested. | 1 m DEM: about 13.7 GB (measured, bbox tiles). 1/3 arc-second: 2.6 GB for 6 full 1-degree tiles (measured). | Champaign lidar Nov 2019 to Mar 2020. Macon lidar Mar to Apr 2021. |
| 6b | ISGS ILHMP lidar (later phase) | **Yes** ("No restrictions apply") | Metadata access constraint: none. USGS acknowledgement appreciated. | DTM zips: 33.0 GB + 34.1 GB (measured). LAS: 243 GB + 164 GB (measured). | Champaign 2020, Macon 2021 (the same lidar as 3DEP) |

---

## 1. OpenStreetMap

### License and terms

- **License: Open Database License (ODbL) 1.0.** Read at https://www.openstreetmap.org/copyright:
  - "OpenStreetMap is *open data*, licensed under the Open Data Commons Open Database License (ODbL)"
  - "If you alter or build upon our data, you may distribute the result only under the same license."
- **Attribution.** Read at https://osmfoundation.org/wiki/Licence/Attribution_Guidelines:
  - "Attribution must be to "OpenStreetMap"." and "“© OpenStreetMap contributors” or “© OpenStreetMap” are acceptable".
  - The guidelines also require making clear that the data is under ODbL, normally by linking to https://www.openstreetmap.org/copyright.
  - **Mobile app placement:** "the attribution may be placed adjacent to the map or on a splash screen or pop-up shown when a user starts the app". For interactive maps, the credit "should typically appear in a corner of the map". It may collapse after interaction or after five seconds, but the license information must stay findable.
- **Produced Work vs Derivative Database.** Read at https://osmfoundation.org/wiki/Licence_and_Legal_FAQ and https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline:
  - FAQ: "You can license a *Produced Work* under any terms you like", but a recipient of a Produced Work can ask for the underlying data. You must "offer recipients either a copy of your data and any Derivative Databases under the terms of the ODbL ... or the means of creating the Derivative Databases upon request".
  - FAQ: "a Derivative Database is created where you adapt, modify, enhance, correct or extend our data." A Collective Database, meaning OSM placed alongside otherwise independent databases, "is not therefore considered a Derivative Database".
  - Produced Work guideline: raster images and SVG are "USUALLY Produced Works". If something "is intended for the extraction of the original data, then it is a database". **Vector tiles are not classified in the guideline.**
  - The OSMF Licensing Working Group minutes of 2025-11-10 (https://osmfoundation.org/wiki/Licensing_Working_Group/Minutes/2025-11-10) discuss a complaint arguing that Organic Maps' vector .mwm files are "a Derivative Database" that "should be licensed under ODbL". The minutes record only "Done." with no LWG ruling.
  - Protomaps describes its tiles as "Produced Works of the OpenStreetMap dataset under the Open Database License" (https://github.com/protomaps/basemaps).
- **What this means for our tiles.** A vector PMTiles archive keeps OSM geometry and tags in extractable form. The safe assumption is that **our OSM PMTiles are a Derivative Database under ODbL**. Then:
  - Publish the .pmtiles under ODbL 1.0. Distributing them publicly as free downloads already satisfies "offer the data".
  - Keep the build scripts public. The GPL repository does this anyway, and it covers "means of creating".
  - If we mix TIGER (public domain) into the same tileset, the combined archive should also be ODbL. That is harmless, because public domain data has no conflicting terms.
- **Shipping a PMTiles extract inside a GPL-3.0 app is fine.** The code and the data carry separate licenses. Put an ODbL notice for the data next to the GPL notice for the code: in the About/Licenses screen, in the repository (for example a `DATA_LICENSES` file), and in or beside the downloadable archives. Do not label the tiles GPL. The ODbL text has no clause that conflicts with distribution inside GPL software.
  - Unverified reasoning: no OSMF page addresses GPL apps specifically. The FAQ says to ask legal-questions@osmfoundation.org if in doubt.
- **Usable and redistributable:** Yes, with attribution, an ODbL notice, and the data kept available.

### Required attribution text

On the map (a corner control): `© OpenStreetMap contributors`, linked to https://www.openstreetmap.org/copyright.

When using a schema, add its credit:
- Protomaps basemap: suggested `Protomaps © OpenStreetMap`.
- OpenMapTiles schema: `© OpenMapTiles © OpenStreetMap contributors`.

### Coverage, update schedule, newest data

- Coverage: full coverage of both counties. Road completeness in rural Illinois is generally good because of the TIGER import heritage. Woodland polygons are less complete (not measured).
- Geofabrik Illinois extract (measured, https://download.geofabrik.de/north-america/us/illinois.html): "contains all OSM data up to 2026-11-12T21:23:05Z. File size: 346 MB". Rebuilt daily.
- Protomaps daily planet build 20261112 (measured, from the archive metadata):
  - `planetiler:osm:osmosisreplicationtime` is 2026-11-12T04:00:00Z.
  - Basemap version 4.15.2.
  - Layers: boundaries, buildings, earth, landcover, landuse, places, pois, roads, water.
  - Description: "Basemap layers derived from OpenStreetMap and Natural Earth".

### Download routes (best first)

1. **Protomaps daily build plus `pmtiles extract`.** This is the fastest route and needs no build toolchain.
   - Build list (measured): https://build-metadata.protomaps.dev/builds.json shows 61 builds retained, the newest `20261112.pmtiles`.
   - Planet file: `https://build.protomaps.com/20261112.pmtiles`. Measured `Content-Length: 139437771201` (139 GB). Supports HTTP range requests.
   - Command (from https://docs.protomaps.com/guide/getting-started), using our union bbox: `pmtiles extract https://build.protomaps.com/20261112.pmtiles il2.pmtiles --bbox=-89.218,39.653,-87.929,40.401 --maxzoom=14`
   - Only the needed byte ranges are fetched.
   - Gotchas:
     - Daily builds are retained only for about 60 days, so pin and archive the one you use.
     - Low-zoom tiles (z0-7) are whole-world tiles, which adds about 0.47 MB.
     - The bbox includes some area outside the counties.
2. **Geofabrik Illinois PBF plus Planetiler.**
   - URL: https://download.geofabrik.de/north-america/us/illinois-latest.osm.pbf. It redirects (307) to the dated file, for example `illinois-261112.osm.pbf`. 346 MB.
   - Clip with `osmium extract` to the county polygons, then build PMTiles with Planetiler. Planetiler is Apache-2.0 and "Writes to MBTiles or PMTiles output archives", per https://github.com/onthegomap/planetiler.
   - Planetiler's default profile is OpenMapTiles. The Protomaps basemap profile also runs on Planetiler, and the daily builds are made that way (`planetiler:version 0.10.2` in the metadata).
   - Choose this route if we want our own schema, for example to emphasize woods, creeks, and field roads for hunters.
3. Geofabrik has no county-level extracts. Smaller custom extracts (for example BBBike) exist but were not evaluated (NOT CONFIRMED).

### Schema licenses (these differ)

- **Protomaps basemap** (https://github.com/protomaps/basemaps):
  - Code: "BSD 3-Clause License".
  - Design: "The visual design copyright of the maps is released under a Creative Commons Zero (CC0) license".
  - Tiles: ODbL Produced Works.
  - Attribution required only for OSM: "must visibly attribute © OpenStreetMap".
  - **Best fit for us.** The style is CC0, so it is GPL-compatible to bundle and modify.
- **OpenMapTiles** (https://github.com/openmaptiles/openmaptiles):
  - Code: "All code in this repository is under the BSD license".
  - Design and schema: "Design and the cartography decisions encoded in the schema and SQL are licensed under CC-BY".
  - Products must visibly credit OpenMapTiles ("© OpenMapTiles", linking to openmaptiles.org). "Exceptions to attribution requirement can be granted on request."
  - Usable, but it is one more mandatory on-map credit. CC-BY 4.0 styles are generally considered one-way compatible into GPL-3.0 (unverified, from general license knowledge).

### Size for the two counties

**Measured.** We read only the PMTiles header and directories (about 0.97 MB of range requests) of `20261112.pmtiles`, then summed tile byte lengths for every tile intersecting each county bbox (script: scratch only, not in the repo).

| Zoom | Tiles | Bytes (gzipped MVT) |
|---|---|---|
| z0-7 | 8 | 466 KB (whole-world tiles) |
| z8 | 4 | 273 KB |
| z9 | 4 | 281 KB |
| z10 | 10 | 400 KB |
| z11 | 36 | 609 KB |
| z12 | 112 | 1.01 MB |
| z13 | 380 | 1.85 MB |
| z14 | 1,407 | 3.62 MB |
| z15 | 5,306 | 7.69 MB |

- **z0-14 total: about 8.5 MB. z0-15 total: about 16.2 MB.**
- An OpenMapTiles-schema build would be of similar order. That size is NOT measured.

### Gotchas

- The vector-tile classification is unresolved at OSMF (see above), so treat the tiles as ODbL.
- Keep a dated snapshot plus its build recipe, because ODbL requires being able to provide the data.
- The OSM attribution must stay visible or findable in-app. A credit only in the Play Store listing is not enough.

---

## 2. US Census TIGER/Line

### License and terms

Source: the TIGER/Line 2026 Technical Documentation, section 1, https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2026/TGRSHP2026_TechDoc.pdf (measured 7,975,758 bytes; PDF created 2026-10-13).

- §1.2: "Copyright protection is not available for any work of the United States Government (Title 17 U.S.C., Section 105). Thus, you are free to reproduce census materials as you see fit. We would ask, however, that you cite the Census Bureau as the source."
- §1.1:
  - "TIGER/Line® is a registered trademark of the Census Bureau. TIGER/Line cannot be used as or within the proprietary product names of any commercial product".
  - "The Census Bureau requests that any repackaging of the TIGER/Line Shapefile data ... for distribution include a conspicuously placed statement to this effect".
  - Boundaries are "for statistical data collection and tabulation purposes only ... not legal land descriptions." No warranty.
- §1.3: "Members of the public can obtain the TIGER/Line Shapefiles free of charge".
- **Usable and redistributable:** Yes. It is public domain. Credit is requested, not required.

### Required attribution text

Requested, not legally required. Suggested: `Roads, water and boundaries: U.S. Census Bureau TIGER/Line Shapefiles 2026`. Add a note that TIGER/Line® is a Census Bureau trademark and that boundaries are not legal land descriptions. Do not put "TIGER" in the app name.

### Coverage, update schedule, newest data

- Both counties are fully covered.
- Annual vintages. **TIGER2026** is current: the directory is listed at https://www2.census.gov/geo/tiger/TIGER2026/ and its files are dated 2026-10-06 (measured Last-Modified).
- Legal boundaries are "legally in effect as of January 1, 2026" (Tech Doc).
- The 2026 cartographic boundary directory (GENZ2026) also exists (Last-Modified 2026-11-10).

### Download URLs and sizes (all measured by HEAD, Content-Length)

| File | URL | Bytes |
|---|---|---|
| Roads, Champaign | https://www2.census.gov/geo/tiger/TIGER2026/ROADS/tl_2026_17019_roads.zip | 1,224,437 |
| Roads, Macon | https://www2.census.gov/geo/tiger/TIGER2026/ROADS/tl_2026_17115_roads.zip | 968,569 |
| Area water, Champaign | https://www2.census.gov/geo/tiger/TIGER2026/AREAWATER/tl_2026_17019_areawater.zip | 417,843 |
| Area water, Macon | https://www2.census.gov/geo/tiger/TIGER2026/AREAWATER/tl_2026_17115_areawater.zip | 115,207 |
| Linear water, Champaign | https://www2.census.gov/geo/tiger/TIGER2026/LINEARWATER/tl_2026_17019_linearwater.zip | 680,695 |
| Linear water, Macon | https://www2.census.gov/geo/tiger/TIGER2026/LINEARWATER/tl_2026_17115_linearwater.zip | 557,389 |
| Feature names, Champaign | https://www2.census.gov/geo/tiger/TIGER2026/FEATNAMES/tl_2026_17019_featnames.zip | 442,780 |
| Feature names, Macon | https://www2.census.gov/geo/tiger/TIGER2026/FEATNAMES/tl_2026_17115_featnames.zip | 291,431 |
| Edges (all lines), Champaign / Macon | `.../EDGES/tl_2026_17019_edges.zip` / `tl_2026_17115_edges.zip` | 3,707,748 / 2,639,300 |
| Places (IL statewide) | https://www2.census.gov/geo/tiger/TIGER2026/PLACE/tl_2026_17_place.zip | 6,176,356 |
| County subdivisions / townships (IL) | https://www2.census.gov/geo/tiger/TIGER2026/COUSUB/tl_2026_17_cousub.zip | 6,723,812 |
| Point landmarks (IL) | https://www2.census.gov/geo/tiger/TIGER2026/POINTLM/tl_2026_17_pointlm.zip | 1,044,818 |
| Area landmarks, parks etc. (IL) | https://www2.census.gov/geo/tiger/TIGER2026/AREALM/tl_2026_17_arealm.zip | 1,758,746 |
| Counties (national, large) | https://www2.census.gov/geo/tiger/TIGER2026/COUNTY/tl_2026_us_county.zip | 83,378,454 |
| Counties, generalized alternative | https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_county_500k.zip | 11,758,981 |

- Roads, area water, and linear water for both counties total **3.96 MB zipped**. State-level files are extra and get clipped.
- County boundaries without the 83 MB national file: query TIGERweb, for example `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?where=GEOID+IN+('17019','17115')&outFields=GEOID,NAME&returnGeometry=true&outSR=4326&f=geojson`. We used this to get the bboxes above.
- Vector tiles from TIGER for the two counties are estimated at a few MB. Not measured.

### Gotchas

- TIGER roads are geometrically weaker than OSM in rural areas, with offsets of 5-30 m in places (general knowledge, unverified for these counties). Use TIGER mainly for county and township boundaries, place names, and as a gap-check.
- There is no woodland layer.
- The trademark notice applies if we name a layer "TIGER".

---

## 3. USDA NAIP aerial imagery

### License and terms

- data.gov catalog record (https://catalog.data.gov/dataset/national-agriculture-imagery-program-naip-imagery):
  - License: "https://www.usa.gov/publicdomain/label/1.0/" (US Public Domain).
  - Access level: "public".
  - Publisher: "Farm Production and Conservation Business Center".
- NAIP 2025 metadata (Minnesota copy, https://mnatlas.org/metadata/2025_fsa.html):
  - Access constraints: "None".
  - Use constraints: "The USDA-FPAC-BC Geospatial Enterprise Operations branch asks to be credited in derived products."
- USGS NAIP service description (https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer?f=json): "free downloads of public domain, NAIP compressed orthoimagery".
- AWS Registry entry (https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/naip.yaml): "License: Public Domain with Attribution".
- Planetary Computer STAC collection `naip` reports `"license": "proprietary"`. That is a STAC placeholder and is contradicted by the USDA public-domain label. Microsoft's own service terms were not read (NOT CONFIRMED).
- **Usable and redistributable:** Yes. Public domain, credit requested.

### Required attribution text

`Imagery: USDA Farm Production and Conservation Business Center, NAIP 2025`

### Coverage, resolution, newest data

Planetary Computer STAC search at 40.11,-88.24 (measured):

| Year | Resolution |
|---|---|
| **2025** | **0.6 m** |
| **2023** | **0.3 m** |
| 2021 | 0.6 m |
| 2019 | 0.6 m |
| 2017 and earlier | 1.0 m |

- 2025 acquisition dates over the two counties: 2025-07-05 to 2025-09-15, across 7 flight dates. 2023: 2023-06-30 to 2023-08-24.
- **All of it is leaf-on**, because NAIP flies in the growing season.
- Illinois is flown about every 2 years: 2019, 2021, 2023, 2025. The next is presumably 2027 (unverified).
- The 2026 Box folder exists but contains other states (not checked in detail).

### Download routes

1. **USDA NRCS Box, compressed county mosaics (best free route).**
   - Root: https://nrcs.app.box.com/v/naip. Path: 2025 → IL → il_m.
   - 2025 IL folder total: 70.84 GB. The listing was last updated 2026-04-20.
   - Files (measured from the Box listing):
     - `ortho_1-1_hm_s_il019_2025_1.zip`: **947,928,389 bytes** (Champaign)
     - `ortho_1-1_hm_s_il115_2025_1.zip`: **670,552,514 bytes** (Macon)
   - Total **1.62 GB**. The 2023 (0.3 m) mosaics are in the 2023 folder, which totals 7.86 TB nationally; Illinois sizes there were not listed.
   - Gotchas:
     - Box is browser- and JavaScript-oriented, with no stable direct URL. Download manually once.
     - CCMs are lossy-compressed (format inside the zip NOT CONFIRMED; historically MrSID or JPEG2000), so GDAL needs the matching driver.
     - The Geospatial Data Gateway (https://datagateway.nrcs.usda.gov) points to this Box.
2. **Microsoft Planetary Computer (free, anonymous).**
   - STAC: `https://planetarycomputer.microsoft.com/api/stac/v1/search` with collection `naip`.
   - Assets are COGs on Azure blob, for example `https://naipeuwest.blob.core.windows.net/naip/v002/il/2025/il_060cm_2025/40088/m_4008863_sw_16_060_20250914.tif`.
   - Reading them needs a free anonymous SAS token from `https://planetarycomputer.microsoft.com/api/sas/v1/token/naip`.
   - Measured sizes:
     - 2025: 103 quarter-quads, **34.8 GB**.
     - 2023 (0.3 m): 153 quarter-quads, **301 GB**.
   - **Gotcha (measured):** the 2025 Illinois collection on Planetary Computer is **incomplete for Macon County**. 30 quarter-quads in the 39088-01/02/03/09/10/11/17/18/19 blocks (eastern Macon) are missing for 2025 but present for 2023. Box has the complete Macon 2025 mosaic.
3. **AWS Open Data (`naip-analytic`, `naip-visualization`, `naip-source`, us-west-2).**
   - All three are **Requester Pays**. Measured: anonymous list returns "Anonymous users cannot invoke requests against Requester Pays buckets".
   - The registry says the catalog covers "2010 through 2023".
   - It needs an AWS account and costs egress. **Not zero-cost. Avoid.**
4. **USGS EarthExplorer.**
   - The USGS NAIP ImageServer catalog gives per-tile `download_url` values like `https://earthexplorer.usgs.gov/download/options/naip/2895049`.
   - Requires a free USGS login (unverified this session).
5. **Public ImageServers.**
   - USGS `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer` is public with no token. Measured: at Champaign it serves **2019** 0.6 m. Not current.
   - USDA APFO `https://gis.apfo.usda.gov/arcgis/rest/services/NAIP/USDA_CONUS_PRIME/ImageServer`: connection failed from this machine (curl code 000). **NOT CONFIRMED.**
   - Scraping a live service to build tiles is legal for public domain data, but heavy. Prefer the Box mosaics.

### Tile pyramid size estimate

Zoom versus ground resolution at 40° N: z15 = 3.66 m/px, z16 = 1.83 m/px, z17 = 0.92 m/px, z18 = 0.46 m/px. The 0.6 m NAIP stops adding detail beyond z17. The 0.3 m 2023 imagery would justify z18.

**Tile counts (estimated)** from total area 4,103 km² and tile area at 40° N:

| Zoom | Tile area | Tiles |
|---|---|---|
| z15 | 0.878 km² | about 4,700 |
| z16 | 0.219 km² | about 18,700 |
| z17 | 0.0549 km² | about 74,800 |

- Polygon-based counts are given in the addendum.
- All lower levels together add about one third of the top level.

**Bytes per tile (measured on 15 sample tiles).**
- Samples: 5 locations at z15, z16, and z17, taken as lossless PNG from the USGS NAIP ImageServer (2019, 0.6 m) and re-encoded with Pillow 13.
- Locations: farmland; urban Champaign; woods at Lake of the Woods; woods at Rock Springs; Lake Decatur.

| Zoom | Farmland JPEG q75 / WebP q75 | Woods, urban, water mean JPEG q75 / WebP q75 |
|---|---|---|
| z15 | 7.9 KB / 3.7 KB | 19.5 KB / 17.7 KB |
| z16 | 7.0 KB / 2.9 KB | 17.8 KB / 15.4 KB |
| z17 | 6.1 KB / 2.0 KB | 14.1 KB / 10.3 KB |

JPEG q85 is about 35% larger than q75.

**Pyramid totals** (estimated). Method: tile counts × an 80% farmland / 20% textured weighting, which is an assumption given both counties are mostly cropland. Uncertainty is about ±40%.

| Max zoom | JPEG q75 | WebP q75 |
|---|---|---|
| 15 | about 65 MB | about 40 MB |
| 16 | about 240 MB | about 140 MB |
| 17 | about 810 MB | about 420 MB |

These are for the two counties together. Roughly 63% is Champaign and 37% Macon, by area.

### Gotchas

- Leaf-on only, so it is weak for seeing into timber. Source #4 complements it.
- The Planetary Computer gap in Macon 2025 (above).
- AWS buckets are requester-pays.
- The USGS public service is stale (2019).
- The 2023 0.3 m imagery is sharper than 2025 0.6 m, but older and about 10× larger at source.

---

## 4. Illinois statewide orthoimagery (ISGS Clearinghouse)

### What exists for Champaign and Macon

The imagery list is at https://clearinghouse.isgs.illinois.edu/data/imagery/ (measured).

- **Illinois 911 Aerial Acquisition (published 2025-06-30)** is the relevant one. Page: https://clearinghouse.isgs.illinois.edu/data/imagery/illinois-911-aerial-acquisition/
  - "6-inch, 4 band, color infrared (red, green, blue and IR)".
  - About 75% of the state, excluding Cook and the collar counties.
  - Acquired by Woolpert with a VisionMap A3 Edge camera.
- Project metadata: https://chf.isgs.illinois.edu/clearinghouse/data/metadata/ISGS/IL_Statewide_Orthoimagery_2025_%20Project_Level_East.xml
  - "The aerial imagery was collected during **leaf-off** conditions at a minimum resolution of 0.5-foot."
  - Delivered "as countywide datasets, consisting of 5,000' x 5,000' uncompressed 8-bit, 4-band color geotiff files".
  - Project period: begdate 20230110, enddate 20250630.
- **The exact flight date for Champaign and Macon is NOT CONFIRMED.** The metadata gives only the 2023-2025 project window, and the image service catalogs have no date field.
- Leaf-off was confirmed visually on sample tiles at Lake of the Woods (Champaign) and Rock Springs (Macon), which show bare deciduous canopy.
- Coverage (measured by catalog point queries on each image service):
  - Champaign: mostly **IL_Blk2_East_2025**. The south part (around 39.9 N) is in **IL_Blk3_East_2025**.
  - Macon (Decatur): **IL_Blk3_East_2025**. SW Macon (39.7 N, -89.15) is in **IL_Blk3_West_2025**.
- Older items on the Clearinghouse are mostly re-hosted NAIP years (2004-2019) and 1998-2005 DOQs. There is also 2011 IDOT orthophotography, whose coverage was not checked.

### License and terms

From the dataset metadata (access constraints), on the page and in the XML above:
- "This data set is in the public domain, and the recipient may not assert any proprietary rights thereto nor represent it to any one as other than a data set produced by the Statet of Illinos and The University of Illinois."
- Use constraints: "This data is for planning purposes only and should not be used for legal or cadastral purposes. This data set is provided "as-is" without warranty of any kind".
- The site footer has a general "Terms of Use" link, but its text could not be located in the page HTML (NOT CONFIRMED).
- **Usable and redistributable:** **Yes.** The text says public domain. We must not claim it as ours and must credit the State of Illinois and the University of Illinois.

### Required attribution text

`Leaf-off imagery: State of Illinois / University of Illinois (ISGS), Illinois 911 Aerial Acquisition 2025`

### Delivery

- **ArcGIS ImageServers** (public, no token, measured):
  - `https://data.isgs.illinois.edu/arcgis/rest/services/Imagery/IL_Blk{1-4}_{East|West}_2025/ImageServer`
  - Pixel 0.1524 m, 4 bands, `maxImageWidth/Height` 15000.
  - **The `Download` capability is enabled on Blk2_West, Blk3_East, Blk3_West, and Blk4_West, but not on Blk2_East (Champaign).** `maxDownloadImageCount` is 20 and `maxDownloadSizeLimit` is 2048 (MB).
  - So Macon source rasters may be downloadable through the service. Champaign would need `exportImage` (rendered) or a request to ISGS.
- Viewer: https://prairie-research.maps.arcgis.com/apps/instant/basic/index.html?appid=c620c19e397d4dbe92df299f0ac679d7
- No bulk county zip download link was found on the page. The page says nothing about mail-order. **Bulk download is NOT CONFIRMED.** Next step: email ISGS (info@isgs.illinois.edu) and ask for the Champaign and Macon county GeoTIFF sets.

### Sizes

- **Source (estimated):** 4,103 km² at 0.1524 m is about 1.77×10¹¹ pixels. At 4 bands of uncompressed 8-bit, that is **about 700 GB**, or about 1,770 tiles of 5,000 ft.
- **Bytes per tile (measured on 9 samples).** Samples came from `exportImage` (bands 0,1,2, PNG) and were re-encoded:

| Zoom | Farmland JPEG q75 / WebP q75 | Woods (2 sites) JPEG q75 / WebP q75 |
|---|---|---|
| z16 | 5.2 KB / 1.7 KB | 10.1 KB / 7.2 KB |
| z17 | 7.0 KB / 3.5 KB | 10.1 KB / 7.2 KB |
| z18 | 7.5 KB / 3.5 KB | 8.1 KB / 4.1 KB |

- **Pyramid estimates** (estimated, same method as NAIP):

| Max zoom | JPEG q75 | WebP q75 |
|---|---|---|
| 16 | about 150-250 MB | about 80-150 MB |
| 17 | about 0.6-0.85 GB | about 0.3-0.45 GB |
| 18 (299k tiles at z18) | about 2.3-3 GB | about 1.1-1.5 GB |

### Better or worse than NAIP for hunters

**Better for the core use:**
- It is leaf-off, so you see creek bottoms, trails, fence lines, ditches, and timber structure under the canopy.
- 0.15 m against 0.6 m means it supports z18-19.

**Worse in other ways:**
- No confirmed bulk download for Champaign.
- Unknown flight date.
- The service renders dark and unstretched by default, so it needs color balancing.
- Sources are about 400× larger than the NAIP CCMs.
- No leaf-on crop context.

**Recommendation:** ship NAIP 2025 as the default layer (z15-16 in-app). Offer ISGS 2025 leaf-off as an optional download (z17, perhaps z18 for wooded areas only).

### Gotchas

- The 6-inch pixel size is reported in Web Mercator units (0.1524), so actual ground resolution is finer, about 0.117 m at 40° N. Treat it as nominal 6-inch.
- The project area excludes Cook and the collar counties. That is irrelevant to Phase 1 but matters for later expansion.
- The page's "Bounding coordinates" in the metadata summary are clearly wrong: a tiny box near Arcola. Ignore them.

---

## 5. National Weather Service API (api.weather.gov)

### License and terms

- https://www.weather.gov/documentation/services-web-api: "All of the information presented via the API is intended to be open data, free to use for any purpose."
- https://www.weather.gov/disclaimer:
  - "The information on National Weather Service (NWS) Web pages are in the public domain, unless specifically noted otherwise" and "may be used without charge for any lawful purpose".
  - The NWS name and logo are trademarks. They may not be used to imply endorsement.
- **Usable:** Yes. There is nothing to redistribute, because the app calls the API live. Caching responses on the device is fine.

### Required attribution text

None legally required. Suggested: `Weather: National Weather Service (api.weather.gov)`. Do not use the NWS logo.

### User-Agent, keys, rate limits

- "A User Agent is required to identify your application." The docs suggest including a website or email.
  - **Measured: an empty User-Agent returns HTTP 403.**
  - For the app, use something like `AppName/1.0 (https://github.com/<repo>)`. A repository URL works; no personal email is needed.
- No API key today. The docs say "This will be replaced with an API key in the future". This is a future risk for a server-less app.
- Rate limit: "The rate limit is not public information, but allows a generous amount for typical use." Exceeding it returns an error; retry after a pause.
- **CORS** (measured): `Access-Control-Allow-Origin: *`.
- Caching:
  - Measured headers: `/points` has `Cache-Control: max-age=86400`; `forecast/hourly` has `max-age=3600`.
  - The docs: "Applications may cache the grid for a location", but recheck `/points` periodically because grid mappings can change.
- **A phone app can call it directly, with no key and no server: Yes** (confirmed by the live requests below).

### Endpoint sequence (measured on 2026-11-13 02:57 UTC for 40.11,-88.24)

1. `GET https://api.weather.gov/points/40.11,-88.24` (3.9 KB)
   - Returns `gridId ILX`, `gridX 96`, `gridY 72`, `timeZone America/Chicago`, `county .../zones/county/ILC019`.
   - Links:
     - `forecast`: https://api.weather.gov/gridpoints/ILX/96,72/forecast
     - `forecastHourly`: https://api.weather.gov/gridpoints/ILX/96,72/forecast/hourly
     - `forecastGridData`: https://api.weather.gov/gridpoints/ILX/96,72
     - `observationStations`: https://api.weather.gov/gridpoints/ILX/96,72/stations
   - It also includes `astronomicalData` (sunrise 06:35:10, sunset 16:39:04, and civil twilight times). This is useful for legal shooting hours.
2. `GET .../gridpoints/ILX/96,72/forecast/hourly`
   - `units: us`, 156 hourly periods (about 6.5 days).
   - Each period has `windSpeed` as a **string** (for example `"13 mph"`) and `windDirection` as a 16-point compass **string** (for example `"NNW"`).
   - **No gust field in the hourly forecast** (measured).
3. `GET .../gridpoints/ILX/96,72` (raw grid)
   - `windSpeed` and `windGust` in `wmoUnit:km_h-1`. `windDirection` in `wmoUnit:degree_(angle)`.
   - Each value is `{validTime: "2026-11-12T20:00:00+00:00/PT3H", value: 29.632}`. The ISO-8601 interval must be expanded into hours.
   - Also `twentyFootWindSpeed/Direction`, `transportWindSpeed`, and `potentialOf20mphWindGusts` etc.
   - **Use this for gusts and numeric direction.**
4. Current wind: `GET .../gridpoints/ILX/96,72/stations` gives nearest stations: KCMI (Willard), KTIP (Rantoul), KDEC (Decatur). Then `GET https://api.weather.gov/stations/KCMI/observations/latest`.
   - Measured: `windSpeed` 22.32 km/h, `windDirection` 330°, `windGust` null with `qualityControl` "Z". Gust is often null.

### Gotchas

- Units differ between endpoints: mph strings in hourly versus km/h numbers in the grid.
- Gusts exist only in the grid data and observations.
- The grid endpoint occasionally returns 5xx errors and needs retries (general community knowledge, unverified here).
- Requests need `Accept: application/geo+json` or the default.
- The future API key would break a key-less app. Keep the API client code isolated.

---

## 6. Later phase: elevation (availability only, nothing built)

### 6a. USGS 3DEP

- **License:** https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits says "USGS-authored or produced data and information are considered to be in the U.S. Public Domain." Suggested credit: "Credit: U.S. Geological Survey".
- **Usable and redistributable:** Yes.
- **1 m DEM** (measured by listing the public, non-requester-pays bucket `https://prd-tnm.s3.amazonaws.com/?prefix=StagedProducts/Elevation/1m/Projects/`):
  - Champaign: project `IL_8County_PlusChampaign_2019_B19`. 42 tiles of 10 km touch the county bbox, **8.26 GB**. Example: https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/IL_8County_PlusChampaign_2019_B19/TIFF/USGS_1M_16_x37y442_IL_8County_PlusChampaign_2019_B19.tif
  - Macon: project `IL_SouthCentral_2021_D21`. 27 tiles, **5.44 GB**.
  - Older Champaign 2008 project: 38 tiles, 10.92 GB.
  - **Total for current coverage: about 13.7 GB** (bbox tiles, so this slightly overcounts).
  - Files were re-staged 2026-02-13.
- **1/3 arc-second** (measured HEAD):
  - `https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/{n40w088,n40w089,n40w090,n41w088,n41w089,n41w090}/USGS_13_<tile>.tif`
  - 6 tiles, 426-447 MB each, **2.60 GB total**. Last-Modified ranges from 2022-12-10 to 2026-09-03.
- **TNM Access API** (`https://tnmaccess.nationalmap.gov/api/v1/products`): returned HTTP 504 "Endpoint request timed out" on every attempt, so it is **NOT CONFIRMED**. Direct S3 listing worked instead.
- For contours, 1 m (from QL2 lidar) is far better than 1/3 arc-second (about 10 m) in flat central Illinois.

### 6b. Illinois Height Modernization Program (ILHMP) lidar, ISGS

- Page: https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/
- Status PDF: https://chf.isgs.illinois.edu/distribute/status/IL_LiDAR_Acquisition_Year_April_2026.pdf (not opened).
- Image services: `https://data.isgs.illinois.edu/arcgis/rest/services/Elevation/IL_<County>_{DTM|DSM}_<year>/ImageServer`.

**Coverage, from the table on the page:**
- Champaign: **2008** and **2020**. The 2020 metadata gives collection dates 2019-11-23 to 2020-03-08, QL2+, 0.5 m pulse spacing, 10 cm RMSEz, and a 2 ft DEM.
- City of Champaign-Urbana: 2019.
- Macon: **2011** and **2021**. The 2021 metadata gives 2021-03-06 to 2021-04-05, QL2+, 0.5 m pulse spacing, and a 2 ft DEM.
- **Gotcha:** the Macon 2021 metadata warns that above-ground classification is incomplete, with buildings left in the vegetation class. This affects DSM use, not the bare-earth DTM.

**License** (from the metadata files `https://chf.isgs.illinois.edu/distribute/district5/champaign/2020/Champaign_2020_metadata.xml` and `.../district7/macon/2021/macon_2021_metadata.xml`):
- accconst "No restrictions apply to these data."
- useconst "None. However, users should be aware that temporal changes may have occurred ... Acknowledgement of the U.S. Geological Survey would be appreciated for products derived from these data".
- **Usable:** Yes.

**Formats and sizes** (measured by HEAD):

| File | Bytes |
|---|---|
| `https://chf.isgs.illinois.edu/distribute/district5/champaign/2020/cham_dtm_2020.zip` | 33,024,143,263 |
| `.../champaign/2020/champaign-las2020.zip` | 242,836,851,227 |
| `.../district7/macon/2021/maco_dtm_2021.zip` | 34,119,163,054 |
| `.../macon/2021/macon-las2021.zip` | 164,049,604,773 |
| `.../macon/2021/macon2021.zip` (derivatives) | 63,729,280,453 |

- The page lists Champaign 2020 derivatives as 58.7 GB, but the link `champaign2020.zip` returned **404**.
- DTM/DSM come as ArcGrid (per the page). LAS 1.4 tiles are 2,000 ft.

**Versus 3DEP:** these are the same lidar collections. 3DEP 1 m COG GeoTIFFs (13.7 GB) are far easier to process than 67 GB of ArcGrid zips. **Use 3DEP 1 m for contours.** ISGS is a fallback, and its 2 ft DTM is only marginally finer.

---

## Open questions

1. ISGS 2025 leaf-off imagery: is a county GeoTIFF download available for Champaign, given that Blk2_East has no Download capability? What are the exact flight dates for Champaign and Macon? Ask ISGS.
2. Whether OSMF would treat our vector PMTiles as a Produced Work or a Derivative Database. We plan to treat them as ODbL regardless.
3. The NWS future API key: timing unknown.
4. The NAIP 2025 CCM file format inside the Box zips (MrSID versus JPEG2000) and whether our GDAL build reads it.
5. The USDA APFO NAIP ImageServer was unreachable. Its current status is unknown.

## Addendum: tile counts by polygon

**Measured.** We counted web-mercator tiles with the center or any corner inside the TIGERweb county polygons, and compared that with the union of the two county bboxes.

| Zoom | Tiles touching the polygons | Tiles in the bboxes |
|---|---|---|
| z10 | 10 | 10 |
| z11 | 36 | 36 |
| z12 | 107 | 112 |
| z13 | 346 | 380 |
| z14 | 1,295 | 1,407 |
| z15 | 4,925 | 5,306 |
| z16 | 19,202 | 20,727 |
| z17 | 75,807 | 82,020 |
| z18 | 301,453 | 326,853 |

These confirm the area-based counts used above.

Recomputed NAIP pyramids using the polygon counts and the sample tile sizes (80% farmland / 20% textured weighting):

| Max zoom | JPEG q75 | WebP q75 |
|---|---|---|
| 15 | about 69 MB | about 44 MB |
| 16 | about 246 MB | about 148 MB |
| 17 | about 830 MB | about 428 MB |

Clipping to the county polygons, rather than to the bboxes, saves about 7-8%.
