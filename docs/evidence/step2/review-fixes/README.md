# Readout review fixes: browser evidence

Taken on 2026-11-17 in a desktop browser (Chromium through Playwright), 412 by 880 pixels, from the development server with the real Macon County archives in `data/build/`. Owner names are masked (`?maskOwners`), so every owner reads "OWNER NAME". Positions were played through the real position store with `window.__mapapp.position.replay`, one fix a second at one spot. The parcel metadata on disk carries the new `coverage` outline.

| File | Position | What it shows |
|---|---|---|
| `01-outside-county-394m.png` | (-89.14271, 39.65290), 394 m south of the county, accuracy 5 m | "No property lines for this place yet. Property lines are installed for Macon County only." Before the fix this point read "Not in a parcel. This is often a road or a railway." |
| `02-county-edge-parcel-opened.png` | (-89.13400, 39.65550), inside parcel 15-19-18-300-002 at the south county line, card opened | The line 98 ft (30 m) to the S, and across it: "No property lines are installed across that line. Property lines are installed for Macon County only." |
| `03-lake-decatur.png` | (-88.93900, 39.81900), Lake Decatur, inside the county, where the archive has no tile | "Not in a parcel. This is often a road, a railway or water." and "No property line within 492 ft (150 m)". Before the fix it read "No property lines for this place yet." |
| `04-nested-parcel-opened.png` | (-88.96018, 39.91608), in parcel 07-07-22-226-008, which lies inside 07-07-22-226-006, accuracy 4 m, card opened | "Across that line: OWNER NAME, parcel 07-07-22-226-006." Before the fix it read "Across that line: no parcel. Often a road or a railway." |
| `05-near-line-just-outside-county.png` | (-89.13400, 39.65510), 14 m south of the county edge line, accuracy 12 m | The caution state. The outside side reads "No property lines are installed on that side.", the other side names parcel 15-19-18-300-002. |
| `06-tap-outside-county.png` | A map tap at (-89.14271, 39.65290), position off | The tap panel says "No property lines for this place yet." and "Property lines are installed for Macon County only." |
| `07-no-fix-for-6-minutes.png` | Two fixes at the nested parcel point, then the page clock moved 6 minutes ahead (`Date.now` replaced in the page) | The card says only "No current position." and "The parcel and the distance to the line show again when the GPS reports." The message above it says "Last position 6 min ago." No owner, parcel or distance is shown. |
| `08-fix-2km-no-guess.png` | The nested parcel point with an accuracy of 2,000 m | "GPS is too weak to place you. Accurate to about 1.2 mi (2.0 km). No parcel can be named until the signal improves." No owner is named. |
| `09-accuracy-zero.png` | The nested parcel point with an accuracy of 0 | "Its accuracy is not known." and no parcel named. No accuracy circle is drawn. |
| `10-sources-parcel-entry.png` | Sources and licenses screen | The parcel entry's note now says where the lines come from, that they are tax records as of the data date, and that they are not a legal survey. The build notes and the publishing rule are gone from the screen. |

Not shown here: the "precise location needed" message. It appears only in the Android app and needs the emulator.
