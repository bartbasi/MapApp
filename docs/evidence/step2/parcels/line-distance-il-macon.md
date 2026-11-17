# Distance to the property line, measured from the county's own outlines: il-macon

Run 2026-11-17. Service: https://services1.arcgis.com/a3k0qIja5SolIRYR/arcgis/rest/services/Parcels2021/FeatureServer/1.
Parcels fetched by parcel ID: 08-06-23-100-005, 08-06-23-100-007, 08-06-14-300-004. Requests made: 3.

The app's distance is what its parcel source gave for the point, read from the archive.
The county distance is from the outline the county's service returned today, measured in a
projection centered on the point. The archive was not read for the county distance.
Pass when the two differ by 2 m or less.

| Point (longitude, latitude) | In parcel | App's distance | From the county's outline | Nearest line belongs to | Difference | Result |
|---|---|---|---|---|---|---|
| -89.0609, 39.9155 | 08-06-23-100-005 | 65.012 m | 65.064 m | 08-06-23-100-005 | 0.052 m | pass |
| -89.0615, 39.9155 | 08-06-23-100-005 | 13.713 m | 13.764 m | 08-06-23-100-005 | 0.051 m | pass |
| -89.0625, 39.9155 | 08-06-23-100-007 | 71.786 m | 71.734 m | 08-06-23-100-005 | 0.052 m | pass |
| -89.0605, 39.91866 | none of these | 9.769 m | 9.715 m | 08-06-14-300-004 | 0.054 m | pass |

All points pass.
