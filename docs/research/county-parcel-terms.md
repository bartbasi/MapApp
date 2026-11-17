# County parcel terms: what was read and what was requested

Done by the lead on 2026-11-12. This file records the addresses, the facts read from them, and every request made to a county service, so the conclusions in `docs/DECISIONS.md` (D8) can be checked.

No parcel records are stored in this repository. No owner name appears in this file.

## Macon County

### Pages and services

| What | Address |
|---|---|
| County GIS page | `https://maconcounty.illinois.gov/departments/gis/` |
| Public parcel viewer ("Interactive Map" link on that page) | `https://experience.arcgis.com/experience/7fbdb13536964337aa8e563d59146905` |
| The viewer's map, "Tax Parcel Map" | ArcGIS Online item `9bdfc0d29b1d4fc1b392b1f23c913dd1` |
| Parcel layer item, "Parcels - Syled" | ArcGIS Online item `2b936bc9479d4c27b463bc3e2f93f561` |
| Parcel feature service | `https://services1.arcgis.com/a3k0qIja5SolIRYR/arcgis/rest/services/Parcels2021/FeatureServer/1` |
| County ArcGIS Online home | `https://maconcounty.maps.arcgis.com/` |
| GIS office contact shown on the county page | `gis@maconcounty.illinois.gov`, (217) 424-1364 |

### What the metadata says (read from the public item and service descriptions)

