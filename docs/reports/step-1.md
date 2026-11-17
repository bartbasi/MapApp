# Step 1 report: map core and base data

Date: 2026-11-14. Written for Bart.

## Result

Step 1 is built and tested on the emulator. One check is still open, and only you can close it: the frame rate on your Z Fold 5. One thing went wrong that you need to know about: I used a Microsoft service to fetch the aerial imagery without reading its terms first.

- **Works:** the app shows three base views (Map, Aerial, Hybrid) and the public land layer for Champaign County and Macon County. It runs with no network. It works folded and unfolded, and it keeps its place when you fold or unfold. Tapping a public land site shows its name, its manager, its size and a hunting note, with a link to the rule where one exists.
- **Went wrong:** the imagery is public domain USDA imagery, but I fetched it from Microsoft's Planetary Computer. Its terms say that using the service counts as accepting them. Your brief says to ask you before accepting a license. I read the terms only afterwards. The details are under "The imagery service's terms" below. Nothing has been published.
- **Does not work well:** the aerial imagery is a patchwork of two years and several flight dates. Blocks of it differ in color, and the joins show as straight lines. The worst is in Champaign County.
- **Not yet known:** the frame rate on your phone. The emulator on this laptop gave 15 to 24 frames per second, which says little about the phone.
- **Needed from you:** install the test build and run the frame test (five minutes, steps below), and answer the six questions at the end.

No money was spent. Nothing was pushed. No county parcel data was requested, downloaded or stored in this step.

The build I am giving you is newer than the build the tester ran all checks on. After the tester's run I fixed what the tester and the reviewer found, rebuilt, and tested the changes again. The section "What was found and fixed" says where each fix was checked.

## The test build

The file is `C:\bart\MapApp\build\step1-debug.apk`. It is 370 MB, because both counties' map data is inside it. In Step 2 the app becomes small and downloads its data instead.

To run the frame test on your phone:

1. Install the file on the Z Fold 5 and open MapApp.
2. Tap the Layers button (top right), then "Sources and licenses", then "Diagnostics", then "Run frame test". The map moves by itself for 15 seconds. Do not touch the screen.
3. Do this four times: in the Map view and in the Hybrid view, each folded and unfolded. Choose the view with the switch at the top left before you start.
4. Send me three numbers from each run: "Average", "Worst 1 percent" and "Tiles finished after stop".

If the phone averages well under 30 frames per second in the Map view, I will revisit the choice of map engine before building anything else, as the plan says.

## The four checks of Step 1

| Check | Result |
|---|---|
| Public land colors match the source data along at least three boundaries | Pass. Seven sites checked at 20,382 points. No point was wrong. |
| Every layer present names its source and license | Pass. All six data files do. |
| Smooth panning and zooming on the Z Fold 5, with the measured frame rate | Pass, measured 2026-11-17 after this report was sent. About 120 frames per second in the Map and Hybrid views, folded and unfolded, with no slow frames. See the addendum at the end. |
| Screenshots of all three base views, folded and unfolded | Pass. They are in `docs/evidence/step1/final/`, taken from the build you are getting. |

### Boundaries

I took the outline of seven sites straight from the source data and compared it with what the app draws. For each site the check laid a grid of 3,000 points over the screen and asked the map what it had drawn at each point. Points within 10 m of the outline were skipped, because a line on a screen has a width.

| Site | County | Source | Manager type | Points tested | Wrong |
|---|---|---|---|---|---|
| Gifford State Habitat Area | Champaign | PAD-US | State | 2,897 | 0 |
| Trelease Woods | Champaign | PAD-US | University | 2,873 | 0 |
| Meadowbrook Park | Champaign | PAD-US | City | 2,861 | 0 |
| Middle Fork River Forest Preserve | Champaign | Regional planning commission | County district | 2,966 | 0 |
| Rock Springs Conservation Area | Macon | PAD-US | County district | 2,904 | 0 |
| Fairview Park | Macon | PAD-US | City | 2,960 | 0 |
| Spitler Woods | Macon | PAD-US | State | 2,921 | 0 |

Each outline was drawn in the color set for its manager type. "PAD-US" is the federal database of protected land, the main source of this layer. This check ran in a desktop browser, with the same data files and the same drawing code as the phone build. The results, the screenshots and the two scripts that made them are in `docs/evidence/step1/boundaries/`. On the emulator, the tester also tapped ten sites by hand and compared name, manager, size, color and hunting note with the source. All ten matched.

