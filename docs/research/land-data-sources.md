# Land and habitat data sources: Champaign County (17019) and Macon County (17115), Illinois

Research date: 2026-11-12. Scope: data for building static PMTiles archives that are redistributed publicly with a free GPL-3.0 Android app at zero running cost. County parcel data is out of scope and was not touched.

How to read this file:

- "Measured" means I made a live request on 2026-11-12 (service JSON, count query, HEAD request, TIFF header range read, or a small GeoJSON query) and report the number it returned.
- "Estimated" means I derived the number and say how.
- "NOT CONFIRMED" means I looked and could not verify. What I tried is listed next to it.
- "Unverified (from memory)" marks anything I did not check against a source today.
- License verdicts are research notes, not legal advice.

Size baseline used for every raster below (measured): CropScape's 30 m county clips are uncompressed 8-bit GeoTIFFs. Champaign is 1626 x 2060 px = 3,355,163 bytes and Macon is 2,153,454 bytes, read from the TIFF header and HEAD Content-Length. So one 8-bit 30 m layer covering both counties is about 5.5 MB uncompressed, a 16-bit layer about 11 MB, and a float32 layer about 22 MB, before compression or vectorization. A 10 m layer is 9 times larger.

---

## Summary table

| # | Source | Use and redistribute in a GPL app? | License or terms | Size for 2 counties | Newest data |
|---|---|---|---|---|---|
| 1 | USGS PAD-US 4.1 | Yes | Public domain (ScienceBase "Rights") | 319 features, about 0.8 MB GeoJSON (measured). IL state zip is 205 MB. | PAD-US 4.1, published 2025-03-31. Illinois source dates mostly 2016 to 2024. |
| 2a | IDNR site boundaries (OMLP) | Unclear | No license granted, disclaimer only | 6 polygons, about 10 KB (measured) | Boundary edits to 2025-12-08 |
| 2b | IDNR hunting areas with per-species fields (OMLP Land_Use) | Unclear | No license granted, disclaimer only | 11 polygons, about 110 KB (measured) | Edits 2026-08-27 to 2026-09-08 |
| 2c | IRAP (private-land leases) | No (no data published) | n/a | n/a. No IRAP sites listed for either county. | 2026 county PDFs |
| 3 | Champaign Co. Forest Preserve District | Via proxies only. CCFPD site: no. CCRPC dataset (ODbL): yes. OSM (ODbL): yes. | CCFPD site "All rights reserved". CCRPC: ODbL. | CCRPC county GeoJSON 514,875 bytes (measured) | CCRPC record modified 2024-06-11. Contains 2026 features. |
| 4 | Macon County Conservation District | Via proxies only (PAD-US, OSM) | No district GIS dataset found | n/a | 2026 hunt program pages |
| 5 | USDA NASS CDL | Yes | "public domain and free to redistribute" | 30 m: 5.5 MB uncompressed (measured). 10 m: about 49 MB (estimated). | CDL 2025, released 2026-02-27 |
| 6a | USFS forest type group, 250 m | Yes | Use constraints "None" | Under 100 KB (estimated) | Ground condition 2004, published 2008 |
| 6b | USFS TreeMap 2023 | Yes | "can be used without additional permissions or fees" | About 11 MB per 16-bit attribute, uncompressed (estimated) | Circa 2023, published 2026 |
| 6c | FIA species rasters (BIGMAP 2018, Wilson 2013, FHTET ITSP) | Yes | USFS disclaimer or "without additional permissions or fees" | BIGMAP about 22 MB per species, float32 uncompressed (estimated) | BIGMAP 2014 to 2018 |
| 6d | LANDFIRE EVT (LF 2025) | Yes (with the caveat in its section) | Federal work. Public domain per USGS catalog listings. | About 11 MB, 16-bit uncompressed (estimated) | LF2025_EVT, listed in LFPS |
| 6e | USFS/NLCD Tree Canopy Cover v2025-6 | Yes | "can be used without additional permissions or fees" | About 5.5 MB, 8-bit (estimated) | 2025 canopy, published 2026-04-01 |
| aux | OpenStreetMap | Yes, with share-alike obligations | ODbL 1.0 | Small (tags measured, geometry not) | Live. Overpass base 2026-11-13T03:09Z. |

---

## 1. USGS Protected Areas Database of the United States (PAD-US)

**Current version.** PAD-US 4.1. The USGS download page says "The latest version of the Protected Areas Database of the U.S. (PAD-US 4.1) is now available." I found no evidence of a 4.2 or 5.0 release (web search on 2026-11-12). ScienceBase items:

- State downloads: https://www.sciencebase.gov/catalog/item/6759abcfd34edfeb8710a004, publication date 2025-03-31, last updated 2025-04-08.
- Full inventory: https://www.sciencebase.gov/catalog/item/652d4fc5d34e44db0e2ee45e, publication date 2025-03-31.

**License (verbatim).** The ScienceBase "rights" field on both items reads: "Public Domain. Unless otherwise stated, all data, metadata and related materials are considered to satisfy the quality standards relative to the purpose for which the data were collected. ... nor shall the act of distribution constitute any such warranty." Read via the ScienceBase JSON API at the two item URLs above.

**GPL app use and redistribution: Yes.** It is a public-domain US federal work.

**Required citation (verbatim from ScienceBase).** "U.S. Geological Survey (USGS) Gap Analysis Project (GAP), 2024, Protected Areas Database of the United States (PAD-US) 4.1: U.S. Geological Survey data release, https://doi.org/10.5066/P96WBCHS." The ArcGIS feature services give the year as 2025 in their copyrightText. Use the ScienceBase form.

**Download and service URLs (measured).**

- Illinois state extract: `PADUS4_1_State_IL_GDB_KMZ.zip`, 205,376,871 bytes, from the state item above. Format is GDB plus KMZ.
- National geodatabase: `PADUS4_1Geodatabase.zip`, 1,523,434,496 bytes.
- Download page: https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-data-download
- Feature service used for this research (USGS GAP ArcGIS Online org `v01gqwM5QqNysAAi`): https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Manager_Name_PADUS/FeatureServer/0. Layer name "PADUS4_1ManagerName", maxRecordCount 2000. It includes Fee, Easement and Proclamation features.
- Other 4.1 layers in the same org: `PADUS_Public_Access`, `Fee_Managers_PADUS`, `Manager_Type_PADUS`, `Proclamation_and_Other_Planning_Boundaries_PADUS`.
- A USGS MapServer exists at https://edits.nationalmap.gov/arcgis/rest/services/PAD-US/PAD_US_4_1/MapServer. It returned HTTP 522 on 2026-11-12.

