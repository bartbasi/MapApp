# Step 1 final emulator pass

Build: `build/step1-debug.apk`, package `io.github.bartbasi.mapapp`, emulator `mapapp_fold`, airplane mode on (settings value 1, ping 8.8.8.8 gave "Network is unreachable"). 14 November 2026. Emulator shut down at the end (no qemu process left).

## Result

One check fails: the double tap (check 3). On this build a double tap on a public land site zooms the map AND opens the site panel. I saw this 4 times (unfolded twice, folded once, plus once by accident while zooming). Everything else passed. Check 11 is only partly covered, because I cleared the log before the frame test.

## 1. Opening view in Aerial and Hybrid: pass
- Aerial and Hybrid both show imagery of both counties at the two-county opening zoom, unfolded and folded. No more plain beige map. Files: `opening-aerial-unfolded.png`, `opening-hybrid-unfolded.png`, `opening-aerial-folded.png`, `opening-hybrid-folded.png`. (Folded shots were taken after a relaunch while folded.)
- Start-up: `launch-5s.png` (5 s) shows the whole screen filled with the beige base color, the switch, Layers button, scale bar and credit, but no map features yet. `launch-12s.png` (12 s) shows the full two-county map across the whole screen. It did not draw only half the screen this time.

## 2. Base views: pass
Scale bar 3000 ft unfolded, 1 mi folded. In every file the credit line is to the right of the scale bar and does not cover it.
- `map-unfolded.png`: credit one line, no overlap.
- `aerial-unfolded.png`: credit one line, no overlap.
- `hybrid-unfolded.png`: credit one line, no overlap.
- `map-folded.png`: credit two lines, starts right of the scale bar, no overlap.
- `aerial-folded.png`: credit three lines, no overlap.
- `hybrid-folded.png`: credit three lines, no overlap.
- `layers-open-aerial-unfolded.png`: Layers panel open, map narrower, credit two lines starting at x about 333 while the scale bar ends at x about 255. No overlap. (The old overlap is fixed.)

## 3. Double tap: FAIL
Expected: map zooms, no panel. Observed: map zooms and the panel opens.
- Unfolded, Aerial view, Meadowbrook Park (130 acres): tap pair at 1375,330. `double-tap-after.png` shows scale 3000 ft to 1000 ft (zoomed) and the Meadowbrook Park panel open. Timing in `double-tap-timing-unfolded.txt`: first tap to second tap about 26 ms apart, so the taps were close enough.
- Folded, Map view, Meadowbrook Park: tap pair at 794,929, gap about 25 to 32 ms (`double-tap-timing.txt`). `double-tap-after-folded.png` shows zoomed map plus the bottom sheet open.
- Two more times while zooming in with double taps on the map (a Carle Park panel opened in `map-folded.png` before I closed it, a Heritage Park panel opened in `spitler-nav1.png`, and a "Mahomet Site" panel opened in `lotw-nav1.png`). Each time a double tap landed on or near a site.
- Single tap: the panel opens (`single-tap-after.png` unfolded, `single-tap-after-folded.png` folded). I did not measure the exact delay; the panel was there at the next screenshot (about 2 s later; `single-tap-early-folded.png` was taken too early to tell).
- Reproduce: Map view, zoom so a park is large, run `adb shell "input tap X Y; input tap X Y"` inside it.

## 4. Side panel keeps the site in view (unfolded): pass
`side-before.png`: Meadowbrook Park at the right edge (right third, partly cut off). `side-after.png`: panel open on the right, the whole park is visible in the narrower map, roughly centered horizontally (x about 490 to 900 of the 1150 wide map) and in the upper half vertically. Not hidden.

## 5. Bottom sheet keeps the site in view (folded): pass
`sheet-before.png`: Meadowbrook Park in the lower half (y about 1260 of 2000). `sheet-after.png`: sheet open, park fully visible above the sheet (y about 330 to 560), outlined in yellow.

## 6. Closed site note: pass
Spitler Woods Nature Preserve (hatched purple, 146 acres), tapped at the hatched part. `closed-site.png`: red "No hunting" block with text starting "The source data lists this site as closed to the public, so do not enter or hunt here. If you think that is wrong, ask the managing body." Access line: "Closed to the public on foot." Managed by Illinois Nature Preserves Commission.

## 7. Credits: pass
- Macon site: `macon-credit.png` (Spitler Woods Nature Preserve; also Heritage Park in `spitler-nav1.png`). The panel credit is only the U.S. Geological Survey PAD-US 4.1 line. No Champaign Regional Planning Commission line. I used Mount Zion sites, not a Decatur park or Rock Springs. The panel is short, so no scrolling was needed.
- Champaign site: `champaign-credit.png` (River Bend Forest Preserve, Champaign County Forest Preserve District, 284 acres). Credit is the Champaign County Regional Planning Commission Greenways line only. Also the Champaign city sites (Meadowbrook Park, First Street Trail) show only PAD-US.
- Note: the Layers panel "Installed map data" list still shows "Public land: Champaign County, Macon County" with the Regional Planning Commission credit inside the one entry (`layers-installed-data.png`). That is the layer-level list, not a site panel.

## 8. Thin site: pass
Site: First Street Trail (3 acres, Champaign Park District), a pink strip along First Street, zoom 1000 ft. Distances are physical screen pixels on the unfolded screen (2208 wide), measured from the strip's center line.
- About 30 px beside it: panel opened (`thin-site.png`, yellow outline on the strip).
- About 120 px away: nothing opened (`thin-site-120px-nothing.png`).
- I did not test 60 px. Reach in the brief is 22 CSS px, about 58 screen px.

## 9. Sources screen: pass
`sources-aerial.png` (and copy `sources-aerial-champaign.png`): Aerial imagery, Champaign County, built November 14, 2026, 215.1 MB. Source USDA NAIP 2025 and NAIP 2023, license Public domain, credit and data dates shown. `sources-aerial-macon.png`: Macon County aerial, 134.1 MB, USDA NAIP 2025, Public domain, data date September 15, 2025. Both name source and license. The Champaign entry's note says imagery is built from the 1.2 m level, clipped to the county outline plus about 300 m.

## 10. Frame test: pass (ran)
Unfolded, Map view, public land on. `frame-test-final.log`: 843 frames in 15.1 s, average 55.8 fps, worst 1 percent 20 fps, 13 frames over 33 ms, settle 398 ms, 302 tile reads, 0 failures. Screenshot `diag-result.png`. This is far faster than the earlier emulator run (23 fps); this was a fresh, lightly loaded session. Still an emulator, not a phone.

## 11. Log: partly covered
I ran `logcat -c` before the frame test, so earlier lines (start up, taps, panning) are not in the log. `logcat-final-all.txt` (warnings and errors since then) has 8 lines, none from the app. `logcat-final.txt` is empty. No `net::ERR` and no "safe area" error in what was kept. The Diagnostics screen showed 32 tile reads requested, 0 failed, before the frame test and 302 requested, 0 failed after. I did not see any failed tile read on screen or in the kept log. I cannot say anything about the part of the session before the clear.

## Other notes
- Folded start: after a relaunch the folded Aerial and Hybrid opening view showed imagery, scale bar 20 mi, credit three lines, no overlap.
- Zoom out by gesture and two-finger rotate were not tested (adb cannot send them).
