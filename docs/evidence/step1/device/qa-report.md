# Step 1 device QA report

Build tested: `build/step1-debug.apk` (package `io.github.bartbasi.mapapp`) on the emulator `mapapp_fold`, in airplane mode, 13 November 2026. All evidence files are in this folder. These are emulator numbers on a memory-starved laptop, not phone numbers.

## Result

The build works. The three base views draw, folded and unfolded. Folding and unfolding with the app open keeps the map's place and fills the new screen. All 10 public land sites tapped matched the source data (name, manager, category, acres) and the right hunting note applied. The outline colors on the map match `palette.ts`, and the legend matches the map. Every installed layer names its source and license, and the text matches the `.meta.json` files. No network request by the app showed up in the log.

Two things fail or need a fix:

1. **Fail: the credit line covers the scale bar** when the credit text wraps to two lines. This happens on the folded screen in Aerial and Hybrid, and on the unfolded screen whenever a side panel narrows the map in Aerial or Hybrid. The scale bar text ("300 ft") is unreadable then. Evidence: `aerial-folded-credit-overlaps-scalebar-crop.png`, `aerial-folded.png`, `hybrid-folded.png`, `layers-unfolded.png`.
2. **Fail (minor, wording): the details panel for a Decatur site lists the Champaign County Regional Planning Commission credit.** The Macon public land archive has only PAD-US as a source. The panel appears to list the credits of both counties' archives for any site. The Layers panel does the same ("Installed map data": Public land, Champaign County, Macon County, lists the Champaign commission). Evidence: `site-7-decatur-park-unfolded.png`, `site-8-spitler-unfolded.png`, `layers-folded-end.png`.

Could not test or only partly tested:

- Two-finger zoom out and rotate by hand (no way to produce a two-finger gesture with adb). I used relaunch and the frame test tour instead. Zoom out by gesture is not tested.
- Tapping the source links in the hunting notes and the Sources screen (they leave the app for a browser, and the phone is offline). Not tested.
- The 300 m figure at the imagery edge. The county line is not drawn in Aerial view, so there was nothing to measure from. I only saw that the imagery ends in a clean straight edge.
- "Error injecting safe area CSS": zero lines in the log I could read. I cleared the log (`logcat -c`) at 03:25 before the first frame test, so the earlier part of the session was not checked. Across the three app starts after that, there were 0 such lines.
- Real-phone frame rate (Galaxy Z Fold 5). Not possible here.

## 1. Three base views, folded and unfolded: pass

Files: `overview-map-unfolded.png` (two-county overview), `map-unfolded.png` (zoom about 12, Champaign and Urbana), `map-unfolded-street.png`, `aerial-unfolded.png`, `hybrid-unfolded.png`, `map-folded.png`, `aerial-folded.png`, `hybrid-folded.png`.

- Map: labels readable (place names, road names, highway shields), woods green and water blue, public land outlines visible. At the street zoom, parking aisles are drawn as full roads, which is busy but readable.
- Aerial: imagery is sharp enough to see cars, field edges and tree rows at 300 ft scale. At that zoom it is stretched past the top zoom of the archive (16), so it is slightly soft. That is expected.
- Hybrid: road names readable with a halo ("Napleton Way", "North Cunningham Avenue"). Road lines have white casings and are clear over the imagery, though parking aisles clutter the picture.
- Nothing cut off. Switch, Layers button and compass button do not overlap anything. The scale bar and credit line overlap on the folded Aerial and Hybrid screens (see Result item 1). In Map view and in unfolded Aerial and Hybrid with no panel, they do not.
- When I first took the overview screenshot 12 seconds after launch, the map had drawn only the left half of the screen. Eight seconds later it was complete. This is probably memory-starved slowness, but a user would see a half-empty map for several seconds after launch.

## 2. Fold and unfold with the app open: pass

- Unfolded with a details panel open, then fold: `site-9-spitler-preserve-closed-unfolded.png` then `fold-after-panel-open-folded.png`. The app stayed up, the panel became a bottom sheet, the map filled the screen and kept its place.
- Folded, then unfold: `map-folded.png` then `map-unfolded-street.png`. The map fills the larger screen, same center, still working (I switched views and tapped afterwards).
- Note: after folding, the selected site (bottom edge of the old map) ended up behind the bottom sheet.
- How to drive it: after `adb emu fold` and `wm dismiss-keyguard`, the folded screen is display 4619827551948147201, 1080x2092. Plain `adb shell input tap x y` works when folded; `-d` was not needed.

## 3. Public land: pass (10 sites)

Each site was compared with `data/reports/<county>/publicland.input.geojson`, `palette.ts` and `hunting-notes.json`. Outline colors were also counted in the pixels of the screenshot taken before the tap (Meadowbrook-type local, orange, purple) and match the palette values within tolerance.