**Fields (measured from the layer JSON).**

- Manager: `Mang_Type` (FED, STAT, DIST, LOC, NGO, PVT, JNT, ...), `Mang_Name`, `Loc_Mang`.
- Owner: `Own_Type`, `Own_Name`.
- Unit name: `Unit_Nm`, `Loc_Nm`.
- Designation: `Des_Tp`, `Loc_Ds`.
- Public access: `Pub_Access` (OA open, RA restricted, XA closed, UK unknown), `Access_Src`, `Access_Dt`.
- Other: `GAP_Sts`, `IUCN_Cat`, `FeatClass`, `GIS_Acres`, `Src_Date`, `Date_Est`, `EsmtHldr`.
- There is no hunting field.

**Coverage of the two counties (measured: spatial-intersect query with TIGERweb county polygons, 2026-11-12).**

| County | Total | Fee | Easement | Proclamation | OA | XA | Acres (Fee / Easement / Proclamation) |
|---|---|---|---|---|---|---|---|
| Champaign | 209 | 191 | 17 | 1 | 183 | 24 | 4,749 / 1,093 / 2,208 |
| Macon | 109 | 88 | 21 | 0 | 84 | 25 | 6,593 / 2,409 / 0 |

- The Champaign total also includes 1 RA (restricted access) and 1 UK (unknown access) feature.
- By manager type, Champaign has 152 LOC, 19 STAT, 17 DIST, 11 PVT, 6 NGO, 3 FED and 1 JNT. Macon has 67 LOC, 28 DIST, 9 STAT, 3 NGO and 2 PVT.
- Counts can include a few features that touch the county line, so they are not clipped. With finer county geometry the combined total was 319 features, about 807 KB as GeoJSON (measured).

**Federal land.** There is no federal fee-owned land in either county.

- Champaign has 3 FED-managed records:
  - A DOD Proclamation boundary for "Chanute Air Force Base" (2,208 ac, `Pub_Access` XA, `Src_Date` 2024/02/12). Chanute closed as an active base in the 1990s (unverified, from memory), so this is a planning boundary, not public land.
  - Two NRCS "Wetlands Reserve Program" easements (191 ac and 10 ac). These are federal easements on private land with `Pub_Access` XA.
- Macon has no FED records.

**Update schedule.** Irregular. Versions 4.0 (2024) and 4.1 (2025). The next release date is NOT CONFIRMED (searched USGS and ScienceBase).

**Gotchas.**

- Most local parks are coded OA. That means open to the public, not open to hunting.
- Champaign County Forest Preserve District holdings are badly under-represented. PAD-US lists Middle Fork as "Middle Fork Land Acquisition Projec", 38 ac, with a 2012 source. CCRPC and OSM show Middle Fork River Forest Preserve at about 1,704 ac. Many CCFPD records carry a 2016/11/29 source date.
- Overlapping Fee and Easement polygons for the same site (for example, Bois du Sangamon and Spitler Woods) will double-draw unless you filter by `FeatClass`.
- The `Pub_Access` value on Illinois Nature Preserves Commission easements is XA even where the fee owner allows visitors.

---

## 2. Illinois Department of Natural Resources (IDNR)

### What IDNR land is actually in the two counties (measured)

IDNR's live site-boundary layer was queried with county polygons (OMLP `SiteBoundary`, see 2a). It returned the following.

**Champaign**

- **Gifford State Habitat Area (SHA).** Owner and manager IDNR, stated area 100.5 ac, `FED_INTEREST` = Y.
- **Perdueville SHA.** Stated area 122.9 ac. The polygon extent is lat 40.385 to 40.407, and the Champaign/Ford county line is at about 40.4006 (measured with TIGERweb). So most of the polygon lies inside Champaign, but IDNR's IPHAR list and huntillinois.org file it under Ford County.

**Macon**

- **Spitler Woods**: classification SP, 202.5 ac. IDNR names now call it "State Natural Area".
- **Calamus Lake State Natural Area**: SNA, 119.25 ac.
- **Lincoln Trail Homestead**: SP, 82.23 ac.
- **Friends Creek**: classification NC, owner and manager Macon County Conservation District, `FED_INTEREST` = Y. It appears in IDNR's layer because of a federal-aid nexus, not because IDNR owns it.

**Nearby but outside both counties.** Clinton Lake SRA (DeWitt), Weldon Springs SP (DeWitt; one unit in Piatt), Kickapoo SRA and Middle Fork SFWA (Vermilion), and Birkbeck, Hallsville and Finfrock (DeWitt).

### 2a. IDNR site boundaries (OMLP: Owned, Managed and Leased Properties)

**Services (measured).**

- Live layer behind the IDNR "Hunter Fact Sheet Maps" app: https://gis.prairie.illinois.edu/arcgis/rest/services/OMLP/OMLP_Parcel_Fabric_No_LandUse/FeatureServer/57 (`SiteBoundary`). 408 features statewide.
  - Fields: `Name`, `CLASSIFICATION` (SP, SNA, SHA, SFWA, SRA, NC, ...), `CURRENT_OWNER`, `MANAGING_AGENCY`, `IDNR_INTEREST`, `FED_INTEREST`, `RetiredByRecord`.
  - The app filters it with `RetiredByRecord IS NULL`.
  - The host is the University of Illinois Prairie Research Institute.
  - The service advertises capabilities "Query,Create,Update,Delete,...". Editing is presumably auth-gated (not tested).
- Older published item "IDNR Site Boundaries Official Master Version": https://www.arcgis.com/home/item.html?id=853ac2021a264c979e8eaa80ba6349e3, pointing to imperialis.inhs.illinois.edu. Item last modified 2020-12-04.
- Public viewer: https://idnr.maps.arcgis.com/apps/webappviewer/index.html?id=fa7f661055a84d3bb03d3b5fb37bbd23. This is a web map; its layers were read from the item JSON.