### Sources and licenses

The "Sources and licenses" screen lists each data file with its source, license, credit and the date of the data. The tester compared the screen with the data files, folded and unfolded. Nothing was missing.

| Layer | Source | License |
|---|---|---|
| Base map | OpenStreetMap, in the Protomaps tile layout | ODbL 1.0 (data), BSD 3-Clause (layout) |
| Aerial imagery | USDA NAIP 2025 and 2023 | Public domain |
| Public land | USGS PAD-US 4.1. For Champaign County forest preserves, the regional planning commission's open spaces | Public domain. ODbL 1.0 |

### Frame rate on the emulator

The frame test moves the map along a set path for 15 seconds and counts frames. These numbers come from the emulator on this laptop, which was short of memory during every run.

| Screen | Map | Aerial | Hybrid |
|---|---|---|---|
| Folded, average | 19.2 | 23.5 | 16.9 |
| Unfolded, average | 23.2 | 17.9 | 14.7 |

The worst 1 percent of frames ran at 5 to 7 frames per second. No map tile failed to load in any run.

One more run, on the final build right after a fresh start of the emulator, gave a very different number: 55.8 frames per second on average in the Map view, unfolded, with the worst 1 percent at 20. So the emulator's numbers move by a factor of two with the state of the laptop.

These numbers are lower than in Step 0. The Step 0 test app gave 26.6 to 40.8 frames per second on the same emulator. The two tests are not the same: Step 1 has the full map style, the public land layer and a different path. The 55.8 above suggests the drop was mostly the laptop, but I cannot be sure from the emulator. That is why your phone's numbers matter.

### Other things the tester checked

- **No network.** The emulator was in airplane mode for the whole session. Every screen worked. The app's log shows no attempt to reach any server. That is the absence of a logged attempt, not proof.
- **Fold and unfold.** The map fills the new screen and stays on the same place, in both directions. With a panel open, only folding was tested. The selected site then ended up behind the bottom sheet.
- **Not tested:** two-finger zoom and rotate, because the test tools cannot make a two-finger gesture. Tapping the links to the hunting rules, because the emulator was offline. Please try both on your phone.

## The imagery service's terms

- The imagery is NAIP, flown for the USDA, and it is public domain.
- USDA's own county files are in a format (MrSID) that free tools cannot read. So I read the same imagery from the copy on Microsoft's Planetary Computer, a free service that needs no account.
- I did not read that service's terms before using it. I read them on 2026-11-14, after the imagery was built.
- The terms say: "By accessing or using the Previews, or attempting to do either, you are accepting these Supplemental Terms and ratifying your acceptance of the TOU." "TOU" is Microsoft's general Terms of Use.
- So the download accepted Microsoft's terms without you being asked. That broke your rule. I am sorry for it.
- What the service's terms contain: the service is offered as is and may change or end. Access tokens may not be shared or sold. Nothing in them claims rights in the imagery or limits what may be done with it.
- Microsoft's general Terms of Use contain this sentence: "Unless otherwise specified, the Services are for your personal and non-commercial use." I read that page only through a summary tool, so please read it yourself: https://www.microsoft.com/en-us/legal/terms-of-use. The service's own terms are at https://planetarycomputer.microsoft.com/terms.
- The app never contacts Microsoft. Only the build on this laptop did.
- The imagery files are on this laptop and inside the test build. They are not published anywhere, and I will not publish or host them until you decide. This is question 2.

## What was built

**The data files.** A set of scripts in `pipeline/` turns public data into one file per layer per county. Adding a county means adding one line to `pipeline/counties.json` and running the scripts.

| Layer | Champaign County | Macon County | Zoom levels |
|---|---|---|---|
| Base map | 11.5 MB | 4.1 MB | 0 to 15 |
| Aerial imagery | 215 MB | 134 MB | 7 to 16 |
| Public land | 0.13 MB | 0.10 MB | 10 to 14 |

**The app.** The map screen with the Map, Aerial and Hybrid switch. The Layers panel with the public land switch and a legend. The public land panel. The sources screen. The diagnostics screen with the frame test. On the folded screen a panel is a sheet at the bottom. On the unfolded screen it sits beside the map. The map style, the colors and the icons inside the app were drawn for this app. Two things were not: the font is Noto Sans, a free font under the SIL Open Font License, and the app's launcher icon and start screen are still the stock ones of the app framework. The app needs its own icon before release.

