# Random parcel check: il-macon

Run 2026-11-17 by `pipeline/checks/parcels_sample.py`.

- Archive: `data/build/il-macon/parcels.pmtiles`, built 2026-11-17, data date 2026-10-28.
- 20 parcels drawn at random from the 56718 distinct parcel IDs at zoom 16, with seed 20261117 (Python `random.Random(seed).sample` over the sorted IDs).
- Each parcel fetched from the county service by parcel ID with fields `PIN,ParcelNumb,Acreage,PrimaryNam` plus its outline, 20 requests in all.
- Owner: exact text equality. The names are not printed.
- Acres: equality of the numbers. The archive leaves `acres` out where the county records 0; "match (none recorded)" means both sides have no acreage.
- Outline: largest distance between the archive outline at zoom 16 (pieces from every zoom 16 tile joined) and the service outline, sampled every 0.1 m. Pass under 0.5 m.

| # | Parcel ID | Zoom 16 tiles | Service records | Owner | Acres | Outline, largest distance (m) | Outline |
|---|---|---|---|---|---|---|---|
| 1 | 18-08-31-180-016 | 1 | 1 | match | match (none recorded) | 0.061 | pass |
| 2 | 04-12-11-104-013 | 2 | 1 | match | match (none recorded) | 0.045 | pass |
| 3 | 04-12-02-251-006 | 4 | 1 | match | match | 0.066 | pass |
| 4 | 04-12-14-351-015 | 1 | 1 | match | match | 0.060 | pass |
| 5 | 04-12-13-301-006 | 1 | 1 | match | match (none recorded) | 0.052 | pass |
| 6 | 04-12-13-404-012 | 1 | 1 | match | match | 0.056 | pass |
| 7 | 04-12-23-426-005 | 1 | 1 | match | match | 0.056 | pass |
| 8 | 04-12-17-107-007 | 1 | 1 | match | match (none recorded) | 0.066 | pass |
| 9 | 04-12-13-413-006 | 1 | 1 | match | match (none recorded) | 0.067 | pass |
| 10 | 04-12-24-103-001 | 1 | 1 | match | match (none recorded) | 0.040 | pass |
| 11 | 07-07-15-178-002 | 1 | 1 | match | match | 0.059 | pass |
| 12 | 04-12-04-407-012 | 1 | 1 | match | match (none recorded) | 0.054 | pass |
| 13 | 02-15-01-400-007 | 2 | 1 | match | match | 0.067 | pass |
| 14 | 13-10-11-201-001 | 2 | 1 | match | match (none recorded) | 0.065 | pass |
| 15 | 04-12-25-229-005 | 1 | 1 | match | match | 0.068 | pass |
| 16 | 04-12-16-405-016 | 1 | 1 | match | match | 0.052 | pass |
| 17 | 04-12-16-302-001 | 1 | 1 | match | match | 0.054 | pass |
| 18 | 07-07-22-251-001 | 1 | 1 | match | match (none recorded) | 0.059 | pass |
| 19 | 12-17-04-126-004 | 1 | 1 | match | match | 0.058 | pass |
| 20 | 04-12-10-226-003 | 1 | 1 | match | match (none recorded) | 0.057 | pass |

Result: owner 20 of 20 match, acres 20 of 20 match, outline 20 of 20 pass. Largest outline distance 0.068 m.
