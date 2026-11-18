# Step 3 checks on the Android emulator

Build tested: commit f23847c (HEAD of main when the build was cut), masked build (`VITE_MAPAPP_MASK_OWNERS=1`), catalog `http://10.0.2.2:8765/catalog.json`, kept as `build/step3-masked-debug.apk` (26 MB, no download folders in it). Emulator `mapapp_fold` (Android 16). Unfolded is display 4619827259835644672 (2208 x 1840), folded is display 4619827551948147201 (1080 x 2092). Data came from `release-test-server.mjs` at full speed, then at `--kbps 80`. No real phone was touched. Owner names read OWNER NAME in every screenshot. Parcels are named by ID.

Text quoted below was read from the WebView through the DevTools port (`cdp.mjs`) unless a screenshot is named. In the first run the app's "MB" were mebibytes (bytes / 1,048,576). From commit 48dcd32 on, 1 MB is 1,000,000 bytes everywhere (see the second run); the byte comparisons in this first section were made against the old unit. Files on the phone were counted with `run-as ... ls -l`. Server logs: `server-log-session1-full-speed.txt`, `server-log-session3-80kBps.txt` (the first session's log lagged behind the app by a minute or more; see check 5).

## Results

| # | Check | Result |
|---|---|---|
| 1 | First run, nothing downloaded | pass |
| 2 | Whole county in one tap | pass, with two faults (F4, F6) |
| 3 | Pick an area, sizes by detail | pass |
| 4 | Area holds every layer that was on | pass for the files, fault F5 for the wording |
| 5 | Airplane mode, area draws everything | pass |
| 6 | Kill mid-download, resume | pass for all three kills; fault F7 (verify) |
| 7 | Pause, resume, delete | pass |
| 8 | Connection states | pass |
| 9 | Screens folded and unfolded | fail (F1, F2, F3) |
| 10 | Step 2 still passes | pass |
| 11 | Anything else | see faults |

## 1. First run: pass
- Overview map shows, Offline maps button under Layers (`01-unfolded-first-run.png`).
- Zoomed in at Decatur (-88.9548, 39.8403): the card "Only a rough map here" with "Download maps" sits top left, clear of the readout card at bottom right. Property lines for Macon County draw; the readout names parcel 04-12-15-431-006 (`01-unfolded-first-run-zoomed-invite.png`).
- Server log: no request until Offline maps was opened; then one `GET /catalog.json` (10,682 bytes).
- Start-up took about 8 s from launch to a drawn map on the emulator.

## 2. Whole county: pass
- Macon, map and public land: card said Map 4.1 MB, Public land 0.1 MB, total 4.2 MB (`03-unfolded-macon-card.png`). Phone afterwards: basemap 4,271,625 + public land 99,815 = 4,371,440 bytes = 4.17 MiB. Match.
- Progress was shown in the list ("Downloading, 49%", "2.0 of 4.2 MB"), then "Ready to use offline" (text only). The notification permission dialog appeared at the first Download tap (`04-unfolded-county-after-download-tap.png`).
- The map showed street detail and names at once, without a restart (`06-unfolded-macon-detail-after-download.png`).
- With imagery ticked: card total 138 MB. Phone afterwards: 4,271,625 + 140,565,035 + 99,815 = 144,936,475 bytes = 138.2 MiB. Match. The Android notification "Downloading Macon County" with a progress bar was seen in the shade (`10-unfolded-notification-shade-progress.png`). Hybrid view then drew imagery (`12-unfolded-macon-hybrid-after-imagery-download.png`). The Map, Aerial, Hybrid switcher appeared only once imagery was on the phone.
- List with two Macon County entries: `11-unfolded-list-two-macon-entries-done.png`.