**Public land colors** are by who manages the land: state purple, county forest preserve or conservation district orange, city or park district pink, university brown, land trust teal. Land that the source lists as closed is hatched.

**Hunting notes.** The source data does not say where hunting is allowed. I wrote eight short notes by hand, and the app shows the one that fits the tapped site. Five of them cite a public rule or page. Please read them, because they are advice to hunters under your name. They are in `app/src/content/hunting-notes.json`.

- Champaign County Forest Preserve District: no hunting (its ordinance).
- Macon County Conservation District: by district permit only, archery deer lottery at four sites.
- Gifford and Perdueville state sites (two notes): pheasant and rabbit by state lottery permit.
- Other state sites: unknown, check the state's list.
- Land trusts: private land, ask the owner. No link.
- Any site the source lists as closed: do not enter or hunt. No link.
- Everything else: "Open to the public does not mean open to hunting. Ask the managing body before you hunt here." No link.

## What changed from the plan

1. **Where the aerial imagery comes from.** See the section above and DECISIONS D7.
2. **Half detail.** The imagery was read at 1.2 m per pixel, not the full 0.6 m. Full detail means reading about 50 GB. The download for this step was about 8.7 GB, measured by the build's own network counter. Trees, field edges, lanes and buildings are clear. Full detail can come later.
3. **Two years of imagery.** The Microsoft copy does not have the 2025 imagery for all of either county. About a quarter of Champaign County (597 square km, the south) and about half of Macon County (773 square km, the east, with Decatur) are filled from 2023.
4. **What counts as public land.** Private land is left out even where the source lists it, such as country clubs. Land of a land trust is kept if the public may enter. Easements on private land that are closed to the public are left out, so the map never sends someone onto private ground. See DECISIONS D24.

## Known faults

1. **The aerial imagery is a patchwork.** In Champaign County, north of latitude 40.0 most fields are yellow (September 2025). South of it they are green (August 2023). The line is straight and obvious. See `docs/evidence/step1/device/aerial-year-join-unfolded.png`. In Macon County a block in the west is tan (2025) and the rest is green (2023). Zoomed out, both counties show the blocks plainly: see `docs/evidence/step1/final/opening-aerial-folded.png`. Up close, away from a join, the imagery is fine.
2. **Sites the source lists as closed show "do not enter or hunt", and some of them are probably open.** The source marks state nature preserves as closed even where people may walk in. Seven such records lie in or at the two counties: Spitler Woods Nature Preserve and its buffer, Bois du Sangamon Nature Preserve and Upper Sangamon Natural Area (both Macon County Conservation District), Tomlinson Cemetery, Barnhart Prairie, and Upper Embarras Woods Nature Preserve. The same note shows on six closed records just over the line in Piatt County. The closed note replaces the manager's own note, so the two conservation district sites do not show the district's permit note. This is wrong in the safe direction. A better rule needs a public source that I have not found.
3. **A few source records are poor.** Four records are named "Unnamed Property". The largest is 979 acres of the Decatur Park District. One record named "City Park" covers several parks. Seven Champaign County parks have no manager listed.
4. **A site's panel opens half a second after the tap.** The app waits to see whether the tap is the first of a double tap, which zooms. The wait matches the map engine's own double tap time.
5. **A selected site can end up under the Map, Aerial and Hybrid switch** on the folded screen.
6. **Parking lot aisles are drawn like small roads** in the Map and Hybrid views, which is busy in towns.
7. **Creeks appear only from zoom 13** in the Map view. This comes from the base map data and can be improved in a later step.
8. **Two of the public land colors are hard to tell apart for people with one rare kind of color blindness** (tritanopia). The dashes and hatches still differ.
9. **No night mode yet.**
10. **The map once drew half the screen first** on the emulator at start, then completed within seconds. It did not happen again in later starts. Please watch for it on the phone.
11. **Two low-severity warnings** from the build tools' own dependencies (`npm audit`, run on 2026-11-12). They affect the build tools, not the app.

## What was found and fixed

The tester's full report is `docs/evidence/step1/device/qa-report.md`. The reviewer then read the work with fresh eyes. These were fixed:

