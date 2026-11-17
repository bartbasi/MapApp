# Position readout: replay route and checks

Screenshots in this folder were taken in a desktop browser (Chromium through Playwright) on the development build, with the replay position source and owner names masked (`?maskOwners`). Every owner name on screen reads "OWNER NAME". Parcels are named by their ID only.

Folded size is 344 x 882 CSS pixels. Unfolded size is 690 x 829.

## The route across a property line

Open farmland in Macon County, north of Warrensburg. The route walks straight west along latitude 39.9155.

| Point | Longitude | Latitude | Parcel | Expected readout |
|---|---|---|---|---|
| Start | -89.0605 | 39.9155 | 08-06-23-100-005 | inside, line about 99 m to the W |
| Property line | -89.061662 | 39.9155 | between the two | near-line |
| End | -89.0630 | 39.9155 | 08-06-23-100-007 | inside, line about 114 m to the E |

The line between the two parcels runs north to south at longitude -89.061662 (from 39.918163 to 39.913950, as the zoom 16 tile cuts it). The route is 213 m long.

The readout says near-line when the line is within the GPS accuracy plus 3 m (the allowance for error in the county's lines, `LINE_DATA_MARGIN_M`). With 4 m accuracy that is 7 m each side of the line: from longitude -89.06158 to -89.06174. The browser replay at 4 m accuracy changed state at -89.061586 (inside to near-line) and -89.06175 (near-line to inside), which matches.

To replay it on the emulator, one fix every second, about 5 m apart:

```
for lng in $(seq -89.06050 -0.00006 -89.06300); do adb emu geo fix $lng 39.9155; sleep 1; done
```

`adb emu geo fix` takes the longitude first. The emulator reports its own accuracy, so the near-line band is that accuracy plus 3 m each side of the line.

In the browser the same walk is `__mapapp.position.walk([[-89.0605, 39.9155], [-89.0630, 39.9155]], { accuracyM: 4 })` in the development build.

## Other places used

| State | Longitude | Latitude | Accuracy | What the readout said |
|---|---|---|---|---|
| no-parcel (a road between 08-06-23-100-005 and 08-06-14-300-004) | -89.0605 | 39.91866 | 3 m | Not in a parcel. This is often a road or a railway. Nearest property line 32 ft (10 m) to the N |
| poor-fix | -89.0609 | 39.9155 | 60 m | GPS is too weak to place you. Accurate to about 200 ft (60 m). Probably: (owner), parcel 08-06-23-100-005. |
| no-data (Urbana, Champaign County, which has no parcel archive) | -88.20 | 40.10 | 5 m | No property lines for this place yet. Property lines are installed for Macon County only. |

## Distance to the line: readout against an independent measurement

The readout's distance comes from the app's parcel source (`StoredParcelSource.positionQuery`). The independent measurement was made by a separate Node script: it read the same zoom 16 tiles with the pmtiles library, decoded them with `@mapbox/vector-tile` (not the app's decoder), cut each outline edge to its own tile square, converted the vertices to a local east-north-up frame through WGS84 earth-centred coordinates (not the app's flat frame), and took the smallest distance from the point to any edge.

| Point (longitude, latitude) | Parcel at the point | Readout distance | Independent distance | Difference |
|---|---|---|---|---|
| -89.0609, 39.9155 | 08-06-23-100-005 | 65.012 m | 65.012 m | under 1 mm |
| -89.0615, 39.9155 | 08-06-23-100-005 | 13.713 m | 13.713 m | under 1 mm |
| -89.0625, 39.9155 | 08-06-23-100-007 | 71.786 m | 71.786 m | under 1 mm |
| -89.0605, 39.91866 (road) | none | 9.769 m | 9.769 m | under 1 mm |

Both are measured from the county outline as stored in the archive. The check in the step plan ("within 2 m") is met with room to spare. This does not say how close the county's outline is to the true boundary; that is what the 3 m allowance is for.

## Query time

Following the phone at zoom 18 in the hybrid view, walking 45 s at 1.4 m/s through Decatur town blocks (dense parcels), on the development laptop: 46 parcel queries, mean 1.6 ms, longest 20.4 ms (the first, reading tiles from the archive). Frame times over the same 45 s: median 16.7 ms, 99th percentile 17.3 ms, longest 27.5 ms, none over 33 ms. This was not measured on a phone.

## Screenshots

- `folded-hybrid-east.png`, `folded-hybrid-near.png`, `folded-hybrid-west.png`: the walk, folded, zoom 18.
- `unfolded-hybrid-east.png`, `unfolded-hybrid-near.png`, `unfolded-hybrid-west.png`: the same walk, unfolded.
- `folded-hybrid-z16-inside-connector.png`, `folded-map-z16-inside-connector.png`: inside 08-06-23-100-005, zoom 16, with the connector and tick to the line 65 m west and the glow on the parcel's lines.
- `folded-hybrid-inside-expanded.png`: the readout opened: the parcel across the line, acreage, county, data date and the "not a legal survey" statement.
- `folded-hybrid-no-parcel-road.png`: on the road.
- `folded-hybrid-poor-fix.png`: 60 m accuracy.
- `folded-map-no-data-urbana.png`: in Urbana, where no property lines are installed.
- `folded-map-z16-stale-fix.png`: the fix has gone stale: gray marker, the stale message, the readout grayed with "From the last GPS position.", and no connector.
