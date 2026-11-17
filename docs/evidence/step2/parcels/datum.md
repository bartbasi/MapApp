# Macon County parcels: which coordinates the archive holds

Checked 2026-11-17 by the data engineer. Investigation only: the archive and the pipeline were not changed.

## Result

- **The service's default conversion is not an identity.** Asked for EPSG:4326 with no `datumTransformation`, the service converts its NAD83 coordinates with Esri's transformation 108190, `WGS_1984_(ITRF00)_To_NAD_1983`, in the intended direction (NAD83 to ITRF00). The archive holds those coordinates.
- **Against the GPS frame**, taken as ITRF2014 at epoch 2026.0 computed from NAD83(2011) with EPSG:8970, **the archive is 0.49 m too far east and 0.00 m off north-south.** The fix is to move it 0.49 m west.
- **The 1.9 m from the first test was a mistake in the test.** Passing `datumTransformation=108190` made the server apply 108190 the other way round, from ITRF00 to NAD83, to NAD83 coordinates. Compared with the default, which already applied it the right way, the shift came out doubled and with the sign reversed.

## Method

- **Parcel:** 18-08-31-180-016, 5 vertices. The figures below are the same at all 5 vertices to 1 mm.
- **Spatial reference of the layer**, from the cached metadata: wkid 102671, latestWkid 3435. That is NAD83 State Plane Illinois East, US feet. No NAD83 realization is named. There is no `sourceSpatialReference` and no `datumTransformations` list.
- **Requests: 2**, the same four fields, logged in `data/logs/parcels/requests-il-macon.log` as `datum-check`.
  1. The parcel in its native spatial reference (`f=json`, no `outSR`). The answer is in wkid 102671 / 3435.
  2. A repeat of the earlier test: `outSR=4326`, `datumTransformation=108190`, `f=geojson`.
- **The default answer** (`outSR=4326`, no transformation) is the one the build cached.
- **Local conversions with PROJ 9.7.1** in WSL:
  - (a) EPSG:3435 to EPSG:4269. This is the plain inverse projection, NAD83 with no datum change.
  - (b) The result of (a) read as NAD83(2011) (EPSG:6318), then to ITRF2014 (EPSG:9000) by the inverse of EPSG:8970 ("ITRF2014 to NAD83(2011) (1)", time-dependent), at coordinate epoch 2026.0.
  - (c) The result of (a) through Esri 108190, in both directions. PROJ has no Esri transformations, so 108190 was applied from its published parameters: coordinate frame, x 0.9956, y -1.9013, z -0.5215 m, rx 0.025915, ry 0.009426, rz 0.011599 arc seconds, scale 0.00062 ppm.
  - Check against the lead's figure: the Decatur point (-88.955, 39.84), NAD83(2011) to ITRF2014 at 2026.9, comes out 1.015 m west and 0.822 m north.

## Differences

Each line reads "second minus first", in meters.

| First | Second | East | North |
|---|---|---|---|
| (a) NAD83, no datum change | service default (the archive) | -0.51 | +0.83 |
| (a) NAD83, no datum change | (c) 108190 applied NAD83 to ITRF00 | -0.51 | +0.83 |
| service default | (c) 108190 applied NAD83 to ITRF00 | 0.00 | 0.00 |
| (a) NAD83, no datum change | service with `datumTransformation=108190` | +0.51 | -0.83 |
| service with `datumTransformation=108190` | (c) 108190 applied the other way | 0.00 | 0.00 |
| service default | service with `datumTransformation=108190` | +1.01 | -1.65 |
| (a) NAD83, no datum change | (b) ITRF2014, epoch 2026.0 | -1.00 | +0.82 |
| (a) NAD83, no datum change | ITRF2014, epoch 2010.0 | -0.73 | +0.83 |
| service default (the archive) | (b) ITRF2014, epoch 2026.0 | -0.49 | 0.00 |

Why it is 0.49 m: 108190 brings NAD83 into ITRF00 at its 1997 epoch. Since then the North American plate has carried the ground west against the ITRF by about 1.7 cm a year. NAD83 is fixed to the plate, and the ITRF is not.

