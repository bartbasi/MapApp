# Data sources

Every data source considered for Phase 1, with its license and the decision. Surveyed on 2026-11-12.

The detailed evidence, with the quoted license text, the page it was read on, the download addresses and how each size was measured, is in two research files:

- `docs/research/base-data-sources.md`: base map, imagery, weather, elevation.
- `docs/research/land-data-sources.md`: public land, hunting sites, crops, woodland, hunting units.

The county parcel findings were made by the lead directly and are written in full below.

**Status words used here**

- **Approved**: the license allows a free, open source app to use the data and to redistribute it. The pipeline may use it.
- **Live only**: the app may query it for what the user views or taps. It may not be copied in bulk or redistributed.
- **Blocked**: must not be used until the named condition is met.
- **Dropped**: not used.

"Both counties" means Champaign County (FIPS 17019) and Macon County (FIPS 17115).

---

## Summary

| Source | Used for | Status | License | Size, both counties | Newest data |
|---|---|---|---|---|---|
| Macon County parcel service | Parcel outlines and owners | Live only | No terms posted | Not copied | Edited 2026-10-28 |
| Champaign County GIS Consortium | Parcel outlines and owners | **Blocked** | Terms forbid copying, public display and reuse | None | Not checked |
| OpenStreetMap, via the Protomaps daily build | Roads, water, woodland, place names | Approved | ODbL 1.0 | 16.7 MB cut by bounding box, 16.2 MB cut by county outline (both measured, zoom 0 to 15) | 2026-11-12 |
| Natural Earth | Coastlines and borders in the zoomed-out base map tiles. It comes inside the Protomaps build. | Approved | Public domain | Inside the base map archive | Not dated |
| US Census TIGER/Line 2026 | County boundaries, which are the hunting units | Approved | Public domain | County outlines come from an 83 MB national file. Roads and water for both counties are 7.3 MB and are not needed while OpenStreetMap supplies them. | 2026-10-06 |
| USDA NAIP 2025, with NAIP 2023 where the 2025 copy has gaps | Aerial imagery (default) | Approved | Public domain | Measured in Step 1: about 8.7 GB read for both counties. Tiles to zoom 16: 226 MB for Champaign County, 141 MB for Macon County | Summer 2025 and summer 2023, leaf-on, built from the 1.2 m level |
| State of Illinois 2025 imagery | Aerial imagery (leaf-off) | Approved, but no complete way to get it yet | Public domain per its metadata | About 700 GB source. As tiles to zoom 17: 0.3 to 0.45 GB in WebP, 0.6 to 0.85 GB in JPEG (estimated) | 2023 to 2025, 6 inch, leaf-off |
| USGS PAD-US 4.1 | Public land boundaries and managers | Approved | Public domain | 0.8 MB (measured) | 2025-03-31 |
| Regional planning commission open spaces (Champaign County Greenways) | Forest preserve boundaries, where PAD-US is out of date | Approved | ODbL | 0.5 MB (measured) | 2024, with 2026 additions |
| Illinois DNR site boundaries | State site boundaries | **Blocked** until the department permits it | No license given | 10 KB | 2025-12 |
| Illinois DNR hunting table by species | Whether hunting is allowed, by species | **Blocked** until the department permits it | No license given | 110 KB | 2026-09 |
| Illinois Recreational Access Program | Leased private hunting land | Dropped | No data is published | None | None |
| Champaign County Forest Preserve District website | Preserve maps | Dropped | All rights reserved | None | None |
| Macon County Conservation District hunt maps | Hunt zones inside district sites | Dropped as data. The app links to them. | PDF maps with no terms | None | 2026 |
| Illinois Nature Preserves boundaries | Nature preserve boundaries | Dropped | Redistribution forbidden | None | None |
| USDA Cropland Data Layer 2025 | Crop types | Approved | Public domain | 5.5 MB (measured, 30 m) | 2025 crop year |
| USFS tree canopy cover, version 2025-6 | Where the woods are | Approved | Free to use with no permission or fee | About 5.5 MB (estimated) | 2025 |
| LANDFIRE existing vegetation type | "Possible oak-hickory" hint | **Blocked** until its license is confirmed | Federal product. No license statement found on its website. | About 11 MB (estimated) | 2024 confirmed, 2025 listed |
| USFS forest type 250 m, TreeMap, species biomass maps | Woodland and oak | Dropped. The research found them unfit for woods this small. | Free | None | 2004 to 2023 |
| National Weather Service API | Wind now and hourly forecast | Approved | Public domain | Live | Live |
| USGS 3DEP elevation | Contours, in a later phase | Approved. Nothing built. | Public domain | 2.6 GB (10 m) or 13.7 GB (1 m) | Lidar 2019 to 2021 |
| Illinois lidar elevation | Contours, in a later phase | Approved. Nothing built. | No restrictions | 67 GB | Same lidar |

