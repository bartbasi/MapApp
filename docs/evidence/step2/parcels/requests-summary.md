# Parcel service requests

Made by `pipeline/checks/parcels_requests.py` from the request logs in `data/logs/parcels/` (not in git). Every request the pipeline and the parcel checks made is in those logs.

## il-champaign

| Host | Purpose | Requests | Dates (UTC) | `outFields` sent | Results |
|---|---|---|---|---|---|
| maps.ccgisc.org | discovery | 3 | 2026-11-17 | `(none)` (3) | 404 2, 200 1 |
| services.ccgisc.org | discovery | 12 | 2026-11-17 | `(none)` (12) | 200 12 |
| www.arcgis.com | discovery | 3 | 2026-11-17 | `(none)` (3) | 200 3 |

18 requests in all.

Discovery requests looked for a parcel service that can be read without a login. The Results column shows the HTTP status. ArcGIS reports 'Token Required' (error 499) inside an HTTP 200 answer, so each address and what came back is listed in `docs/research/county-parcel-terms.md`.

## il-macon

| Host | Purpose | Requests | Dates (UTC) | `outFields` sent | Results |
|---|---|---|---|---|---|
| services1.arcgis.com | build | 64 | 2026-11-17 | `(none)` (5); `PIN,ParcelNumb,Acreage,PrimaryNam` (59) | ok 64 |
| services1.arcgis.com | sample-check | 40 | 2026-11-17 | `PIN,ParcelNumb,Acreage,PrimaryNam` (40) | ok 40 |
| services1.arcgis.com | datum-check | 4 | 2026-11-17 | `PIN,ParcelNumb,Acreage,PrimaryNam` (4) | ok 4 |
| services1.arcgis.com | line-distance-check | 3 | 2026-11-17 | `PIN,ParcelNumb,Acreage,PrimaryNam` (3) | ok 3 |

111 requests in all.