| # | Site (county) | Manager | Category and map outline | Note shown | Source link | Data match |
|---|---|---|---|---|---|---|
| 1 | Meadowbrook Park (Champaign), 130 acres | City of Urbana | local, pink (#c2185b) | default "Unknown: ask first" | none (correct, none in notes file) | yes |
| 2 | University of Illinois Public Golf Course (Champaign), 259 acres | University of Illinois | university, brown | default | none | yes |
| 3 | Gifford State Habitat Area (Champaign), 103 acres | Illinois Department of Natural Resources | state, purple | "Limited: permit needed", pheasant and rabbit only, lottery | IDNR Gifford site page | yes, matches Gifford note |
| 4 | Middle Fork River Forest Preserve (Champaign), 1,704 acres | Champaign County Forest Preserve District | county district, orange (#cc5a0a) | "No hunting" | CCFPD General Use Ordinance, section V | yes |
| 5 | Shortline Railroad Prairie (Champaign), 5 acres | Grand Prairie Friends | land trust, teal dashed | "Unknown", private conservation land | none (correct, ngo note has none) | yes |
| 6 | Rock Springs Conservation Area (Macon), 1,283 acres | Macon County Conservation District | county district, orange | "Limited: permit needed", archery lottery | Macon CCD Deer Herd Management Program | yes |
| 7 | Lincoln Park (Decatur, Macon), 88 acres | City of Decatur | local, pink | default | none | yes |
| 8 | Spitler Woods (Macon), 40 acres | State of Illinois | state, purple | generic state note, "Unknown" | IDNR east central region list | yes |
| 9 | Spitler Woods Nature Preserve (Macon), 146 acres, closed | Illinois Nature Preserves Commission | state, purple with hatch | generic state note | IDNR east central region list | yes. Access line reads "Closed to the public on foot." |
| 10 | Sand Creek Open Space Reservation (Macon), folded | Macon County Conservation District | county district, orange | "Limited: permit needed" | Macon CCD program | yes |

No mismatch found. Folded bottom sheet checked on two sites (8 and 10): `site-8-spitler-folded.png`, `site-10-sandcreek-folded.png`. The sheet is readable and scrolls. In the Spitler case the map re-centered so the site stayed visible above the sheet. In the Sand Creek case the selected site stayed partly under the Map/Aerial/Hybrid switch.

Files: `site-1-meadowbrook-unfolded.png`, `site-2-univ-unfolded.png`, `site-3-gifford-unfolded.png`, `site-4-middlefork-unfolded.png`, `site-5-ngo-unfolded.png`, `site-6-rocksprings-unfolded.png`, `site-7-decatur-park-unfolded.png`, `site-8-spitler-unfolded.png`, `site-9-spitler-preserve-closed-unfolded.png`, `site-8-spitler-folded.png`, `site-10-sandcreek-folded.png`.

Observations on the notes: the closed nature preserve gets the same "Unknown: ask first" note as an open state site, although the panel says "Closed to the public on foot". A hunter reads a calm "ask first" for land that is closed. Not a data mismatch, but worth a decision. Federal and "other" categories are not in the data for these two counties, so they were not seen.

## 4. Legend and Layers panel: pass

Files: `layers-folded.png`, `layers-folded-scrolled.png`, `layers-folded-bottom.png`, `layers-folded-end.png`, `layers-unfolded.png`, `layers-unfolded-bottom.png`.

The legend shows who manages the land (State purple, County forest preserve or conservation district orange, City/village/township/park district pink, University brown, Land trust teal with dashes) and access on foot (open, restricted, closed with hatch). Each swatch color matches the outline seen on the map for the same category. Federal and "other" are not listed, which fits the data. The panel also shows a "Public land" switch, a note that public is not the same as open to hunting, and an "Installed map data" list with a link to Sources.

## 5. Sources: pass

Files: `sources-folded-1.png` to `sources-folded-11.png`, `sources-unfolded-1.png` to `sources-unfolded-7.png`.

Scrolled through the whole screen folded and unfolded. All six archives (Champaign and Macon, each with Aerial imagery, Base map, Public land) show a source name, license, credit and data date, and the text matches the `sources` in the `.meta.json` files: NAIP 2025 and 2023 (Public domain), OpenStreetMap (ODbL 1.0), Protomaps layout (BSD 3-Clause with ODbL tile data), USGS PAD-US 4.1 (Public domain), and for Champaign only the Regional Planning Commission Greenways (ODbL 1.0, June 11, 2024). Build sizes and dates are shown. Nothing missing. The screen also credits the Noto Sans font (SIL Open Font License 1.1) and says icons and style were drawn for MapApp. The only wrinkle is the Champaign commission credit that also appears in Macon site panels (Result item 2).

## 6. Frame test: pass (ran, numbers below; not a phone result)

Files: `frame-test.log` (the six `FRAME_TEST` lines, in the order below), `diag-folded-1.png`, `diag-folded-result-map.png`, `diag-folded-result-hybrid.png`, `diag-unfolded-1.png`, `diag-unfolded-result-map.png`, `diag-unfolded-result-hybrid.png`, `diag-unfolded-result-aerial.png`. The test tour is 15 seconds. The test uses whichever base view is active, and it allows choosing Map, Aerial or Hybrid by switching first.

| Screen | View | Frames | Average fps | Worst 1 percent fps | Frames over 33 ms | Settle after stop | Tile failures |
|---|---|---|---|---|---|---|---|
| Folded (412x732) | Map | 295 | 19.2 | 5.9 | 222 | 931 ms | 0 |
| Folded | Hybrid | 260 | 16.9 | 5.3 | 196 | 754 ms | 0 |
| Folded | Aerial | 358 | 23.5 | 6.7 | 229 | 327 ms | 0 |
| Unfolded (842x641) | Hybrid | 225 | 14.7 | 5.5 | 178 | 791 ms | 0 |
| Unfolded | Map | 353 | 23.2 | 6.7 | 192 | 595 ms | 0 |
| Unfolded | Aerial | 273 | 17.9 | 6.7 | 176 | 638 ms | 0 |

Averages ran from 14.7 to 23.5 fps on the emulator, with a worst 1 percent of 5 to 7 fps. This is software rendering on a laptop with little free memory, so it says nothing about the Z Fold 5. It does not show a clear problem or clear success. The phone measurement is still needed.

## 7. No network: pass

- `settings get global airplane_mode_on` returned 1. The status bar shows the airplane icon in all screenshots. `ping 8.8.8.8` from the device: "Network is unreachable".
- The whole app worked this way: all three views, public land taps, Layers, Sources, Diagnostics.
- In `logcat -d` for the app's processes (pids 3883, 4649, 4823): no `net::ERR`, no `ERR_INTERNET_DISCONNECTED`, no failed fetch lines. The Diagnostics screen reports tile reads with 0 failures. The only `https://` lines in the whole log were (a) the keyboard app (pid 1295, not MapApp) trying to download a dictionary: `ManifestedDataDownloader ... downloading manifest https://www.gstatic.com/android/keyboard/dictionarypack/...`, and (b) the app printing its own archive metadata to the console (the `https://` text inside is the source URL field, not a request).
- Caveat: with the network down, a request would fail quietly unless the app logs it, so this shows no logged attempt rather than proof of no attempt.

## 8. Errors: pass with notes

File: `logcat-warnings.txt` (45 warning and error lines for the app's three processes).

- "Error injecting safe area CSS": 0 lines in the part of the log I could read (from 03:25 on, after I cleared it). Nothing looks wrong at the screen edges or under the status bar in any screenshot: the map starts below the status bar, and the switch and buttons keep clear of the top edge and the navigation bar.
- Lines from the app itself: `W Capacitor: Unable to read file at path public/plugins` (once per start, harmless in this build), and `I Capacitor/Console: Line 350 - Msg: [object Object]` once per start (a console message that prints an object without its content, so it tells a developer nothing).
- The rest is system and Chromium start-up noise: unexpected CPU variant, HWUI config, MESA rendernode, Bluetooth permission in the web view, variations seed, DnsConfig, long monitor contention.

## 9. Edges: pass

- `aerial-north-edge-unfolded.png`: at Champaign County's north edge, the imagery ends in a straight, clean line and the area beyond is a plain gray with faint roads and a state site outline ("Perdueville State Habitat Area", in the next county). Nothing broken or glitchy. I could not measure the 300 m, as noted above.
- `aerial-year-join-unfolded.png`: near latitude 40.0, south of Champaign and Savoy, a dead straight east to west line separates tan, harvested-looking fields in the north from dark green fields in the south (the two flight years). The join is abrupt but matches the known data fact. The west edge of the imagery is also visible on this screen as plain gray.

## 10. Other observations for use in a field

- The credit line wraps to two lines and covers the scale bar when the map is narrow (Result item 1). It also eats some map space.
- A thin site is hard to tap at low zoom. At about 2 mile scale, three taps on the Shortline Railroad Prairie strip (a band about 17 screen pixels tall, 4 pixels of line) did nothing. At 3000 ft scale it opened on the first tap. A finger in a glove will miss thin sites such as trails. There is also no message when a tap hits nothing, except that an open panel closes.
- The first tap on the Meadowbrook Park polygon at the start did nothing, and a second tap a few pixels away worked. I could not reproduce it, so I count it as a possible missed tap and not a finding.
- A double-tap to zoom that lands on a public land site also opens its details panel (happened when zooming toward Gifford). Zooming near sites will pop panels open.
- Unfolded, the details panel takes about 57 percent of the screen width and the map behind it is resized. The tapped site can end up hidden under the panel (Middle Fork River, `site-4-middlefork-unfolded.png`) and the map does not re-center. Folded, the sheet covers more than half the screen. It re-centered the map in one case and not in the other.
- Tap targets: the Map/Aerial/Hybrid buttons, Layers button, compass and panel close button are all large (about 55 to 60 dp). Text in panels is large and readable. Pass.
- Selected sites are outlined in yellow, which is easy to see. Closed sites carry a hatch.
- Response was slow, as expected on this machine: roughly 5 to 8 seconds for tiles to fill after a zoom jump, and 15 to 24 fps in the tour.

## Housekeeping

Airplane mode was left on, as found. The emulator was shut down with `adb emu kill`. After about 10 seconds `tasklist` showed no `qemu-system` process. The earlier smoke test files `smoke-unfolded.png` and `smoke-aerial-unfolded.png` in this folder were left untouched. No app code was changed and nothing was built or committed.