The first estimate for Step 1 through Step 5 was under 3 GB. Step 1 alone read about 8.7 GB, because the imagery came as single images and not as county files. No step comes near the 50 GB approval limit.

---

## County parcel data

This is the main risk in Phase 1. Both counties' terms were read in full.

### Macon County: live only

- **What the county publishes.** The county GIS page links to a public parcel viewer. The viewer reads a public ArcGIS feature service named `Parcels2021`, hosted in the county's ArcGIS Online account. Its access is "public" and its only capability is "Query". It holds 57,096 parcels and its data was last edited on 2026-10-28.
- **Terms.** None are posted. The license and credit fields of the service, of the map and of the viewer are empty. The county GIS page has no terms of use, no fee schedule and no data request form. Its download table is empty. The viewer shows one statement: maps "are based on assessment information only and do not represent a legal survey of the parcels shown and shall not be used for conveyance or the establishment of property boundaries". The county website footer, on every page, says "© 2010- Macon County, Illinois. All rights reserved."
- **What that allows.** Nothing forbids querying the service the way the county's own viewer does, so the live lookup is allowed by default. Silence is not a license, and "All rights reserved" means the data may not be copied or redistributed. So there is no bulk download, no bundling, and nothing in the repository. The one copy the app makes is the saved result of a parcel the user tapped, kept on the user's phone. The brief allows it, the county has not addressed it, and it is put to the owner.
- **Fields the app requests.** Parcel ID (`PIN`, `ParcelNumb`), acreage (`Acreage`) and owner name (`PrimaryNam`). A three-record test with no geometry confirmed that `PrimaryNam` holds the owner name.
- **Fields the app never requests.** `PrimaryAdd` (mailing address), `SiteAddres` (site address), and the rest of the service's 91 fields.
- **Requests made in Step 0.** The service description, one count of records, and one test query for three records with no outlines. The test result was read once and deleted. See `docs/research/county-parcel-terms.md`.
- **Data date shown in the app.** The service's last edit date.
- **Credit.** "Parcel data: Macon County, Illinois GIS. Based on assessment information. Not a legal survey."
- **Open.** The owner's permission request is still waiting. A "no" switches this off.

### Champaign County: blocked

- **What the county publishes.** The Champaign County GIS Consortium runs a free public parcel map. Entering it requires accepting a disclaimer and the consortium's terms. The map is down each night from about 10:45 pm to 3:30 am.
- **Terms** (read at `ccgisc.org/TermsOfUse.aspx`, last updated 2013-06-17). They cover the website, its sub-domains and "any associated web-based and mobile applications". The key sentences:
  - "The copying, redistribution, use or publication by you of any portion of our Website is strictly prohibited."
  - "Permission is granted to temporarily download one copy of the materials ... for personal, non-commercial transitory viewing only."
  - Under that license the user may not "modify or copy any of the materials", use them "for any public display (commercial or non-commercial)", or "transfer the materials to another person or 'mirror' the materials on any other server".
  - The map's own page adds: "Copyright © 2026, Champaign County GIS Consortium, All Rights Reserved".