**Terms (verbatim).** The item licenseInfo says: "This data has limitations as to accuracy and completeness. Illinois Department of Natural Resources is not responsible for misuse of this data. ... should be used for establishing approximations of actual boundary locations only." Source: item 853ac2021a264c979e8eaa80ba6349e3. The related "Fed Aid OMLP Viewer" item says: "These property data were created for internal management use, and should not be used to support legal claims." Source: item dd0726bb284a46449070748c79b6684d. The IDNR web legal notice says: "The Department provides this information on an 'as is' basis" and "The laws of the State of Illinois, U.S.A., shall apply to all uses of this data." Source: https://dnr.illinois.gov/about/privacy.html. None of these grants or denies a reuse license.

**GPL app use and redistribution: Unclear.** The data is public, but no license is granted. State works are not automatically public domain, unlike federal works. The hosting server belongs to the University of Illinois. Recommendation: ask the IDNR property database manager in writing (contact listed in the item metadata above) for permission to redistribute derived tiles. Until then, use PAD-US, which carries IDNR fee boundaries in the public domain (for example, "Gifford State Habitat Area" and "Calamus Lake State Natural Area").

**Attribution.** None specified. If used, credit "Illinois Department of Natural Resources, OMLP".

**Coverage.** 6 polygons intersect the two counties, about 9.9 KB GeoJSON (measured).

**Update and vintage.** The live layer has last_edited dates of 2024-10-28 and, for Spitler Woods, 2025-12-08. There is no published schedule.

**Gotchas.**

- This is a live editing parcel fabric, not a versioned release.
- The URLs are on a university server and could change without notice.
- Perdueville straddles the Champaign/Ford line, and Ford is a CWD county (see section 7).

### 2b. IDNR public hunting sites and per-species hunting rules

**Services found in the Hunt Illinois / Hunter Fact Sheet web map (web map item aca55c3dcd844d61b646d728defe741b, measured).**

1. **`Land_Use`**: https://gis.prairie.illinois.edu/arcgis/rest/services/OMLP/FedAid_and_LandUse/FeatureServer/19. 2,848 features statewide. This is the dataset that says whether hunting is allowed and for which species.
   - Overall fields: `Hunting` (Y/N), `Hunting_Area`, `Area_Zone`, `Exceptions`.
   - Per-species fields: `Deer_Firearm`, `Deer_Archery`, `Deer_Muzzleloader`, `Deer_Late_Winter_Antlerless`, `CWD_Deer_Season`, `Turkey_Spring`, `Turkey_Fall_Gun`, `Turkey_Fall_Bow`, `Squirrel`, `Rabbit`, `Dove`, `Quail`, `Pheasant`, `Woodcock`, `Raccoon_Opossum`, `Red_Fox`, `Coyote`, `Trapping`, `Waterfowl_Walk_In`, `Waterfowl_Blinds`, `Controlled_Pheasant`, `Field_Trials`.
   - Coded domain "hunting_category": C county permit required; CS county and Springfield permit; D disabled hunters; DL disabled and lottery; DS disabled and Springfield; E contact site office for site-specific permit; L lottery permit required; N No; R rare on site, cocks only; S Special Hunt Area permit from Springfield; X available at site; XL available and lottery for waterfowl/upland; Y youth; YD youth disabled; YS youth and site-specific permit; WR waterfowl refuge; MF managed fields.
   - The web map layer "No Hunting" is this layer filtered `Hunting = 'N'`.
2. **`Disolve12Nov26`**: https://services.arcgis.com/b9DHj1BjfdLLFv11/arcgis/rest/services/Disolve12Nov26/FeatureServer/0. 2,637 polygons, fields `Name` and `Area_Zone` only. This layer was created 2026-11-12 19:55 UTC, the day of this research. It looks like a fresh export, so expect the URL to change.
3. **`IPHAR_shp`** (site points): https://services.arcgis.com/b9DHj1BjfdLLFv11/arcgis/rest/services/IPHAR_shp/FeatureServer/0. 262 points. Fields `SITENAME`, `CLASSIFICA`, `LWRCLASSIF`, `County`, `Region`, `Digest`. Data last edited 2026-10-29.
4. **`HFSM_Points`** (parking lots, check stations, blinds, stands): https://services.arcgis.com/b9DHj1BjfdLLFv11/arcgis/rest/services/HFSM_Points/FeatureServer/0. Last edited 2026-11-12. **`HFSM_Lines`** (trails, hunter walkways): https://services.arcgis.com/b9DHj1BjfdLLFv11/arcgis/rest/services/HFSM_Lines/FeatureServer/0.
5. **Human-readable site pages.** https://huntillinois.org/sites/gifford-pha and https://huntillinois.org/sites/perdueville-pha. List: https://dnr.illinois.gov/hunting/factsheets/eastcentral.html.

Org `b9DHj1BjfdLLFv11` is confirmed as "Illinois Department of Natural Resources" via portals/self. Items 2 to 4 are owned by an IDNR wildlife GIS staff account.

**What the data says for the two counties (measured, layer 19).**

| Site | County | Hunting | Deer (all seasons) | Turkey (spring, fall) | Pheasant | Rabbit | Trapping |
|---|---|---|---|---|---|---|---|
| Gifford SHA | Champaign | Y | N | N | L (lottery) | L | E (site permit) |
| Perdueville SHA, South unit | Champaign/Ford line | Y | N | N | L | L | L |
| Spitler Woods SNA | Macon | N | N | N | N | N | N |
| Calamus Lake SNA | Macon | N | N | N | N | N | N |
| Lincoln Trail Homestead | Macon | N | N | N | N | N | N |
| Friends Creek (MCCD) | Macon | N | N | N | N | N | N |

- The huntillinois.org Gifford page agrees: "Requires a lottery-based Free Upland Game Permit" for rabbits and upland birds. Deer, turkey, waterfowl, dove, squirrel and woodcock are not available.
- **Conclusion: there is no IDNR public deer or turkey hunting in either county.** The only IDNR public hunting is upland/rabbit by lottery at Gifford, plus the Champaign-side part of Perdueville.
- **Gotcha:** the layer says Friends Creek hunting = N. In fact, Macon County Conservation District runs a 2026 archery deer and turkey program there (see section 4). IDNR codes only reflect IDNR rules, so do not treat N on non-IDNR land as authoritative.

**Terms.** These are the same as 2a. None of the four hosted layers has licenseInfo or accessInformation (measured: item JSON fields were null). The huntillinois.org site pages show no copyright or terms text.

**GPL app use and redistribution: Unclear.** Same reasoning as 2a. The per-species table is exactly what the app needs, so it is worth requesting written permission.

**Attribution.** None specified.