## 3. Pick an area: pass
Frame about 5 km, first in Map view with nothing installed, then in Hybrid view (imagery preselected at High, `19-unfolded-pick-area-hybrid-preselected.png`). Sizes shown, Hybrid area 5.9 x 4.2 km: None 0.7 MB, Low 1.2 MB, Medium 1.6 MB, High 2.6 MB. Map view area 5.1 x 4.5 km: None 0.7, Low 1.2, Medium 1.5, High 2.4 MB. Download at High, Hybrid area: shown 2.6 MB; on the phone 762,376 + 1,982,168 + 11,859 = 2,756,403 bytes = 2.63 MiB, and each layer matched its line (map 0.7, aerial 1.9). Map-view area: shown 2.4 MB; on the phone 759,204 + 1,719,173 + 11,859 = 2,490,236 bytes = 2.37 MiB. Match. Area 3 (shown 4.0 MB): 4,181,020 bytes = 3.99 MiB. Match. Area 1 of the 80 kB/s runs (shown 7.2 MB): 7,585,948 bytes = 7.24 MiB. Match. `18-unfolded-pick-area-high-map-view.png`.
Note: with nothing downloaded there is no Hybrid view and no public land switch, so "Hybrid and public land on" cannot be set first. The picker still offers imagery. I installed Macon imagery first, then picked, then deleted the county so the area stood alone.

## 4. Area includes every layer that was on: pass (files), fault F5 (wording)
Folder listing of the Hybrid area, pulled with `run-as`: `area-folder-listing-hybrid-area-2.txt` (basemap, aerial, publicland `.pmtiles`, a `.meta.json` each, `job.json`, `complete`). The picker says "Map 0.7 MB, public land less than 0.1 MB, aerial imagery 1.9 MB". Property lines: no screen says they are on the phone already and are not part of a download (F5).

## 5. Airplane mode: pass
Area deleted down to the one Hybrid area, app force-stopped, airplane mode on (`airplane_mode_on` 1, status bar icon, "Active default network: none", ping "Network is unreachable"). At -89.06, 39.93: Map (`20-unfolded-airplane-hybrid-warrensburg.png`, shows Map view with property lines), Aerial (`21-unfolded-airplane-aerial.png`) and Hybrid (`22-unfolded-airplane-parcel-tap.png`) all drew with property lines. Parcel tap returned OWNER NAME, Parcel ID 08-06-14-132-009, 1.5 acres (text), and for 08-06-14-132-005 "Acreage not listed in the county record" (screenshot above). Public land is listed in Layers and its polygons drew (pink outlines in `34-unfolded-list-airplane-waiting.png`, taken online). I did not find a public land polygon inside the area in airplane mode itself. Outside the area (Decatur): overview map, the "Only a rough map here" card, and in Hybrid view a plain grey ground with no imagery and no note about it (`24-unfolded-airplane-outside-area-decatur.png`).
Caveat on the server log: it showed 244 new lines after airplane mode went on, but the app made no download plugin call in that window (logcat), the lines were catalog and planning requests from earlier picks, and opening Offline maps in airplane mode added no line. I believe the log was written late; I could not prove it.

## 6. Kill and resume: pass (3 kills), fault F7
At 80 kB/s, area 7.2 MB.
- Force-stop: killed with 1,582,510 bytes in the part file (checkpoint 1,451,438). On `am start` the notification came back, the first request was `bytes=19935791-20328430` (the range that was cut), no earlier range was fetched again, finished at 6,615,096 bytes of aerial. Files pulled; `pmtiles verify` exit 0 for aerial and basemap.
- `kill -9` of the process (area 4.0 MB): part file 927,009, checkpoint 869,665. The service came back by itself within 5 s (new PID, no screen), the first request was `bytes=20086443-20313884`, inside the cut range, so it went on and did not start over. Finished; verify 0 for aerial and basemap.
- Kill 2 s after the tap (area 1.5 MB): checkpoint 1,481 (the header). After reopening it requested from the start of the first range and finished. Verify 0 for aerial and basemap.
- Public land of the finished area fails `pmtiles verify` in all three kills and also in an area that was never interrupted: "header MaxZoom=14 does not match max tile z 13" (F7). So it is not caused by the kill.
After a kill the screen does not come back by itself (normal Android); the download goes on in the background.

