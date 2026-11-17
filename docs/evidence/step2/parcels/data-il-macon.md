# Parcel data notes: il-macon

From the cached download of 2026-11-17 (57096 records, data last edited 2026-10-28). Counts and parcel IDs only. Made by `pipeline/checks/parcels_data.py`.

| What | Records | Examples (parcel IDs) |
|---|---|---|
| no outline | 0 |  |
| invalid outline (self-crossing or similar) | 3 | 12-17-02-201-012, 02-15-09-400-016, 07-07-13-400-003 |
| multipart (more than one polygon) | 774 | 01-01-06-100-007, 01-01-06-100-008, 10-02-02-400-015, 10-02-09-100-007, 10-02-22-200-012, 07-07-15-328-009, 07-07-15-329-003, 07-07-15-329-004, 07-07-15-329-006, 07-07-15-329-014 |
| has a hole | 54 | 10-02-34-400-015, 05-03-25-402-012, 13-10-11-285-020, 13-10-15-200-005, 07-07-31-400-005, 04-12-03-330-015, 04-12-03-451-020, 04-12-03-426-013, 04-12-24-153-029, `' '` |
| parcel ID empty or only spaces | 379 | `' '` |
| empty owner | 379 | `' '`, `' '`, `' '`, `' '`, `' '`, `' '`, `' '`, `' '`, `' '`, `' '` |
| owner text names a road, highway or railroad body | 45 | 10-02-09-100-004, 13-10-11-257-012, 13-10-11-257-013, 13-10-11-258-006, 13-10-11-285-011, 13-10-09-100-002, 13-10-09-200-002, 13-10-10-200-004, 13-10-11-152-001, 13-10-11-182-001 |
| acreage 0 | 26379 | 08-06-14-126-013, 08-06-14-126-017, 08-06-14-126-018, 08-06-14-129-014, 08-06-14-129-019, 08-06-14-129-020, 08-06-14-103-002, 08-06-14-103-004, 08-06-14-101-003, 08-06-14-101-004 |
| smaller than 10 square meters | 4 | `' '`, `' '`, 18-08-28-452-012, 17-12-25-451-013 |
| 10 to 100 square meters | 80 | 10-02-11-102-008, 05-03-25-354-009, 18-09-08-300-022, 04-12-03-384-003, 04-12-02-480-001, 04-12-02-502-005, 04-12-02-502-009, 04-12-05-429-021, 04-12-03-283-002, 04-12-08-251-001 |
| centre outside the county outline | 0 |  |
| PIN equals the parcel ID without punctuation | 51 |  |
| PIN differs from the parcel ID | 57045 | 01-01-02-100-004, 01-01-03-200-002, 01-01-03-400-003, 01-01-04-200-002, 01-01-04-300-001, 01-01-04-300-002, 01-01-04-300-003, 01-01-04-300-004, 01-01-04-400-001, 01-01-05-100-006 |

## Overlapping parcels

Pairs of records whose outlines share more than 1.0 square meter: 10624.

- Same outline drawn more than once (shared area at least 99 percent of both): 10579 pairs, 592 records, in 84 stacks. Largest stacks: [101, 86, 28, 22, 21, 18, 14, 13, 13, 12] records. The largest stack holds parcel IDs 04-13-18-128-001, 04-13-18-128-002, 04-13-18-128-003, 04-13-18-128-004, 04-13-18-128-005 and others.
- One parcel lying inside a larger one (at least 99 percent of the smaller): 23 pairs, 29 records.
- Partial overlaps: 22 pairs, 43 records. Shared area per pair: 1 over 100 square meters, 0 over 1,000.
  - same outline: 10-02-17-300-009 and 10-02-17-300-011, 321165 square meters
  - same outline: 07-07-21-400-084 and 07-07-21-400-083, 67661 square meters
  - same outline: 07-07-21-400-085 and 07-07-21-400-083, 67661 square meters
  - same outline: 07-07-21-400-085 and 07-07-21-400-084, 67661 square meters
  - same outline: 07-07-21-400-086 and 07-07-21-400-083, 67661 square meters
  - inside: 07-07-22-226-008 and 07-07-22-226-006, 34569 square meters
  - inside: 07-07-22-226-010 and 07-07-22-226-006, 34136 square meters
  - inside: 06-11-23-176-001 and `' '`, 32962 square meters
  - inside: 07-07-22-226-007 and 07-07-22-226-006, 27333 square meters
  - inside: 07-07-22-226-009 and 07-07-22-226-006, 9137 square meters
  - partial: 14-13-04-300-002 and 14-13-04-300-009, 368 square meters
  - partial: `' '` and `' '`, 77 square meters
  - partial: 18-09-09-100-017 and 18-09-09-100-019, 65 square meters
  - partial: 07-07-16-226-020 and 07-07-16-226-025, 17 square meters
  - partial: 04-12-15-301-030 and 04-12-15-301-035, 8 square meters

- Drawn area against the county's acreage: median ratio 0.998; 2547 records differ by more than 10 percent, 242 by more than 50 percent.
- Sum of parcel areas: 1453.6 square km. County outline: 1517.1 square km (95.8 percent). The rest is mostly road and water that the county does not draw as parcels.