- **Buying the data.** The consortium sells layers and an annual download subscription. Both need a signed license agreement. Prices are not posted. A search result reported license wording that forbids redistribution outside the licensee's organization without written permission. That wording was not read directly.
- **What that allows.** Viewing in the consortium's own map only. An app that queries the service and displays the result is not allowed, and saving tapped parcels is copying. The live lookup is therefore not allowed.
- **Other sources checked.** The regional planning commission's open data site has no parcel dataset. The City of Champaign open data site has no parcel dataset.
- **Not done.** The consortium's map service was not probed or queried, because it sits behind the terms page.
- **Result.** Champaign County has no parcel layer until the consortium grants permission or the owner decides.

---

## Credits the app must show

These go on the attribution screen. The OpenStreetMap credit also sits on the map.

| Source | Credit text |
|---|---|
| OpenStreetMap | © OpenStreetMap contributors (linked to openstreetmap.org/copyright). The tile files are offered under ODbL 1.0. |
| Protomaps tile layout | Protomaps © OpenStreetMap |
| Natural Earth | Made with Natural Earth |
| TIGER/Line | U.S. Census Bureau, TIGER/Line Shapefiles 2026. (Public domain. Used only to cut each county's outline, so it is recorded in each archive's build details and not on the Sources screen.) |
| NAIP | Imagery: USDA NAIP 2025. USDA Farm Production and Conservation Business Center. (One line for each year used. Step 1 uses 2025 and 2023.) |
| Illinois 2025 imagery | Leaf-off imagery: State of Illinois and the University of Illinois (Illinois State Geological Survey), 2025 |
| PAD-US | U.S. Geological Survey Gap Analysis Project, 2024, Protected Areas Database of the United States (PAD-US) 4.1, doi.org/10.5066/P96WBCHS |
| Regional planning commission | Champaign County Regional Planning Commission, Champaign County Greenways, ODbL |
| Cropland Data Layer | USDA National Agricultural Statistics Service, Cropland Data Layer 2025 |
| Tree canopy | USDA Forest Service. 2026. USFS NLCD Percent Tree Canopy CONUS v2025-6 |
| LANDFIRE (if its license is confirmed) | LANDFIRE Existing Vegetation Type, U.S. Department of the Interior, Geological Survey, and U.S. Department of Agriculture |
| Weather | National Weather Service, NOAA |
| Macon County parcels | Parcel data: Macon County, Illinois GIS. Based on assessment information. Not a legal survey. |

---

## Notes that affect the build