| What was wrong | Where the fix was checked |
|---|---|
| The credit line covered the scale bar on a narrow screen. | Emulator, folded and unfolded, all three views. |
| In the Aerial and Hybrid views, the opening view of both counties showed no imagery. The imagery now starts at a wider zoom. | Emulator, folded and unfolded. |
| A double tap to zoom also opened a site's panel. | Emulator, unfolded. My first fix worked in a desktop browser and failed on the touch screen. The final pass caught it. The second fix was checked on the emulator in the build you are getting. |
| A thin strip of land was hard to tap. A tap within about a fingertip of a site now counts. | Emulator: a tap 30 screen pixels from a trail opened it, a tap 120 pixels away did not. |
| On the unfolded screen the side panel could hide the tapped site. | Emulator. |
| On the folded screen the bottom sheet could hide the tapped site. | Emulator. |
| A closed site showed a calm "ask first" note. It now says not to enter or hunt. | Emulator, at Spitler Woods Nature Preserve. |
| A Macon County site's panel credited the Champaign County planning commission. | Emulator, on two Macon County sites and one Champaign County forest preserve. |
| From the reviewer: the tapped site is now found at the moment of the tap, and the double tap time matches the map engine's. | Automated tests and the emulator checks above. |

The final emulator pass is `docs/evidence/step1/final/qa-final.md`. The build you are getting differs from the build of that pass by one change, the second double tap fix. After it I rechecked the double tap and the single tap on the emulator (`docs/evidence/step1/final2/`), and nothing else.

## Questions for you

1. **Frame rate.** Please run the frame test above and send the numbers.
2. **The imagery service's terms.** Three options. (a) You read the two pages of terms and accept them. The imagery stays as built. (b) You do not accept them. I delete the imagery and build it another way. The other ways are: USDA's county files, which need the MrSID decoder and its license, also yours to accept; or the Amazon copy, which costs a small download fee. (c) You want legal advice first. Then the app waits with a base map only. I recommend (a) if the terms read acceptably to you, because the imagery itself is public domain.
3. **The imagery patchwork.** Three options. (a) Leave it: newest imagery where it exists. This is what the build does. (b) Use 2023 for the whole of both counties: one even picture, two years older where 2025 exists. (c) Accept the MrSID decoder's license so I can read USDA's complete 2025 county files: all 2025 at full detail, though flight dates within 2025 may still differ in color. I recommend (a) for now.
4. **Hunting notes.** Are the eight notes right, as far as you know the ground?
5. **Still open from Step 0.** What did each county grant for its parcel data: a live lookup only, or a copy that may be stored in the app? Step 3 (parcels) depends on it.
6. **Still open from Step 0.** May I make the first push to the public GitHub repository, and do the brief, `CLAUDE.md` and these reports go public with it? Step 2 needs the push, because the app will download its data from GitHub. Your last message ended at "4" before the answer.

Also still open, with no hurry: whether to ask the state geological survey for its 2025 leaf-off imagery, and the Department of Natural Resources for its hunting site table. I can draft both emails.

## Housekeeping

- Two empty folders appeared in the project root during a tool run: `BASI\PADX` and one named `C:SERSBART`. A safety check stopped me from deleting them. They are safe to delete by hand.
- The work is in 13 local commits. Nothing is on GitHub.

## Addendum, 2026-11-17: the phone test and the owner's answers

This part was added after the report above was sent. The report above is unchanged apart from the frame rate row in the checks table.

**Frame rate on the Galaxy Z Fold 5.** The test build was installed over USB and the built-in frame test was run on the phone.

| Screen | View | Average | Worst 1 percent | Frames over 33 ms | Tiles finished after stop |
|---|---|---|---|---|---|
| Folded | Map | 119.9 frames per second | 119 | 0 of 1806 | 350 ms |
| Folded | Hybrid | 119.7 frames per second | 119 | 0 of 1802 | 594 ms |
| Unfolded | Map | 119.7 frames per second | 119 | 0 of 1802 | 363 ms |
| Unfolded | Hybrid | 119.7 frames per second | 117.6 | 0 of 1801 | 309 ms |

Both screens refresh 120 times a second, so the app draws every frame the phone can show. The screenshots are in `docs/evidence/step1/phone/`.

**The owner's answers.** They are recorded in `docs/DECISIONS.md`, D25 and D26. In short: the first push is approved with the brief, `CLAUDE.md` and the reports included. He accepts Microsoft's terms for the imagery. Both counties allow a stored copy of their parcel data. The imagery patchwork stays. The hunting notes are right. The app's first job is to show the phone's position against the property lines.