- Viewer item: type "Web Experience", access "public", `licenseInfo` empty, `accessInformation` empty, description empty.
- Map item: access "public", `licenseInfo` empty, `accessInformation` empty.
- Parcel layer item: access "public", `licenseInfo` empty, `accessInformation` empty.
- Feature service: capabilities "Query" only. `copyrightText` empty. `maxRecordCount` 2000. Query formats JSON, GeoJSON and PBF. Geometry type polygon. 91 fields.
- Data last edited: 2026-10-28 (from the layer's `editingInfo`).
- The viewer's opening text: "All maps maintained and provided by Macon County are based on assessment information only and do not represent a legal survey of the parcels shown and shall not be used for conveyance or the establishment of property boundaries".
- The county GIS page has no terms of use, fee schedule or data request form. Its "GIS Downloads" table is empty. Its footer reads "© 2010- Macon County, Illinois. All rights reserved." That footer is on every page of the county website.

### Fields

The fields the app will request: `PIN`, `ParcelNumb` (parcel ID), `Acreage`, `PrimaryNam` (owner name).

Fields the app must never request include `PrimaryAdd` (mailing address) and `SiteAddres` (site address). The rest are survey, legal description and tax fields the app does not need.

### Every request made to the Macon County service in Step 0

1. The service and layer descriptions (metadata only, no records).
2. A count of all records, which returned 57,096. No records were returned.
3. One test query for three records with no geometry and eight attribute fields (parcel ID in two forms, acreage, owner name, use code, township name and two area fields), to confirm which field holds the owner name. The result was read once to confirm that `PrimaryNam` holds a name, and the temporary file was deleted. Nothing from it was written to the repository.

No outlines were requested. Nothing was downloaded in bulk.

### Reading

Nothing posted forbids querying this public service the way the county's own viewer does. Nothing posted grants a right to copy or redistribute the data either, and the website footer reserves all rights. The live lookup follows from the first point. The second point is why nothing is bundled, hosted or committed.

One point needs the owner's eye. The brief says the app may keep, on the phone, the results for parcels the user has tapped. Each saved result is a copy of one public record, made by the user on the user's own device. That is much less than what the Champaign terms forbid in writing, and Macon County has no written terms at all, but it is still a copy with no stated permission. It is raised as a question in the Step 0 report.

## Champaign County

### Pages

| What | Address |
|---|---|
| Champaign County GIS Consortium home | `https://www.ccgisc.org/` |
| Terms and Conditions (last updated 2013-06-17) | `https://www.ccgisc.org/TermsOfUse.aspx` |
| Data and services (sales, license agreement) | `https://www.ccgisc.org/DataAndServices.aspx` |
| Public parcel map. It forwards to the disclaimer page first. | `https://maps.ccgisc.org/` |
| Disclaimer page with "Accept the Terms to Enter Map" | `https://maps.ccgisc.org/public/Disclaimer.aspx` |
| Consortium contact | `ccgisc@co.champaign.il.us`, 217-819-3555 |

### What the terms say

Quoted from the Terms and Conditions page:

- Scope: the terms govern "our website, www.ccgisc.org, sub-domains, and any associated web-based and mobile applications".
- "Our Website is also protected under international copyright laws. The copying, redistribution, use or publication by you of any portion of our Website is strictly prohibited."
- "Permission is granted to temporarily download one copy of the materials (information or software or image) on CCGISC's Website for personal, non-commercial transitory viewing only."
- Under that license the user may not: "Modify or copy any of the materials; Use the materials for any commercial purpose, or for any public display (commercial or non-commercial); ... Transfer the materials to another person or 'mirror' the materials on any other server."
- "Upon terminating your viewing of these materials or upon the termination of this license, you must destroy any downloaded materials in your possession whether in electronic or printed format."

The disclaimer page adds "Copyright © 2026, Champaign County GIS Consortium, All Rights Reserved" and notes that the map is unavailable each evening from about 10:45 pm to 3:30 am Central time.

### Sales

The data and services page says data is sold two ways: single layers through a data request, or an annual download subscription. It says both "require the submission of a signed license agreement". No prices are posted on that page.

A web search summary of a consortium data item reported license wording that forbids "reproduction or redistribution of digital data products derived from the provided digital data for use outside Licensee's organization" without written permission. That item was behind a sign-in page and was not read directly. Treat that wording as unconfirmed.

### Other sources searched for openly licensed Champaign County parcels

- Champaign County Regional Planning Commission open data, `https://data.ccrpc.org/`: a search for "parcel" returned four datasets, none of them a parcel layer.
- City of Champaign open data, `https://gis-cityofchampaign.opendata.arcgis.com/`: a search for "parcel" returned one unrelated dataset.

### Requests made to the Champaign County map service in Step 0

None. The map sits behind the terms page, so it was not opened, probed or queried. Only the public web pages listed above were read.

### Reading

The terms allow a person to look at the map. They forbid copying, public display, and reuse of any portion. An app that queries the map service and shows the result to its users is reuse and display, and saving a tapped parcel is copying. The live lookup is therefore not allowed for Champaign County without the consortium's permission.

### Step 2 search for a readable service (2026-11-17)

The owner said on 2026-11-17 that the county allows a stored copy (D25). D25 allows the consortium's own service only if it can be found and read without accepting the terms page and without a login or token. The data engineer looked for one on 2026-11-17 with 18 requests, one at a time, about a second apart. No form was submitted, no cookie was set, and no token or login was used. Each request is in the local log `data/logs/parcels/requests-il-champaign.log` (not in git).

**Result: no openly readable parcel service exists. Champaign County is not built.**

What was found, in order:

1. The disclaimer page's source (saved in Step 0, read again, no new request) has no service address. Its "Accept the Terms to Enter Map" link runs a server form post. It was not used. The page also offers a "Mobile Map Application" link, `https://maps.ccgisc.org/mobile/`, to phone visitors before any acceptance.
2. `https://maps.ccgisc.org/mobile/` loads without acceptance. It forwards to the consortium's ArcGIS Enterprise portal: `https://services.ccgisc.org/portal/apps/webappviewer/index.html?id=6d8117a581f0453f8719389e9b42d56d`.
3. That app's item (`/portal/sharing/rest/content/items/6d8117a581f0453f8719389e9b42d56d`): "Mobile Interactive Public Application", access public. Its license field reads: "Unauthorized use of this service and/or the data it contains is strictly prohibited and punishable by law." Every consortium item read below carries the same sentence.
4. The app's configuration has a splash screen headed "Champaign County GIS Web Maps Disclaimer": "Copyright © 2021, Champaign County GIS Consortium, All Rights Reserved", a no-warranty statement, "The use of this application constitutes acknowledgement of this disclaimer", and the nightly outage. It does not require a click (`requireConfirm` false). It has no copying clause. It was read from the configuration, not shown in a browser.
5. The app's web map, item `deb5ca20e9ca4dda9c4c978d42a77145` ("Mobile Interactive Public Map"), lists about 35 layers. The parcel layer is sublayer 1 ("PIN | {PIN}") of the "Mobile Public Pop-up" service. Every consortium layer is addressed through the portal's proxy, in the form `https://services.ccgisc.org/portal/sharing/servers/<item id>/rest/services/General/Pop_Ups/MapServer`.
6. The pop-up service's item `6f68b33636234c19aeb0601dbc50d9fa` carries the type keyword "Service Proxy". ArcGIS adds that keyword when the publisher stores a login with the item, so that the portal signs in to the real service on each visitor's behalf.
7. The real server's directory, `https://services.ccgisc.org/server/rest/services?f=json`, is readable. It is ArcGIS Server 11.5 with 20 folders (AddressingInterface, AGO_CountyExec, Assessor, Basemaps_Champaign, ClipAndShip, CountyClerk, DrainageDistrictProject, EmergencyManagement, General, Geocode, Geoprocess, Highway, Linear_Referencing, Municipal_Zoning, MunicipalPlanningAndZoning, Opioid_Data, ParcelFabric, PlanningAndZoning, Savoy, Utilities) and no service at the top level.
8. The parcel layer itself, `https://services.ccgisc.org/server/rest/services/General/Pop_Ups/MapServer/1?f=json`, answers error 499 "Token Required".
9. The folders Assessor, ParcelFabric, General and AGO_CountyExec each answer error 499 "Token Required".
10. The portal's public search for "parcel" lists 25 items. Every parcel service among them ("Tax Parcels Less Than 2000 sq. ft.", "Mobile Public Pop-up", "Universal Searches", two "Parcel Search", "Parcel Change Genealogy View", "Tax Parcels Look Up", "PIN Centroid Search", "Retiring Subdivisions, Lots and Parcels") is reached only through the same proxy.
11. ArcGIS Online, search "champaign county parcels": 40 items. The parcel layers there belong to Champaign County, Ohio (the engineer's office there) or are University of Illinois student copies. The student copies are third-party copies and are not used.
12. ArcGIS Online, items of the consortium's account `ChampaignCountyGIS`: 23 items, none a parcel layer. Its map services are reached through `utility.arcgis.com/usrsvcs/servers/...`, which is Esri's stored-login proxy.
13. ArcGIS Online, search "illinois statewide parcels": no statewide Illinois parcel dataset. No official State of Illinois parcel dataset was found.

**Reading.** The parcel data can be read only through the portal's proxy, which uses the consortium's stored login, or with a token. D25 and the Step 2 brief rule both out. The proxy was not used, not even for a description. The service's description, fields and `copyrightText` were therefore not read. If the owner wants Champaign County built, the plainest route is to ask the consortium to send the parcel layer (parcel ID, owner name, acreage, outline) as a file, or to give written leave to use the proxy. The license sentence on every consortium item ("Unauthorized use ... is strictly prohibited and punishable by law") means the county's grant should be in writing before the data is used.

The 18 addresses requested:

| # | Address | Answer |
|---|---|---|
| 1 | `https://maps.ccgisc.org/arcgis/rest/services?f=json` | 404 |
| 2 | `https://maps.ccgisc.org/server/rest/services?f=json` | 404 |
| 3 | `https://maps.ccgisc.org/mobile/` | 200, a forwarding page to the portal app |
| 4 | `https://services.ccgisc.org/portal/sharing/rest/content/items/6d8117a581f0453f8719389e9b42d56d?f=json` | 200, app item |
| 5 | `https://services.ccgisc.org/portal/sharing/rest/content/items/6d8117a581f0453f8719389e9b42d56d/data?f=json` | 200, app configuration |
| 6 | `https://services.ccgisc.org/portal/sharing/rest/content/items/deb5ca20e9ca4dda9c4c978d42a77145?f=json` | 200, web map item |
| 7 | `https://services.ccgisc.org/portal/sharing/rest/content/items/deb5ca20e9ca4dda9c4c978d42a77145/data?f=json` | 200, web map layer list |
| 8 | `https://services.ccgisc.org/portal/sharing/rest/content/items/6f68b33636234c19aeb0601dbc50d9fa?f=json` | 200, pop-up service item, "Service Proxy" |
| 9 | `https://services.ccgisc.org/server/rest/services?f=json` | 200, folder list |
| 10 | `https://services.ccgisc.org/server/rest/services/General/Pop_Ups/MapServer/1?f=json` | 499 Token Required |
| 11 | `https://services.ccgisc.org/server/rest/services/Assessor?f=json` | 499 Token Required |
| 12 | `https://services.ccgisc.org/server/rest/services/ParcelFabric?f=json` | 499 Token Required |
| 13 | `https://services.ccgisc.org/server/rest/services/General?f=json` | 499 Token Required |
| 14 | `https://services.ccgisc.org/server/rest/services/AGO_CountyExec?f=json` | 499 Token Required |
| 15 | `https://services.ccgisc.org/portal/sharing/rest/search?q=parcel&num=100&f=json` | 200, 25 items |
| 16 | `https://www.arcgis.com/sharing/rest/search?q=champaign+county+parcels&num=50&f=json` | 200, 40 items |
| 17 | `https://www.arcgis.com/sharing/rest/search?q=owner:ChampaignCountyGIS&num=100&f=json` | 200, 23 items |
| 18 | `https://www.arcgis.com/sharing/rest/search?q=illinois+statewide+parcels&num=30&f=json` | 200, 21 items, none a statewide parcel dataset |

## Macon County: the Step 2 download (2026-11-17)

The owner said on 2026-11-17 that the county allows a stored copy (D25). The `parcels` layer downloads the whole service once and builds the archive from it.

- Service: `https://services1.arcgis.com/a3k0qIja5SolIRYR/arcgis/rest/services/Parcels2021/FeatureServer/1`. Fields requested: `PIN,ParcelNumb,Acreage,PrimaryNam`, with outlines in EPSG:4326, in pages of 1,000 by object id (`FID`) range.
- Parcel ID: `ParcelNumb`. The county's own viewer (web map item `9bdfc0d29b1d4fc1b392b1f23c913dd1`, read in Step 0) shows `ParcelNumb` in its pop-up, labelled "Parcel", and does not show `PIN`.
- The service stores outlines in NAD83 Illinois East State Plane, US feet (wkid 102671, latest 3435), with Z values. The service converts them to EPSG:4326 on request. Z values are not requested.
- The service's `copyrightText` and license fields are still empty.
- Every request is logged in `data/logs/parcels/requests-il-macon.log` (not in git). A summary is in `docs/evidence/step2/parcels/requests-summary.md`.