**Sizes (measured).** Layer 19 in the two counties: 11 polygons, about 110 KB GeoJSON. IPHAR points: 1 point in Champaign (Gifford), 0 in Macon.

**Update schedule.** Edited continuously ahead of each season. Layer 19 rows in these counties were last edited 2026-08-27 to 2026-09-08. No published schedule.

**Gotchas.**

- There are two backends (university ArcGIS Server and IDNR ArcGIS Online), with temporary-looking item names.
- There is no versioning, so pin a snapshot date in the app.
- An older IDNR server, geoservices3.dnr.illinois.gov (Wildlife/HFSM_Lines_Pts), shows a login/token page.

**Related dataset to avoid.** The Illinois Nature Preserves boundaries (item e3dee00d01c445d2a59ae361ed5af2b0, Prairie State Conservation Coalition) say: "The geospatial data files may not be distributed in whole or part without the prior written approval of the contact." **No** for redistribution. PAD-US already contains INPC easement polygons in the public domain.

### 2c. Illinois Recreational Access Program (IRAP)

**What it is.** Hunting, fishing and other access on leased private land.

**How it is published.**

- Pages: https://dnr.illinois.gov/conservation/irap.html and https://dnr.illinois.gov/conservation/irap/irap-sites.html.
- The sites page publishes county PDF maps per activity. It lists fishing, rabbit and squirrel counties, and neither Champaign nor Macon appears.
- The archery deer page (https://dnr.illinois.gov/conservation/irap/archery-deer-hunting.html) shows only statewide county-availability PDFs. Awarded hunters receive "an IRAP parking and site permit, a map, and directions to the site" about three weeks before their season.
- **No GIS data is published**, and exact site locations are given only to permit holders.

**GPL app use and redistribution: No.** There is no dataset, and the locations are deliberately private.

**Coverage.** NOT CONFIRMED whether any 2026 IRAP archery deer or turkey sites exist in Champaign or Macon. The statewide period maps are images that I did not read.

**Gotcha.** Do not scrape the reservation system (https://dnr2.illinois.gov/IRAP/).

---

## 3. Champaign County Forest Preserve District (CCFPD)

**Public GIS dataset from the district.** None found.

- The district's "Interactive Map" (https://www.champaignforests.org/Forest-Preserves/Maps-and-Directions/Interactive-Map) is an EasyDNN marker map with no download.
- Site terms (https://www.champaignforests.org/Terms): "All contents of the Champaign County Forest Preserve District Web Site are: Copyright © 2026 ... All rights reserved." Do not trace district maps.

**Hunting: not allowed.** General Use Ordinance, adopted 2007-09-20, PDF at https://ccfpd.org/Portals/0/adam/Content/rgc15fVO406rRglhx1mriA/Link/RulesRegulationOrdinance.pdf:

- Section V.B(vi) prohibits: "hunt, wound, pursue, kill, trap, maim, capture, molest, or treat cruelly any invertebrate animal, mammal, bird, amphibian or reptile".
- Section V.D(xvii) prohibits possessing "any weapon including, without limitation, handgun, rifle, shotgun, bow and arrow, slingshot, cross bow".
- The Kickapoo Rail Trail rules (joint with Vermilion County Conservation District) say the rail corridor is "closed to hunting". This comes from a search-result snippet of https://www.onekrt.org/_files/ugd/b30b1f_97784416d79948b0a5f51229e54d3c3c.pdf; I did not open the PDF.
- I found no district deer-management hunt program (NOT CONFIRMED that none exists; searched the web and the district rules page).

**Proxy datasets for the preserve boundaries.**

1. **CCRPC "Champaign County Greenways"** (Champaign County Regional Planning Commission open data).
   - Record: https://data.ccrpc.org/dataset/champaign-county-greenways. License: Open Data Commons Open Database License (ODbL).
   - GeoJSON: https://features.ccrpc.org/public/greenways.open_spaces?filename=open_space&token=... (token embedded in the CKAN resource URL). Measured 514,875 bytes, 226 features.
   - It has 15 features with `agency_responsible` = "Champaign County Forest Preserve District". These include Middle Fork River FP (1,704 ac), Homer Lake FP (699 ac), Lake of the Woods FP and Golf Course (850 ac), River Bend FP (284 ac), Sangamon River FP (160 ac), Heron View FP (104 ac), Hidden Acres, Oxbow Ridge, Old Homer Park, Sylvester Woods, Kickapoo Rail Trail and Tomlinson Cemetery.
   - CKAN metadata modified 2024-06-11, but the live file includes a 2026 Kickapoo Rail Trail segment.
   - **Usable: Yes.** Attribution: "Champaign County Regional Planning Commission, Champaign County Greenways, ODbL".
   - Gotcha: ODbL share-alike applies if you redistribute a derived database (vector tiles arguably are one). That is compatible with a GPL app if you publish the derived data under ODbL.
2. **OpenStreetMap.** Present with `operator` tags and most with `boundary=protected_area` (measured via Overpass, base 2026-11-13T03:09Z):
   - Middle Fork River Forest Preserve (relation 16607046)
   - Homer Lake FP (relation 18323110)
   - Lake of the Woods FP (relation 16653387)
   - Sangamon River FP (relation 20266780)
   - River Bend FP (way 431127553)
   - Patton Woods, Hidden Acres, Oxbow Ridge, Old Homer Park
   - None of the CCFPD features has a `hunting=*` tag.
3. **PAD-US.** Partial and outdated (see section 1).

**Coverage, schedule, size.** All of the above cover only Champaign County. There is no published schedule from CCFPD.

**Gotcha.** The district has two domains, ccfpd.org and champaignforests.org.

---

## 4. Macon County Conservation District (MCCD)

**Public GIS dataset from the district.** None found (web search; https://www.maconccd.org/). The old domain maconcountyconservation.org redirects to maconccd.org. Hunt maps exist only as PDFs, for example:

- https://www.maconccd.org/wp-content/uploads/Fort-Daniel-Hunt-Map-2026.pdf
- https://www.maconccd.org/wp-content/uploads/Friends-Creek-Hunt-Map-2026.pdf
- https://www.maconccd.org/wp-content/uploads/Rock-Springs-Hunt-Map-1.pdf
- https://www.maconccd.org/wp-content/uploads/Sand-Creek-Hunt-Map.pdf
- https://www.maconccd.org/wp-content/uploads/Youth-Hunt-Site-Map-Bois-Du-Sangamon-NP.pdf
- https://www.maconccd.org/wp-content/uploads/Willow-Branch-II-Hunt-Map-UPDATE_web.pdf

No terms of use for these PDFs were found (NOT CONFIRMED). Treat them as copyrighted reference only, not as a data source.

**Hunting: yes, limited and by district permit.** "2026 Deer Herd Management Program" page: https://www.maconccd.org/conservation/deer-herd-management/.

- Archery only, at Rock Springs, Sand Creek, Friends Creek and Fort Daniel. The youth program uses designated sites (Bois du Sangamon NP, Willow Branch II).
- Lottery on 2026-09-18 (applications were due 2026-09-11). Permits are $30 in-county, $60 out-of-county, $110 out-of-state, $30 for a second permit. Two deer per permit, antlerless before buck.
- Coyotes and one bearded turkey may be taken. Turkey is allowed at Fort Daniel, Sand Creek and Rock Springs. Per the page, "Friends Creek will not be open to turkey hunting in 2026".
- The season sentence on the page contains a typo ("November 1, 2023 through January 3, 202"), so confirm exact dates with the district.
- Rules PDF: https://www.maconccd.org/wp-content/uploads/Rules-Regs-2026.pdf (not read).
- Upland game: one-day drawn hunts at Friends Creek Upland Game Management Area, applications due 2026-10-01. Page: https://www.maconccd.org/conservation/upland-game-hunting/.

**Proxy boundary datasets.**

- **PAD-US** has the MCCD units as `Mang_Name` = "Macon County Conservation District": Rock Springs (1,283 ac), Sand Creek Open Space Reservation (777 ac), Friends Creek (522 ac), Fort Daniel (189 ac), Grove Branch, Willow Branch, Griswold, Leiby Hall, Bois du Sangamon, Upper Sangamon and Kaufman Addition.
- **OSM** has Rock Springs (relation 7141820), Sand Creek (way 485243993), Fort Daniel (way 485246614), Friends Creek (way 567566697), Griswold, Bois du Sangamon and others (measured via Overpass).
- **Usable: Yes** (public domain and ODbL respectively).

**Gotcha.** The hunting zones inside each area are only in the PDFs. A hunting overlay for MCCD land would have to be hand-digitized from your own field knowledge, or the app should link to the district PDFs rather than copy them.

---

## 5. USDA NASS Cropland Data Layer (CDL)

**License (verbatim, FGDC metadata `useconst`).** "The USDA NASS Cropland Data Layer and the data offered on the CroplandCROS website is provided to the public as is and is considered public domain and free to redistribute. The USDA NASS does not warrant any conclusions drawn from these data." Read in https://www.nass.usda.gov/sites/default/files/Research_and_Science/Cropland/metadata/metadata_CDL24_FGDC-STD-001-1998.xml; the 2025 FAQ repeats it. Access constraints: none.

**GPL app use and redistribution: Yes.**

**Citation.** Per the CDL FAQ, https://www.nass.usda.gov/Research_and_Science/Cropland/sarsfaqs2.php: "United States Department of Agriculture (USDA) National Agricultural Statistics Service (NASS), 20260227, Cropland Data Layer: USDA NASS, USDA NASS Marketing and Information Services Office, Washington, D.C." This is assembled from the FAQ; the date stamp is the 2025 release date.

**Newest year.** CDL 2025, released 2026-02-27. Source: https://www.nass.usda.gov/Research_and_Science/Cropland/SARS1a.php. The CDL is annual and the 2026 CDL is expected early 2027 (estimated from the release pattern).

**Resolution.** "The CDL spatial resolution has been increased from 30-meter to 10-meter beginning in 2024." A 30 m nearest-neighbor resample is also published. 2008 to 2023 are 30 m only.

**How to get a county clip.**

- **CropScape by FIPS (works today, measured).** `https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLFile?year=2025&fips=17019` returns XML pointing to `https://nassgeodata.gmu.edu/webservice/nass_data_cache/byfips/CDL_2025_17019.tif`.
  - Sizes: Champaign 3,355,163 bytes (Last-Modified 2026-03-25); Macon 2,153,454 bytes (2026-04-12).
  - The header read shows 1626 x 2060 px, uncompressed, which is consistent with 30 m. **CropScape serves the 30 m version for 2024 and 2025.** File sizes are nearly identical to 2023.
- **CroplandCROS** (https://croplandcros.scinet.usda.gov/) is backed by ImageServer https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer. Its catalog lists `2024_10m_cdls` and `2025_10m_cdls` (LowPS 10), with maxImageWidth 4097. A 10 m clip via exportImage needs about 2 tiles for Champaign (estimated: 4,900 x 6,200 px at 10 m).
- **National zips.**
  - https://www.nass.usda.gov/sites/default/files/Research_and_Science/Cropland/Release/datasets/2025_10m_cdls.zip (9.8 GB per the release page)
  - https://www.nass.usda.gov/sites/default/files/Research_and_Science/Cropland/Release/datasets/2025_30m_cdls.zip (1.9 GB)
  - There are no state zips.

**Sizes for the two counties.**

- 30 m: 5,508,617 bytes uncompressed GeoTIFF (measured, both CropScape files).
- 10 m: about 49 MB uncompressed (estimated, 9 times as large). Expect a much smaller result after LZW/deflate compression or after vectorizing only a few classes (not measured).

**Legend.** https://www.nass.usda.gov/sites/default/files/Research_and_Science/Cropland/docs/cdl_codes_names.xlsx (13,674 bytes, parsed). Classes relevant here:

| Code | Class |
|---|---|
| 1 | Corn |
| 4 | Sorghum |
| 5 | Soybeans |
| 21 | Barley |
| 24 | Winter_Wheat |
| 26 | Dbl_Crop_WinWht/Soybeans |
| 27 | Rye |
| 28 | Oats |
| 36 | Alfalfa |
| 37 | Other_Hay/Non_Alfalfa |
| 58 | Clover/Wildflowers |
| 59 | Sod/Grass_Seed |
| 60 | Switchgrass |
| 61 | Fallow/Idle_Cropland |
| 111 | Open_Water |
| 121 to 124 | Developed (Open Space, Low, Med, High) |
| 131 | Barren |
| 141 | Deciduous_Forest |
| 142 | Evergreen_Forest |
| 143 | Mixed_Forest |
| 152 | Shrubland |
| 176 | Grassland/Pasture |
| 190 | Woody_Wetlands |
| 195 | Herbaceous_Wetlands |

The GeoTIFFs also embed a colormap.

**Gotchas.**

- Non-agricultural classes such as forest come from NLCD. The FAQ says they are "entirely dependent upon the USGS, National Land Cover Database", and the 2025 CDL uses NLCD 2024. So the CDL forest classes carry no species information.
- The 2025 national accuracy statement in the FAQ is "75.4% OVERALL CROP ACCURACY". Per-state Illinois matrices are in https://www.nass.usda.gov/sites/default/files/Research_and_Science/Cropland/docs/CDL_2025_accuracy_assessments.zip (not opened).
- State-level metadata is no longer published from 2024 on.
- The 2025 FGDC XML at the /Research_and_Science/... path returned "Page not found". The 2024 XML at /sites/default/files/... works.

---

## 6. Woodland and likely oak or mast-producing stands

**Context.** In both counties, woods are mostly narrow corridors along the Sangamon, Middle Fork/Salt Fork and Kaskaskia drainages plus small remnant woodlots. A 30 m pixel is about the width of a narrow riparian strip, and a 250 m pixel is wider than most of these woods. The forest share of each county was not measured.

### 6a. USFS national forest type group raster (250 m)

- **Source.** https://data.fs.usda.gov/geodata/rastergateway/forest_type/. Files `conus_forestgroup.zip` (160 MB) and `conus_forest-type.zip` (170 MB), per the page.
- **Metadata.** https://data.fs.usda.gov/geodata/rastergateway/forest_type/conus_forest_type_group_metadata.php: 250 m cells, "Calendar_Date: 2004", publication 2008.
- **License (verbatim).** "Use_Constraints: None. It is the responsibility of the data user to use the data appropriately..." and "Access_Constraints: None".
- **Usable: Yes.**
- **Citation.** USDA Forest Service FIA & GTAC (2008), "Conterminous U.S. and Alaska Forest Type Mapping Using Forest Inventory and Analysis Data". Paper: Ruefenacht et al. 2008, PE&RS.
- **Clip.** Download the CONUS zip and clip locally. The two-county clip is under 100 KB (estimated: about 90,000 pixels of 250 m).
- **Newer alternatives.**
  - Image service of the FIA Forest Atlas forest type groups, 250 m, metadata pubdate 2026-02-13: https://imagery.geoplatform.gov/iipp/rest/services/Vegetation/USFS_EDW_FIA_ForestAtlas_ForestTypeGroups_109_CONUS/ImageServer
  - 30 m BIGMAP forest type group 2018: https://imagery.geoplatform.gov/iipp/rest/services/Vegetation/USFS_FIA_BIGMAP_CONUS_ForestTypeGroup_2018/ImageServer
- **Honesty for oak-hickory.** Poor. The paper reports 69% overall accuracy for forest type group nationally. At 250 m nearly every riparian strip here is mixed with cropland, and the 2004 vintage is old. Use it for regional context only.

### 6b. USFS TreeMap (FIA plot imputation, 30 m)

- **Newest version.** TreeMap 2023 CONUS, published 2026: https://www.fs.usda.gov/rds/archive/catalog/RDS-2026-0038. The complete zip is 4.87 GB. Earlier versions: 2016, 2020, 2022.
- **Per-attribute 30 m GeoTIFFs** are listed at https://data.fs.usda.gov/geodata/rastergateway/treemap/. They include `FORTYPCD` (algorithm forest type), `FLDTYPCD` (field forest type), `BALIVE`, `CANOPYPCT`, `STANDHT` and `TM_ID`. Per-attribute file sizes NOT CONFIRMED (not listed on the page).
- **Species data.** Tree-level species, DBH and height are in a companion CSV keyed by `TM_ID`. That lets you compute oak/hickory basal-area share of the imputed plot for each pixel.
- **License (verbatim).** "These data were collected using funding from the U.S. Government and can be used without additional permissions or fees."
- **Usable: Yes.**
- **Citation.** Zimmer et al. 2026, "TreeMap 2023 CONUS: A tree-level model of the forests of the conterminous United States circa 2023", Forest Service Research Data Archive, https://doi.org/10.2737/RDS-2026-0038.
- **Clip.** No clip service found. Download the per-attribute CONUS GeoTIFF and clip locally, or use the Google Earth Engine asset (`USFS/GTAC/TreeMap/...`). Two-county clip about 11 MB per 16-bit attribute, uncompressed (estimated).
- **Honesty.** Each forested pixel receives the attributes of one real FIA plot chosen as most similar, so plot-level species mixes get copied across the landscape. It is good for "this woodlot is probably in an oak-hickory forest type" at a stand-group level. It is not reliable for individual small woods.

### 6c. FIA-based species rasters

1. **BIGMAP 2018 tree species aboveground biomass** (30 m, Landsat 2014 to 2018 plus 212,978 FIA plots).
   - Page: https://data.fs.usda.gov/geodata/rastergateway/bigmap/index.php. Per-species zips, for example `BIGMAP_AGB_2018_SPCD0802_WHITE_OAK.zip` and `..._SPCD0833_NORTHERN_RED_OAK.zip`, `0823` bur oak, `0837` black oak, `0817` shingle oak, `0407` shagbark hickory, `0400` hickory spp.
   - Image service with one raster function per species (329 functions, float32): https://imagery.geoplatform.gov/iipp/rest/services/Vegetation/USFS_FIA_BIGMAP_AboveGroundBiomass/ImageServer. It can clip via exportImage.
   - Terms: the USFS Enterprise Data Disclaimer only ("makes no warranty... not legal documents"). There is no restrictive clause, and it is a federal work. **Usable: Yes.**
   - Citation: NOT CONFIRMED verbatim. The page cites Wilson, Knight & McRoberts 2018 (ISPRS J.) and related Wilson papers.
   - Size: about 22 MB per species, float32 uncompressed (estimated). Most pixels are NoData.
2. **Live tree species basal area 2000 to 2009** (Wilson et al. 2013, 250 m), https://www.fs.usda.gov/rds/archive/catalog/RDS-2013-0013.
   - Raster zips are grouped by species code: s10 to s350 is 818.97 MB, s351 to s600 is 742.35 MB, s601 to s825 is 848.91 MB, s826 to s999 is 575.03 MB.
   - "These data were collected using funding from the U.S. Government and can be used without additional permissions or fees." **Usable: Yes.**
   - Too coarse and too old for this use.
3. **Individual Tree Species Parameter maps** (FHTET, for NIDRM). 30 m basal area and SDI per species, "circa 2002".
   - Page: https://fs.usda.gov/science-technology/data-tools-products/fhp-mapping-reporting/individual-tree-species-parameter-maps. Image service: https://imagery.geoplatform.gov/iipp/rest/services/Vegetation/USFS_EDW_FHP_TreeSpeciesMetrics_BasalArea/ImageServer. A catalog query for oak items returned HTTP 403.
   - Use constraint: the USFS planning-purposes disclaimer. **Usable: Yes.** Too old (about 2002).

**Spot check (measured, BIGMAP identify, 2026-11-12).** Total biomass and white oak / northern red oak / sugar maple biomass, in tons per acre:

| Point | Total | White oak | Northern red oak | Sugar maple |
|---|---|---|---|---|
| Brownfield Woods | 186.7 | 12.6 | 9.3 | 9.2 |
| Trelease Woods | 220.1 | 14.7 | 14.3 | 9.0 |
| Allerton area, Piatt (control) | 197.5 | 6.0 | 13.1 | 7.1 |
| Cornfield (-88.30, 40.25) | NoData | | | |

The point coordinates were approximate. The pattern shows the issue: every forested pixel gets a smooth blend of many species with oaks at about 5 to 7% of biomass. **BIGMAP cannot tell an oak woodlot from a maple woodlot at this scale.**

### 6d. LANDFIRE Existing Vegetation Type (EVT, 30 m)

- **Newest version.** `LF2025_EVT` is listed as CONUS-available in the LANDFIRE Product Service catalog (https://lfps.usgs.gov/api/products, measured). The LF2025 schedule page (https://landfire.gov/data/lf2025) lists the full NC/NE/SE/SC extent for November 2026 and CONUS for December 2026. Check the release notes before relying on LF2025 here. LF2024_EVT (v2.5.0) is the fallback.
- **Image service** (S16, 30 m): https://lfps.usgs.gov/arcgis/rest/services/Landfire_LF2025/LF2025_EVT_CONUS/ImageServer.
- **Clip.** LFPS GP service https://lfps.usgs.gov/arcgis/rest/services/LandfireProductService/GPServer/LandfireProductService. Parameters: `Layer_List`, `Area_of_Interest` (bbox or map zone), `Output_Projection`, `Resample_Resolution`. It returns a multi-band GeoTIFF zip.
- **Legend CSV.** https://landfire.gov/sites/default/files/CSV/2024/LF2024_EVT.csv (1,069 rows; fields VALUE, EVT_NAME, EVT_PHYS, EVT_GP_N, SAF_SRM, ...). A 2025 CSV was not found at the analogous URL.
- **License.** No license statement found on landfire.gov (FAQ checked). USGS catalog entries list LANDFIRE products as public domain (per web search, not opened). It is a USGS/USFS federal product. **Usable: Yes** (treat as public domain; confirm on the data.usgs.gov record for LF2025 EVT).
- **Citation format** (LANDFIRE FAQ, https://www.landfire.gov/faqs): "Homepage title: Data product". For example: "LANDFIRE: LANDFIRE Existing Vegetation Type layer. (2025). U.S. Department of Interior, Geological Survey, and U.S. Department of Agriculture." The example is unverified wording; check the FAQ for the exact template.
- **Oak-relevant classes** (LF2024 CSV, measured):
  - 7310 "North-Central Interior Dry-Mesic Oak Forest and Woodland" (group "White Oak-Red Oak-Hickory Forest and Woodland")
  - 7311 "North-Central Interior Dry Oak Forest and Woodland"
  - 7394 "North-Central Interior Oak Savanna"
  - 7905 "Eastern Cool Temperate Urban Deciduous Forest"
- **Spot check (measured, LF2025 EVT identify; coordinates approximate).**
  - Brownfield Woods and Trelease Woods: both 7310 (dry-mesic oak).
  - Sangamon corridor near Mahomet: 7905 (urban deciduous forest).
  - A Middle Fork point: 7974 (row crop). My point likely missed the woods.
  - A Rock Springs point: 7296 (developed low intensity). Likely also a missed point.
- **Honesty.** LANDFIRE says its products "were designed to support national, regional, and sub-regional analysis" and "are not intended to replace local products". EVT labels Ecological Systems, not measured stands. A wooded pixel in central Illinois tends to be labeled with the regionally likely oak system, or a floodplain or developed class. It flags potential oak-hickory sites, not confirmed mast trees. Size: about 11 MB, 16-bit uncompressed, for both counties (estimated).

### 6e. NLCD / USFS Tree Canopy Cover (TCC)

- **Version.** v2025-6, annual 1985 to 2025, 30 m, metadata pubdate 2026-04-01. Page: https://data.fs.usda.gov/geodata/rastergateway/treecanopycover/.
- **Image service.** https://imagery.geoplatform.gov/iipp/rest/services/Vegetation/USFS_EDW_NLCD_TCC_CONUS/ImageServer (maxImageWidth 100,000, so a two-county exportImage is a single request). Also on MRLC (https://www.mrlc.gov/) and Earth Engine.
- **License (verbatim, service metadata `useconst`).** "These data were collected using funding from the U.S. Government and can be used without additional permissions or fees." A data.gov record for v2023-5 is reported as CC BY 4.0 (per search, not opened). Either way, it is redistributable with attribution. **Usable: Yes.**
- **Citation (verbatim).** "USDA Forest Service. 2026. USFS NLCD Percent Tree Canopy CONUS v2025-6. Salt Lake City, UT."
- **Size.** About 5.5 MB, 8-bit uncompressed (estimated).
- **Honesty.** This is the best layer for where the woods are, including narrow corridors and fencerows partly resolved at 30 m. It carries no species information at all.

### Recommendation for woodland and oak

Build a "woods" layer from **TCC v2025-6**: canopy at or above about 40%, polygonized and simplified. Then attach a "likely oak-hickory" attribute where **LANDFIRE EVT** is 7310, 7311 or 7394. Optionally add a TreeMap 2023 `FORTYPCD` oak-hickory group code as a second vote.

Show the result as "possible oak-hickory (modeled)". Never present it as "oak stand".

**How reliable this is, plainly:** reliable for where tree cover is, and weak for which trees. In this farm country, expect the oak label to be right often enough to point a scout toward upland woods on slopes above the rivers. Expect it to be wrong for many floodplain woods (silver maple, cottonwood, box elder) and urban woods. It cannot find individual mast-producing trees. No public dataset tested here can tell an oak woodlot from a maple woodlot at the scale of these woods (see the BIGMAP spot check). Skip the 250 m products entirely.

---

## 7. Hunting units: how Illinois defines permit areas (IDNR primary sources)

**Firearm deer.**

- 17 Ill. Adm. Code 650.10(b): "Permit quotas shall be set by the Department of Natural Resources (Department) on a county or special hunt area basis. Cook, DuPage and Lake Counties (except for Chain O'Lakes State Park) and that portion of Kane County east of State Route 47, are closed to firearm deer hunting." Amended 49 Ill. Reg. 11755, effective 2025-09-02. https://www.ilga.gov/commission/jcar/admincode/017/017006500000100R.html
- IDNR also says: "Unfilled firearm and muzzleloader deer permits are valid only for the county for which they were originally issued." https://dnr.illinois.gov/content/dam/soi/en/web/dnr/hunting/deer/documents/2026-2027specialcwdseasonhuntinginformation.pdf
- So **permits are county-specific, and Champaign and Macon are open** (not in the closed list).
- 2026 dates: Nov 20 to 22 and Dec 3 to 6. OTC sale of remaining county quotas began 2026-10-20. https://dnr.illinois.gov/hunting/deerfirearmmuzzleloader.html
- 2026 county quota numbers for these two counties: NOT CONFIRMED (the post-Lottery-3 quota PDF was not found).

**Muzzleloader.** County-specific, same rule as firearm.

**Archery deer.**

- 17 Ill. Adm. Code 670.20(a): "Archery deer permits ... will authorize the holder to hunt in any of the open counties of the State." So **archery permits are statewide**. https://www.ilga.gov/commission/jcar/admincode/017/017006700000200R.html
- Season: Oct 1 to the first Sunday after Jan 13, closed during the firearm season. In 2026-27: Oct 1 to Nov 19, Nov 23 to Dec 2, Dec 7 to Jan 17. https://dnr.illinois.gov/hunting/deerarcheryinformation.html
- **Special zone that hits both counties.** 670.40(b): "The Illinois Restricted Archery Zone shall consist of Champaign, Douglas, Macon and Piatt Counties (except Allerton Park located in Piatt County). During the period October 1-October 31, only antlered deer may be harvested in the Restricted Archery Zone, regardless of permits in possession." Amended 49 Ill. Reg. 11791, effective 2025-09-02. https://www.ilga.gov/commission/jcar/admincode/017/017006700000400R.html
- The IDNR archery page and the 2025-2026 Deer Harvest Report ("permitted to harvest only antlered deer during the first 31 days") agree.
- Gotcha: the Outdoor Illinois article on the 2026-27 Digest words it as "limited to the harvest of antlerless deer". That contradicts the rule text, so trust the rule.

**CWD and late-winter seasons.**

- Special CWD Deer Season counties for 2026-27: Adams, Boone, Bureau, Carroll, DeKalb, Effingham, Ford, Grundy, Jo Daviess, Kane, Kankakee, Kendall, LaSalle, Lee, Livingston, Marshall, McHenry, Ogle, Peoria, Putnam, Scott, Stark, Stephenson, Will, Winnebago.
- Late-Winter Antlerless counties do not include Champaign or Macon.
- **Neither county is in either list.** Ford County, which borders Champaign to the north and contains the Perdueville SHA that straddles the line, is a CWD county.
- Sources: the CWD PDF above and https://dnr.illinois.gov/content/dam/soi/en/web/dnr/hunting/deer/documents/2026-2027latewinterhuntinginformation.pdf

**Spring turkey.**

- 17 Ill. Adm. Code 710.10(d) lists Champaign and Macon as Northern Zone open counties. 710.20(b): "Permits are issued for a specific county or area and are valid only in the county or area designated on the permit." https://www.ilga.gov/commission/jcar/admincode/017/017007100000100R.html and .../017007100000200R.html
- Both counties had 2026 permits remaining after Lottery 1. Champaign: 140, 123, 148, 162, 165 for seasons 1 to 5. Macon: 14, 13, 20, 20, 20. https://dnr.illinois.gov/content/dam/soi/en/web/dnr/hunting/turkey/2026springturkeyremainingcountyquotasafterL1.pdf

**Fall turkey.**

- Fall gun (shotgun) turkey is county-specific (715.20(b)) and only in listed counties (715.10(b)). **Neither Champaign nor Macon is open.** https://www.ilga.gov/commission/jcar/admincode/017/017007150000100R.html
- Fall archery turkey (Part 720) uses statewide OTC permits. The season is open in all counties Oct 1 to the first Sunday after Jan 13, closed during firearm deer season. https://www.ilga.gov/commission/jcar/admincode/017/017007200000100R.html

**Data note.** No GIS layer of "permit units" is needed: units are county boundaries (use TIGER/Line, public domain) plus the Restricted Archery Zone, which is the union of four counties. The app should key season rules by county FIPS and pull dates and lists from the IDNR rules each license year.

---

## Auxiliary: OpenStreetMap

- **License.** ODbL 1.0. Attribution: "© OpenStreetMap contributors".
- **GPL app: Yes.** Redistributing derived tiles or a database triggers ODbL share-alike for that database, not for app code.
- **Coverage.** Good for CCFPD, MCCD and IDNR sites in both counties (measured tags; see sections 3 and 4).
- **Gotcha.** Gifford and Perdueville carry `hunting=yes`, while CCFPD and MCCD areas have no hunting tag. OSM hunting tags are volunteer-entered and not authoritative.

## Open questions

1. Will IDNR grant written permission to redistribute OMLP site boundaries and the `Land_Use` per-species hunting table? This is the single most valuable dataset for the app.
2. Are there any 2026 IRAP archery deer or turkey sites in Champaign or Macon? The statewide period map images were not read.
3. 2026 firearm and muzzleloader county quotas for Champaign and Macon. The post-lottery quota PDF was not found.
4. Has LF2025 EVT for the North Central GeoArea been formally released? LFPS lists it, but the schedule says Nov to Dec 2026.
5. Exact MCCD 2026 archery season dates (the page has a typo), and whether MCCD will allow derived hunt-zone polygons.
6. BIGMAP verbatim citation and license text, and CDL 2025 FGDC XML (the URL 404s).