## 7. Pause, resume, delete: pass
List with one downloading and one waiting: "Starts when the download before it is done." Pause on the waiting one gave "Paused" (`30-unfolded-list-queued-one-paused.png`). Pause on the downloading one: no request in the next 9 s, status "Paused, 5.0 of 138 MB". Resume went on (request `bytes=1004887-` after the cut `21847-4216150`). Delete asks first: complete "This place will no longer have a map when you are offline.", downloading and paused "What has downloaded so far is thrown away." Keep it kept. Deleted a downloading one, a paused one and a complete one: each folder gone from `no_backup/areas` at once, requests stopped. After deleting both Macon county downloads the map fell back to the overview at once and the invitation card returned (`16-unfolded-map-after-delete-last-county.png`; ask screen `14-unfolded-delete-asks-first-complete.png`).

## 8. Connection states: pass
- Wi-Fi off (5G): panel says "You are on mobile data. Downloads use your data plan. You are asked before each one starts." The picker shows the amber note, and Download shows "Use 365 MB of mobile data? This comes out of your data plan. On Wi-Fi it costs nothing." with Download now and Not now (`33-unfolded-pick-mobile-data-question.png`). No request was made.
- Airplane mode: the list says "You are offline. Maps already on this phone still work, and so does your position. Sizes and new downloads need a connection." An area at 5% showed "Waiting for a connection ... Goes on by itself when the phone is online." (`34-unfolded-list-airplane-waiting.png`). Airplane off: "Downloading, 8%" within 6 s, no tap.
- First open with no connection after `pm clear`: "You are offline" and "The list of counties needs a connection the first time. It is kept on the phone after that." (`49-unfolded-offline-first-open-no-catalog.png`).

## 9. Screens on the device: fail
Folded list with a download (`40-folded-list-downloading.png`): nothing under the system bars, the sheet clears the navigation bar, the readout card sits behind the sheet (as in Step 2). Folded pick (`41-folded-pick-area.png`): the Name field is half hidden under the size footer until the panel is scrolled (F2). With the keyboard up (`42-folded-pick-name-keyboard.png`) the Name field is not visible at all (F2). Unfolded: panel beside the map, nothing cut. Fold and unfold in the middle of picking: the area survived (1.3 by 0.6 km folded, 1.0 by 0.8 km unfolded, same centre; `44-unfolded-pick-after-unfold.png`). Sources screen folded, with the overview map, Macon County and six areas present: it lists every area on its own line under each layer, six lines for aerial and six for base map before the license text (F8). Android Back (F1): on the Pick an area screen, on the Offline maps list and on Layers, Back leaves the app to the launcher. The activity is recreated on return: map back at the overview, panel closed, picked frame lost. The first Back with the keyboard up only hides the keyboard.

## 10. Step 2 still passes: pass
Route replay of 42 fixes (-89.06050 to -89.06296, 1 per second, 39.9155): the marker stayed centred and the readout changed parcel (`47-unfolded-route-end.png`: parcel 08-06-23-100-007, 111 m to the east line). The screen must stay awake: after the screen timed out the app (correctly) reported "Last position ... ago" until woken; I set stay-on for the test and switched it off at the end. Readout at the three fixes, online and in airplane mode with an area covering the spot (area 2 bounds -89.09472..-89.02528, 39.90657..39.94475):
| Longitude | Online | Airplane mode |
|---|---|---|
| -89.0609 | Parcel 08-06-23-100-005, 213 ft (65 m) W | same |
| -89.0615 | Parcel 08-06-23-100-005, 45 ft (14 m) W | same |
| -89.0625 | Parcel 08-06-23-100-007, 236 ft (72 m) E | same |
Screenshot kept: `46-unfolded-readout-lon-89.0625.png` (online). The airplane-mode screenshot was removed unseen; the text is from the debug port.

## 11. Other things
- No crash: 0 `FATAL EXCEPTION`, 0 `ANR` lines (`crash-log-grep.txt`).
- The app made no request before Offline maps was opened.
- Whole-county and area downloads both write 2 to 6 small `.meta.json` files next to the archives (about 1 KB each). They are not counted in the size shown. Harmless.
- Faults F4 and F6 below.