## Is the county's data good enough for this to matter?

The archive's offset from the GPS frame is 0.5 m. The county's lines are assessment lines. The question is whether they sit on true NAD83 coordinates, or were fitted to imagery, closely enough that a 0.5 m correction means anything.

Test, using local files only: where a straight rural road runs between parcels, take the centre of the gap the parcels leave (the right of way) and compare it with the OpenStreetMap road centreline in the built basemap archive (zoom 15). Details:

- Cross-sections every 60 m along straight minor and major roads.
- Only points more than 8 km from central Decatur.
- Gaps 12 to 35 m wide.
- Parcel outlines taken from the cached download, which has the same coordinates as the archive.

| Roads | Samples | Gap centre minus OSM centreline, median | Quartiles | Gap width, median |
|---|---|---|---|---|
| North-south | 1,015 | +0.45 m east | -0.46 to +1.47 m | 20.1 m |
| East-west | 635 | -0.06 m north | -0.93 to +0.86 m | 18.3 m |

If the county's NAD83 is sound and OpenStreetMap sits in today's GPS frame, the expected offset is +0.49 m east and 0.00 m north (the last row of the table above). The measured medians are within 6 cm of that.

If the county had drawn on imagery shown in NAD83, or OpenStreetMap had been traced from such imagery, the offsets would look like -0.5 m east and +0.8 m north instead. They do not.

How sure this is: **fairly, not certain.**

- The agreement is close, and both directions point the same way.
- OpenStreetMap's own position is not known independently. It was traced from imagery and is usually good to 1 to 3 m.
- A road's centreline is not always in the middle of its right of way.
- Samples along one road are not independent.
- The spread (quartiles about ±1 m) shows that single places can be off by a meter or more either way.

No PLSS corner coordinates or survey control were available to test against. So: the data is consistent with genuine NAD83 State Plane at the decimeter level on average, and the 0.49 m east offset is real in the sense of the datums. Whether it is real on the ground cannot be proven from what is here.

## Recommended change (not applied)

1. **Request native coordinates.** Ask the service for native coordinates: `f=json`, no `outSR`, `returnZ=false`. Check the answer's `spatialReference.latestWkid` against a new per-county setting in `parcels-services.json`, for example:

   ```json
   "nativeWkid": 3435,
   "assumeFrame": "EPSG:6318",
   "toFrame": "EPSG:9000",
   "epoch": 2026.0
   ```

   Cache the native pages. This needs one fresh download: 58 requests, about 33 MB.
2. **Convert locally with a pinned operation.** Build polygons from the Esri JSON rings with OGR's ESRIJSON reader, which handles ring order and holes. Then transform with one pinned PROJ pipeline: the inverse projection of EPSG:3435, the NAD83 numbers read as NAD83(2011), the inverse of EPSG:8970 at epoch 2026.0, then output as EPSG:4326 numbers.
3. **Record the frame.** Write the frame, the epoch and the PROJ pipeline string into the metadata `provenance`, since the contract allows no new top-level field. Name the frame in the README contract: "positions are ITRF2014 at epoch 2026.0, which is the GPS frame to within a few centimeters for years".
   - Why pin it: this removes the dependence on whatever default conversion the service applies, which Esri could change.
4. **Zero-request alternative.** Undo 108190 locally on the cached default coordinates, then apply step 2. It matched to 1 mm on this parcel. It rests on the service's default staying 108190 everywhere, so check it on the twenty sample parcels first.
5. **`parcels_sample.py`.**
   - Fetch each parcel in native coordinates and pass it through the same conversion function used by the build. Put that function in `lib/parcelsvc.py` so both use one copy. The 0.5 m outline test then stays valid.
   - Add a frame guard: for each sampled parcel, the archive minus the plain NAD83 position (a) must be the expected shift, at Decatur -1.00 m east and +0.82 m north, within 5 cm. A missing or doubled correction then fails the check.
6. **Recheck after the rebuild.** After the rebuild, the road-gap test above should give medians near 0 m in both directions.
