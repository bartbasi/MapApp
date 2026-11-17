# Parcel archive field check: il-macon

Archive: `data/build/il-macon/parcels.pmtiles`, 14977513 bytes.

## Header

- Tile type mvt, compression gzip, zoom 13 to 16.
- Bounds [-89.2179, 39.6526, -88.745, 40.0554].
- County outline box [-89.21787, 39.65268, -88.74506, 40.05534]: covered by the archive bounds.

## Tiles per zoom

| Zoom | Tiles | Bytes (gzip) | Largest tile, gzip | Largest tile, unpacked | Feature pieces |
|---|---|---|---|---|---|
| 13 | 137 | 2432692 | 251324 (13/2071/3105) | 634960 (13/2071/3105) | 65258 |
| 14 | 494 | 2933582 | 108907 (14/4144/6212) | 265583 (14/4144/6212) | 68440 |
| 15 | 1837 | 3854288 | 38040 (15/8289/12424) | 87416 (15/8288/12424) | 75969 |
| 16 | 7095 | 5747952 | 13256 (16/16573/24853) | 30188 (16/16577/24849) | 93699 |

## Properties at zoom 16

- Property keys found: `acres`, `county`, `owner`, `pid`.
  - `acres`: on 59830 feature pieces, value types {'float': 46918, 'int': 12912}.
  - `county`: on 93699 feature pieces, value types {'str': 93699}.
  - `owner`: on 93699 feature pieces, value types {'str': 93699}.
  - `pid`: on 93699 feature pieces, value types {'str': 93699}.
- `county` values: {'il-macon': 93699}.
- Feature pieces (a parcel cut by tile edges counts once per tile): 93699.
- Distinct feature ids (one per service record): 57096.
- Distinct parcel IDs (`pid`), not counting blank ones: 56717. Records whose `pid` is empty or only spaces: 379.
- Records with no `acres`: 26379.

## Against the service

- Service count on 2026-11-17 (data last edited 2026-10-28): 57096 records.
- Archive at zoom 16: 57096 distinct records, 56717 distinct non-blank parcel IDs, 379 records with a blank parcel ID.

## Zooms 13 to 15: nothing dropped

For each tile, every record (feature id) found in the zoom 16 tiles under it must be in it. Records, not parcel IDs, are compared, because some parcel IDs are on more than one record.

| Zoom | Distinct records | Distinct non-blank parcel IDs | Tiles checked | Tiles missing a record | Records missing |
|---|---|---|---|---|---|
| 13 | 57096 | 56717 | 137 | 0 | 0 |
| 14 | 57096 | 56717 | 494 | 0 | 0 |
| 15 | 57096 | 56717 | 1837 | 0 | 0 |

## Result

PASS: only the four contract keys, every service record with an outline is at zoom 16, and no parcel is missing at zooms 13 to 15.