## Faults
- **F1 Android Back is not handled anywhere.** From the Pick an area screen, the Offline maps list and Layers, Back leaves the app and the screen state is lost.
- **F2 Name field in the picker.** Folded, the Name field is half under the size footer at rest, and with the keyboard up it is not visible (`42-folded-pick-name-keyboard.png`), so the user cannot see what is typed.
- **F3 Hybrid or Aerial outside any area** shows plain grey ground; the invitation card does not say there is no imagery there (`24-unfolded-airplane-outside-area-decatur.png`).
- **F4 County card after a map-only download** says "On this phone." although imagery (134 MB) is not on the phone. Ticking imagery brings the Download button back, but the new download repeats the 4.2 MB of map and public land and adds a second "Macon County" entry (two entries, 4.2 MB stored twice).
- **F5 Property lines are never explained as part of the app.** The only text is the footer "Public land and property lines come from public records. They are not a legal survey." No screen says they come with the app and are not downloaded.
- **F6 Notification permission** is asked by Android at the first Download tap with no sentence from the app before it. Sizes are labelled MB but are MiB (4,371,440 bytes shows as 4.2 MB; phones show 4.4 MB).
- **F7 Extracted public land** has a header max zoom higher than its highest tile, so `pmtiles verify` rejects it ("header MaxZoom=14 does not match max tile z 13" or "11"). Map and aerial extracts verify. The app draws it.
- **F8 Sources and licenses** lists one line per downloaded area under each layer (six lines each with six areas).
- **F9 Naming and step sizes.** An area covering both counties (253 by 185 km, 365 MB) was named "Macon County area 8". "Bigger area" grows by different factors depending on the zoom (3 taps gave 0.8 km at one zoom, 6.6 km at another, and 4 taps gave 71 km).


# Second run: regression on commit 42ddb78

Build: HEAD 42ddb78 (masked, catalog 10.0.2.2:8765), `build/step3-masked-debug.apk`, 27,665,254 bytes, SHA-256 `803f4ced9c08d67f62a4285e957507785544e87ae3c388ea6ce0b657e0cfbc45`. The APK was cut before faa515c (which changed the test server, a script and docs). The server was the faa515c one (UTC time on every line). Screenshots are in `run2/`. 1 MB is now 1,000,000 bytes, so the first run's "mebibyte" remark no longer applies. Text was read through the debug port. The emulator was unfolded unless named.

## Fix status of the first run's faults
| Fault | Fixed in | Second run |
|---|---|---|
| F1 Back | 0258ee3, 48dcd32 | fixed |
| F2 Name field | 42ddb78 | fixed |
| F3 no imagery card | 42ddb78 | fixed |
| F4 county card | 42ddb78 | fixed |
| F5 property lines wording | 0258ee3, 42ddb78 | fixed |
| F6 notification sentence, MB | 42ddb78, 48dcd32 | fixed |
| F7 public land verify | 4bf5069 | fixed |
| F8 Sources lists | 42ddb78 | one line per download is still listed, grouped per layer; accepted as designed |
| F9 name, step sizes | 42ddb78 | name fixed; steps still a little uneven (N2) |

