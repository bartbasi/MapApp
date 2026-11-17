# MapApp

MapApp (a working title) is a free, open source GPS mapping app for hunters, published by Play, Inc.

Its first job is to show where the phone is against the property lines, with no cell signal. It also shows public land, who owns a private parcel, and the hunter's own marks.

**This is work in progress. There is no release yet.**

## What it covers now

- Android, in 2D.
- Champaign County and Macon County, Illinois.
- A map view, an aerial view and a hybrid view, and a public land layer.
- The phone's GPS position, with a readout of the parcel it is in and the distance and direction to the nearest property line.
- Property lines and parcel owners for Macon County. Champaign County has none yet.

## What it will never have

No accounts, no ads, no analytics and no data collection. What you save stays on your phone.

## Land boundaries

Boundaries shown by MapApp come from public records. They are not a legal survey. Public land is not the same as land open to hunting.

## Where things are

- `docs/STATUS.md`: the state of the work.
- `docs/STEP_PLAN.md`: the steps of the first phase.
- `docs/DECISIONS.md`: each design and data decision, with its reason.
- `docs/DATA_SOURCES.md`: each data source, its license and its credit.
- `app/`: the app (TypeScript, Svelte, MapLibre, Capacitor).
- `pipeline/`: the scripts that build the map data.

Map data is not in this repository. County parcel data is never published here.

## License

GNU General Public License, version 3, with additional terms. See `LICENSE` and `NOTICE`.