- **OpenStreetMap share-alike.** The vector tiles are treated as a database under ODbL, not as a picture of a map. The tile files are published under ODbL and the build scripts are public. The app's code stays GPL. The two licenses do not mix, because the data is not part of the program.
- **Mixing OpenStreetMap with other data.** Public land corrections taken from OpenStreetMap or the planning commission make that layer ODbL too. It is published under ODbL with both credits.
- **PAD-US gaps.** It lists the Middle Fork River Forest Preserve at 38 acres. The real preserve is about 1,704 acres. Overlapping "fee" and "easement" shapes for one site must be filtered or they draw twice. "Open access" in PAD-US means open to the public, not open to hunting.
- **Public land in these counties.** There is no federal land open to the public in either county. The state sites are small. There is no state-run public deer or turkey hunting in either county. State hunting is limited to pheasant and rabbit by lottery at the Gifford habitat area and the Perdueville habitat area. Perdueville straddles the line between Champaign County and Ford County, and the state lists it under Ford County. Ford County is in the chronic wasting disease season list. The Macon County Conservation District runs archery deer hunting by its own lottery at Rock Springs, Sand Creek, Friends Creek and Fort Daniel, with one turkey allowed at Rock Springs, Sand Creek and Fort Daniel. The Champaign County Forest Preserve District bans hunting.
- **The state hunting table is wrong for land the state does not manage.** It marks Friends Creek as "no hunting", while the conservation district hunts it. If permission comes, use the table for state sites only.
- **Leaf-off imagery delivery.** The state image services that cover Macon County have downloads switched on, with a limit of 20 images and 2 GB per request. The service that covers most of Champaign County has downloads switched off. No county download package was found for either.
- **NAIP delivery (settled 2026-11-12, Step 1).** The county mosaics on the USDA Box site can be downloaded directly, with no manual step. But each zip holds a MrSID file (`.sid`), a proprietary format. The open source GDAL tools cannot read it. Reading it needs a free decoder from the format's owner, under that company's own license, which the owner of this project would have to accept. So the mosaics are not used. The aerial layer is built instead from the cloud-optimized GeoTIFF copies of NAIP on the Microsoft Planetary Computer, which need no account. That copy lacks more of the 2025 images than first counted (measured when built): 619 square km of southern Champaign County and 791 square km of eastern Macon County, including Decatur, are filled from NAIP 2023. In Champaign County the join shows as a straight east to west line at latitude 40.0, because the 2025 images there were flown in September over yellow crops and the 2023 images in August over green crops. The Amazon copies charge the downloader and are not used.
- **The terms of the service the imagery was fetched from (read 2026-11-14, after the download).** The imagery was read from Microsoft's Planetary Computer. Its terms were not read before it was used. That was a mistake: the brief says to ask the owner before accepting a license. The service's "Supplemental Terms of Use for Microsoft Planetary Computer Previews" (last updated January 2023, https://planetarycomputer.microsoft.com/terms) say: "By accessing or using the Previews, or attempting to do either, you are accepting these Supplemental Terms and ratifying your acceptance of the TOU." So fetching the imagery accepted Microsoft's terms without the owner being asked. What those terms hold: the service is a preview, offered as is, with no promise that it stays available. Access tokens belong to the person they were issued to, may not be shared or sold, and may be rate limited. Nothing in them claims rights in the hosted imagery or limits what may be done with it. The "TOU" is Microsoft's general Terms of Use (https://www.microsoft.com/en-us/legal/terms-of-use, last updated February 7, 2022). It was read only through a summary tool, which quoted: "Unless otherwise specified, the Services are for your personal and non-commercial use." The owner should read that page himself. The imagery itself is USDA's and is public domain. The service's catalog names the USDA Farm Service Agency as producer and licensor and Microsoft as host. The app never contacts Microsoft. Only the build on the development machine did. **Status: used for the Step 1 test build on the owner's machine only. No aerial archive is published or hosted until the owner decides (Step 1 report, question 2).**
- **NAIP detail level in Step 1.** Full 0.6 m detail for both counties means reading about 50 GB. Step 1 reads the 1.2 m level of each image instead, and only the part of each image that is needed. That came to about 8.7 GB for both counties. Tiles are built to zoom 16. Full detail is a later improvement. It needs either the larger download or the MrSID decoder.
- **Weather.** See DECISIONS D13.
- **Hunting unit rules.** The sources are the Illinois Administrative Code, title 17, parts 650 (firearm deer), 670 (archery deer), 710 (spring turkey), 715 (fall shotgun turkey) and 720 (fall archery turkey). Links are in the land research file, section 7.

## Not confirmed

- The license of LANDFIRE data. It is a joint federal product and very likely public domain, but no statement was found.
- The consortium's data license wording, which was seen only in a search result.

- The flight dates of the Illinois 2025 imagery over these two counties.
- Whether the 2025 LANDFIRE vegetation layer is formally released for this region. The 2024 layer is the fallback.
- Whether any Illinois Recreational Access Program sites exist in either county for 2026.
- The exact 2026 dates of the Macon County Conservation District archery season. Its web page has a typing error in the year.