## Results
- **Back (F1): pass.** With the button: Pick an area goes to the list, the list closes, Layers closes, Sources goes to Layers and then Layers closes. With nothing open, Back leaves the app; on return the process was the same, but the map showed dark for about 8 s first (N4; `01-back-nothing-open-return.png`). A swipe from the left edge also acted as Back (the emulator is on three-button navigation, so this was an injected edge swipe, not real gesture navigation). With the keyboard up, Back hides the keyboard only; the next Back goes up one screen.
- **Name (F2): pass.** Folded, the name sits above the size and Download: "Name: Macon County area 2" and Change (`07-folded-pick-name-row.png`). Change opens "Name of this area" with Done; with the real keyboard up the field, Done and Download stay visible (`07-folded-pick-change-keyboard.png`). The size stayed 1.3 MB while typing.
- **County card (F4): pass.** After map only: Map "On this phone." 4.3 MB, Public land "On this phone." 0.1 MB, Aerial imagery 141 MB, "Property lines are not part of the download: they come with the app for Macon County and work offline." (`04-unfolded-macon-card-after-map-only.png`). Ticking imagery gave "To download 141 MB". The area folders: first download basemap + publicland, second aerial only (140,565,035 bytes). No second base map. The list reads "Macon County, aerial imagery" and "Macon County" apart (text; its screenshot was not kept).
- **Public land verify (F7): pass.** Farmland area: publicland verify exit 0 (10,751 bytes, max zoom 13), basemap 0, aerial 0. Champaign basemap, public land, aerial: all 0, aerial identical (`cmp`) to the hosted file. Kill-test area: all three 0.
- **No imagery here (F3): pass.** Folded in Hybrid outside imagery: the full card with "Download imagery" and "Show the map" at the top, clear of the marker and readout; after a tap it becomes the compact "No imagery here" (`09-folded-hybrid-no-imagery-card.png`, compact form). Rotated: compact card, marker and readout clear (`23-rotated-no-imagery-card.png`). Unfolded upright: text read, no screenshot kept.
- **F5 and F6: pass.** The property lines sentence is on both county cards (Champaign: "none are offered for Champaign County yet") and in the picker. "Android may ask about notifications. They only show progress, and the download works either way." sits under each Download button; Android's dialog came after the tap. Sizes, shown against disk: county map + public land 4.4 MB, disk 4,271,625 + 99,815 = 4,371,440 bytes; Macon imagery 141 MB, disk 140,565,035; Champaign map + public land 12.2 MB, disk 12,168,646; Champaign imagery 226 MB, disk 225,572,890. The notification read "55.3 MB of 141 MB" while the screen read 57.6 of 141 MB moments later: same unit.
- **F8: accepted.** Sources lists a line per download under each layer.
- **F9: name pass, steps note N2.** An area across both counties is named "Champaign and Macon area 1". Bigger area steps: 2.2 by 1.5 km, 4.3 by 3.1, 8.7 by 6.2, 17 by 12 (2x each); the first taps right after opening were smaller (0.7 by 0.5 miles to 1.3 by 1.0 after three taps).
- **Outlines under the marker: pass.** With a fix at Decatur and the list open the blue dot and its circle stayed on top of the outlines (`15-unfolded-champaign-complete-marker-readout-kept.png`). While picking, the frame left the dot clear (seen live, screenshot not kept).

