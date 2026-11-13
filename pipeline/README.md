# Data pipeline

Scripts that turn public data into tile archives, one layer for one county per run. The decisions behind this are in `docs/DECISIONS.md` (D4, D6, D7, D14, D16) and the approved sources are in `docs/DATA_SOURCES.md`.

## Running it

The pipeline runs inside WSL Ubuntu, where GDAL, tippecanoe and the PMTiles tool are installed.

```
wsl -d Ubuntu -- bash pipeline/build.sh <layer> <county-id>
```

For example: `bash pipeline/build.sh publicland il-champaign`.

- Downloads go to `data/cache/`. A rerun reuses them.
- Outputs go to `data/build/<county-id>/`.
- Nothing under `data/` is committed.
- A run is safe to interrupt. Files are written under a temporary name and renamed when complete.

## Counties

`pipeline/counties.json` lists the counties. Adding a county is one new entry. Nothing else in the pipeline names a county.

```json
{ "id": "il-champaign", "name": "Champaign County", "state": "IL", "stateName": "Illinois", "fips": "17019" }
```

The county outline is fetched from the US Census Bureau by FIPS code and cached.

## The archive contract

This is the agreement between the pipeline and the app. The app relies on it, so a change here is a change to both.

Each layer of each county is two files:

```
data/build/<county-id>/<layer>.pmtiles
data/build/<county-id>/<layer>.meta.json
```

### Rules for every archive

1. **Whole tiles.** Every tile in an archive is complete: it holds everything the source has for that tile, including features that reach past the county line. Tiles are never clipped to the county outline. An archive holds every tile that touches the county. The app serves a tile from the first installed archive that has it, so a tile must not depend on which county it came from.
2. **Web Mercator tiles**, the standard z/x/y scheme.
3. **Vector archives** hold Mapbox Vector Tiles, gzip compressed. **Raster archives** hold WebP tiles, 512 pixels square.

### The metadata file

```json
{
  "schema": 1,
  "layer": "publicland",
  "county": "il-champaign",
  "countyName": "Champaign County, Illinois",
  "kind": "vector",
  "title": "Public land",
  "minzoom": 6,
  "maxzoom": 14,
  "bounds": [-88.47, 39.87, -87.92, 40.41],
  "bytes": 123456,
  "buildDate": "2026-11-12",
  "sources": [
    {
      "name": "USGS PAD-US 4.1",
      "license": "Public domain",
      "credit": "U.S. Geological Survey Gap Analysis Project, 2024, Protected Areas Database of the United States (PAD-US) 4.1",
      "url": "https://doi.org/10.5066/P96WBCHS",
      "dataDate": "2025-03-31"
    }
  ],
  "notes": "Anything a user should know about the limits of this layer."
}
```

- `sources` lists every dataset that went into the archive. The app's attribution screen and legends are built from it. Credit text comes from `docs/DATA_SOURCES.md`.
- `dataDate` is the date of the data itself, not the day it was downloaded.

### Layers

| Layer | Kind | Zooms | Source | What is inside |
|---|---|---|---|---|
| `basemap` | vector | 0 to 15 | OpenStreetMap, cut from the Protomaps planet build | The Protomaps basemap tile layout, version 4. Layers such as `earth`, `water`, `landuse`, `landcover`, `roads`, `boundaries`, `places`, `pois`. |
| `aerial` | raster | 8 to 16 | USDA NAIP 2025 | Natural color imagery. |
| `publicland` | vector | 6 to 14 | USGS PAD-US 4.1, corrected with the regional planning commission's open spaces | One vector layer named `publicland`. Fields below. |

### Fields of the `publicland` layer

| Field | Meaning |
|---|---|
| `name` | The site's name. |
| `manager` | The managing body's full name, for example "Champaign County Forest Preserve District". |
| `category` | Who manages it, as one of a short fixed list. The map colors by this. See below. |
| `access` | `open`, `restricted`, `closed` or `unknown`. This means access on foot, not hunting. |
| `acres` | Area in acres, rounded. |
| `source` | Which dataset the shape came from: `padus` or `ccrpc`. |
| `src_date` | The date of the source record, where known. |

`category` values: `state`, `county_district` (forest preserve and conservation districts), `local` (city, village, township and park district land), `university`, `federal`, `ngo` (land trusts and similar private conservation owners), `other`.

What is left out, and why:

- Easements on private land that are closed to access. They are private land, and drawing them as public land would send someone onto it.
- Planning boundaries that are not land ownership, such as the former air base boundary in Champaign County.
- Duplicate shapes where PAD-US has both a "fee" and an "easement" record for one site. The fee record is kept.

Whether hunting is allowed is not in the tiles. PAD-US has no hunting field. The app keeps its own short notes per managing body, each with a link to the rule (D16).
