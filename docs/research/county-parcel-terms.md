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