## The reviewer's additions
1. **Public land in airplane mode from a downloaded area: shown.** Only one area was on the phone (13 by 9.8 km at Decatur, public land 49,965 bytes; all county downloads deleted), app force-stopped, airplane mode confirmed (setting 1, "Active default network: none", ping unreachable). Many public land polygons drew, and a tap on the orange one opened "Sand Creek Open Space Reservation", Limited: permit needed, 777 acres, with the access text (`13-airplane-public-land-tap.png`; the polygons before the tap were seen live and are visible in that screenshot's map). Whole Macon County in airplane mode: it draws (`18-airplane-whole-macon-county.png`); public land is not visible at that zoom.
2. **Champaign County: shown.** Map + public land card 12.2 MB, disk 12,168,646 bytes. Imagery card 226 MB, disk 225,572,890 bytes, identical to the hosted file, verify 0. Panned there (Urbana, -88.2072, 40.1106): Map and Hybrid drew with imagery (`16b-unfolded-champaign-hybrid-drawn.png`).
3. **Marker and readout at completion and at deletion: shown.** A Champaign download completed with the fix at Decatur: 14 polls in 17 s and 14 screenshots; the readout text was present in every poll (`marker-readout-poll-county-complete.txt`), the dot and the property lines were in the completion frame (`15-unfolded-champaign-complete-marker-readout-kept.png`). A blink shorter than my 1.2 s sampling would not show. Deleting an area: 6 frames over 7 s; dot and readout stayed (`17-unfolded-just-after-delete-marker-readout.png`).
4. **Times on the server log: shown.** App stopped 01:55:06 UTC, started 01:55:07, "Offline maps" opened 01:55:48; the only request in the log in that time is `GET /catalog.json` at 01:55:48.356 (`server-log-run2-timed-a.txt`, `server-times-note.txt`). With airplane mode confirmed at 02:13:40, the last request in the log is 02:11:08 and there is none after (`server-log-run2-timed-b-100kBps.txt`). Caveat: an unfinished download resumes at app start by design; in the kill test below the first request came 18 s after the reopen.
5. **Kill and resume on this build: pass.** 100 kB/s, area 4.0 MB shown. Force-stop at 02:10:02 with 251,795 bytes in the part file. Reopen 02:10:21; the first request, at 02:10:39, was `bytes=1692967-1744734`, past the last pre-kill request (`bytes=1551045-1572146`); nothing was fetched again. Finished: basemap 785,112 + aerial 3,235,201 + public land 11,859 = 4,032,172 bytes. Verify exit 0 on all three. In airplane mode the area drew Aerial (`20-airplane-area-aerial.png`) and Hybrid, and a parcel tap gave parcel 08-06-23-100-007, 90.3 acres (`21-airplane-area-parcel-tap.png`).
6. Tested commit 42ddb78, APK SHA-256 above.
7. MB corrected above.
- **Step 2 line check, airplane mode with the area: pass.** -89.0609: parcel 08-06-23-100-005, 213 ft (65 m) W. -89.0615: parcel 08-06-23-100-005, 45 ft (14 m) W. -89.0625: parcel 08-06-23-100-007, 236 ft (72 m) E.
- **Crash log:** 0 `FATAL EXCEPTION`. Two ANRs, both of system apps (`com.android.settings`, `com.android.carrierdefaultapp`), none of MapApp (`crash-log-grep.txt`).

## New findings
- N1 After a reopen following a force-stop, the first resumed request came 18 s after the app was started (the first run's was faster).
- N2 "Bigger area" steps are uneven right after the picker opens.
- N3 The emulator reports airplane mode on one to five seconds before the network is really gone. My first airplane attempt in this run opened the app while it was still online; I repeated it. Tester note, not an app fault.
- N4 The first return from Back with nothing open shows a dark map for about 8 s.
- Not tested: a download started on Wi-Fi waiting rather than using mobile data (a later change).

# Third run: final build, commit d3a0a54

Build: `build/step3-masked-debug.apk`, SHA-256 `8abac4ddb67f0bb320a12543e379bca01c1caa516b387b7742242a486dace08f` (checked before installing; not rebuilt), from commit d3a0a54. Old app uninstalled first. Emulator unfolded, 1 MB = 1,000,000 bytes. Screenshots are in `run3/`; every one was looked at. Crash log: 0 FATAL EXCEPTION, 0 ANR of MapApp (`run3/crash-log-grep.txt`). The emulator ended with airplane mode off and Wi-Fi on.

## 1. Airplane mode step check, one session, one area (d3a0a54): pass
- **The area:** 19 by 14 km around Decatur (Sand Creek Open Space and Lake Decatur in it), picked with Map view and public land on, imagery High. Sizes shown for this one frame: None 2.6 MB, Low 7.8 MB, Medium 18.8 MB, High 50.0 MB (item 5). I downloaded High; the notification question came first (`03-notification-permission-dialog.png`). Files on disk: basemap 2,514,602 + aerial 47,433,696 + public land 69,727 = 50,018,025 bytes (shown 50.0 MB; the aerial and base map and public land lines of the screen were 47.4, 2.5 and 0.1 MB). `pmtiles verify`: exit 0 on all three. Folder listing: `area-folder-listing.txt`.
- **Network down:** force-stop, airplane mode on, then I waited until "Active default network: none" and ping said "Network is unreachable" (airplane-confirmed 03:17:42 UTC; `server-times-note.txt`). The last request in the server log is 03:17:16.780 UTC, 25 s before that; none after (`server-log-run3-session-a.txt`, up to the point I switched airplane mode off).
- **In that one session, offline:** Map view with public land polygons (`04-airplane-area-map-view.png`); a tap on the orange polygon opens "Sand Creek Open Space Reservation", limited, permit needed, 777 acres (`05-airplane-public-land-tap-panel.png`); Aerial view (`06-airplane-area-aerial-view.png`); Hybrid view (`07-airplane-area-hybrid-view.png`); property lines and a parcel tap in Hybrid: OWNER NAME, 3.2 acres, parcel 04-12-03-153-010 (`09-airplane-parcel-tap-panel.png`); outside the area (-89.35, 39.70): in Hybrid the card "No imagery here on this phone. Imagery is offered for Champaign County and Macon County only." (`10-airplane-outside-area-overview.png`), and after "Show the map" in Map view the overview map with the card "Only a rough map here" (`11-airplane-outside-area-map-view-overview.png`; at that zoom of 100 ft the overview map is blank ground, which is what the overview map has to show at that scale).

## 2. Property lines when an area completes (d3a0a54): no blink seen
With the fix at Decatur (inside Macon County) and the map at 50 ft, I downloaded the Champaign County map from the list and took 40 screenshots 0.7 to 1.1 s apart across the whole download and past completion (completion at about 03:25:18 UTC, frames 7 to 9). The number of lime property-line pixels in the map pane was 2,260 in all 40 frames, and the marker (blue) pixels 570 then 563, so neither the lines nor the dot blinked or vanished at my sampling rate. A blink shorter than about 0.7 s would not show. `15-blink-test-frame-08-at-completion.png` is a frame from the run (the list was at 88% in it, because the screenshot clock and the log clock differ by a second or two; the lines and dot show). A first attempt at a lower zoom drew no property lines (they draw only when zoomed in), so I discarded it. Files: `blink-frame-times.txt`, `blink-pixel-counts.txt`.

## 3. F8 Sources (d3a0a54): collapsed as in the browser
With three areas of Macon County that hold the same base map (areas 1, 2, 3; later 4 and 5), Sources lists under Base map: "Overview map of the whole region, with the app. Built November 17, 2026, 6.9 MB." and "Macon County, in 3 downloads. Built November 12, 2026, 5.1 MB in all." (`12-sources-three-areas-same-county.png`). Public land says "Macon County, in 3 downloads. ... 0.1 MB in all", imagery "Macon County, downloaded as Macon County area 1 ... 47.4 MB". So it is collapsed. My second run listed a line per download because that build (42ddb78) did not have the collapse yet. One thing that differs from a plain browser case: the source, license and credit block under Base map appears twice, because the overview map and the county files have different data dates (November 17 and November 12).

## 4. F9 Bigger area steps (d3a0a54): not a doubling every tap
Frame width from a fresh picker, then after each tap: 0.1 miles (0.2 km), 0.3 (0.4 km), 0.5 (0.8 km), 1.0 (1.6 km), 1.6 (2.5 km), 3.0 (4.8 km); taps 6 and 7 gave 6.0 (9.6 km) and 12 (19 km). Ratios per tap: 2.0, 1.9, 2.0, 1.6, 1.9, 2.0, 2.0 (from the km values: 2.0, 2.0, 2.0, 1.6, 1.9, 2.0, 2.0). So six of seven taps double the width and tap 4 grows it by 1.6. The earlier uneven steps are mostly gone.

## 5. Sizes at each imagery detail (d3a0a54), one frame 12 by 8.7 miles
None 2.6 MB (map 2.5, public land 0.1). Low 7.8 MB (imagery 5.2). Medium 18.8 MB (imagery 16.2). High 50.0 MB (imagery 47.4). Downloaded High: 50,018,025 bytes on disk (above). Matches the screen.

## 6. Wi-Fi and mobile data (d3a0a54): pass
Server at 150 kB/s. A 135 MB download was started on Wi-Fi ("Downloading, 1%, 1.8 of 135 MB"). Wi-Fi off (status bar 5G, active network switched): the card read "Waiting for Wi-Fi, 2.1 of 135 MB. Goes on by itself on Wi-Fi." with a "Use mobile data" button, and the panel note "You are on mobile data. A new download asks before it uses your data plan. Downloads started on Wi-Fi wait for Wi-Fi." (`16-wifi-off-waiting-for-wifi.png`). The server log had no new request in the 8 s I watched. Wi-Fi on: 4 s later still waiting, 8 s later "Downloading, 1%, 2.5 of 135 MB", then 3.1 and 3.8 MB (`17-wifi-back-downloading.png`). I did not press "Use mobile data" or wait for the download to finish; I deleted it.

## Other things seen on d3a0a54
- The Hybrid-view card outside imagery now says "Imagery is offered for Champaign County and Macon County only." and the Map view card says "Detailed maps are offered for Champaign County and Macon County only." (new wording, accurate outside both counties; at -89.35, 39.70 the place is outside Macon County).
- At the first start after install a system "Application Not Responding" dialog for system UI covered the screen; it is the emulator, closed with a system-dialog broadcast.
- Not repeated on this build: the three Step 2 longitudes, kill-and-resume, F1 and F2 (screens unchanged by your note).
