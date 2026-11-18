# Step 3 report: offline downloads

Date: 2026-11-17. Written for Bart.

## Result

The app can now download a whole county or a picked area, and it no longer needs its map data built in. It works on the emulator, against a file server on this laptop that behaves like GitHub's. It has not downloaded anything on a real phone yet, and nothing is published.

- **Works:** one-tap county downloads. An area picker with four levels of imagery detail and the exact size shown before the download starts. A list of downloads with pause, resume and delete. A download that goes on in the background and after the app is killed. A small overview map that comes with the app.
- **Also done in this step:** the location plugin was replaced, as you approved. The closed Google library is gone from the build. You checked the new plugin outdoors: the dot was "spot on", at 1 m accuracy, within a few seconds.
- **Does not work yet:** downloads on your phone away from this laptop. The map data is not on GitHub, because you have not said yes to publishing it. Until then a phone can download only through the cable from this laptop.
- **Not proven:** a long download on a real phone with the screen off, a real mobile network, and GitHub's real servers. See "What is not proven".
- **Held back:** I have not pushed Step 3 to GitHub. It is question 1.
- **Needed from you:** the answers to the four questions at the end. Try the downloads on your phone through the cable.

No money was spent. No license was accepted. No data file was committed, pushed or published. Property lines are not a download: they come inside the test build for Macon County, as in Step 2.

## What you will see on the phone

1. With nothing downloaded, the app opens on an overview map of the region. It shows highways, main roads, towns, rivers and lakes. Property lines for Macon County still draw, and the position card still works, because both come with the build.
2. Zoom in. A card says "Only a rough map here" with a "Download maps" button.
3. Tap the new "Offline maps" button, under the Layers button at the top right.
4. **Whole county.** Each county has a card that lists the map, public land and aerial imagery with the size of each. The map is always included. Imagery is the big one: 141 MB for Macon County and 226 MB for Champaign County, against 4.4 MB and 12.2 MB for the map and public land. Tick what you want and tap Download.
5. **Pick an area.** The frame stays still and you move the map under it with one finger. "Bigger area" and "Smaller area" double or halve it. Choose imagery detail: None, Low, Medium or High, each with a sentence on what shows on the ground. The size under it is exact. Tap Download.
6. The first time, Android asks to show notifications. They only show the download's progress. The download works either way.
7. The list shows each download with its size, a progress bar, and Pause, Resume, Show on map and Delete. Delete asks first.
8. When a download finishes, the map shows the detail at once. You do not need to restart the app.
9. If you are on mobile data, the app asks "Use ... MB of mobile data?" before a download starts. A download started on Wi-Fi waits for Wi-Fi if the Wi-Fi drops, and shows a "Use mobile data" button.
10. In the Aerial or Hybrid view, where no imagery is on the phone, a card says "No imagery here on this phone."

Sizes are in MB of 1,000,000 bytes, the same way Android's storage settings count.

## The test builds

- `build/step3-debug.apk` is for your phone. It shows real owner names. It carries the overview map and the Macon County property lines, and nothing else.
- `build/step3-masked-debug.apk` is the same with every owner shown as "OWNER NAME". Every screenshot in the repository comes from a masked build.
- Both fetch their list of maps from this laptop, not from GitHub. On your phone that works only while the phone is on the cable. What you download through the cable stays on the phone and works in the field.

## The checks of Step 3

| Check | Result |
|---|---|
| In airplane mode, a downloaded area draws every bundled layer | Pass on the emulator. The base map, the imagery, public land and property lines all drew, and taps on a parcel and on a public land site answered. |
| Killing the app in the middle of a download and reopening it resumes the download without corrupting the area | Pass on the emulator, seven times in three different ways. Each finished file passed the reference tool's check. |
| A downloaded area includes every layer the user had turned on | Pass for the base map, public land and imagery. Property lines were on but are not a download. The screens say so. |

Step 2's checks were run again with the new location plugin and pass.

### Airplane mode

The tester downloaded one area of 13 by 9.8 km at Decatur, deleted every other download, stopped the app and turned on airplane mode. On reopening:

- The Map, Aerial and Hybrid views drew inside the area.
- Public land drew, and a tap opened a site of 777 acres with its manager and hunting note.
- A parcel tap returned the owner (shown as OWNER NAME), 90.3 acres and parcel ID 08-06-23-100-007 in the Warrensburg test area.
- Outside the area the map fell back to the overview map.
- The server's log has no request after airplane mode was confirmed.

### Kill and resume

The server was slowed so that there was time to kill the app.

| How the app was killed | What happened |
|---|---|
| Forced stop at 1.58 MB (first run) | Resumed from its last saved point at 1.45 MB and finished. |
| Process killed (first run) | Android restarted the download service by itself in under 5 seconds. It resumed and finished. |
| Killed 2 seconds after the tap (first run) | Resumed from the start of the data and finished. |
| Forced stop on the final build (second run) | The first request after reopening began at byte 1,692,967, past the last byte asked for before the kill. Nothing was fetched twice. |
| Forced stop and process kill, driven without the screens | The finished file's checksum equalled the reference file's in both. |
| Forced stop after the review fixes | It went on from exactly its saved place, byte 6,203,838. The finished file was identical to the reference. |

A download saves its place to the phone's storage about once a second. After a kill it cuts the file back to the last saved place and goes on from there. An area shows on the map only when every file of it is complete.

This tests a killed app. It does not test the phone losing power in the middle of a write.

### Sizes shown against bytes on the phone

| Download | Size on the screen | Bytes on the phone |
|---|---|---|
| Macon County, map and public land | 4.4 MB | 4,371,440 |
| Macon County, imagery | 141 MB | 140,565,035 |
| Champaign County, map and public land | 12.2 MB | 12,168,646 |
| Champaign County, imagery | 226 MB | 225,572,890 |
| An area north of Warrensburg | 4.0 MB | 4,032,172 |

The Champaign County imagery on the phone was the same, byte for byte, as the file on the server.

An area of 5.9 by 4.2 km read 0.7 MB with no imagery, 1.2 MB at low detail, 1.6 MB at medium and 2.6 MB at high.

### Step 2's line check, again

With the new location plugin, in airplane mode, with an area downloaded over the spot:

| Longitude | Readout |
|---|---|
| -89.0609 | Parcel 08-06-23-100-005, 65 m to the line |
| -89.0615 | Parcel 08-06-23-100-005, 14 m to the line |
| -89.0625 | Parcel 08-06-23-100-007, 72 m to the line |

These are the Step 2 figures.

## How a download works

The design is decision D33 in `docs/DECISIONS.md`.

- The base map, imagery and public land of each county are plain files on a server. A list of them, with sizes and checksums, tells the app what exists.
- For a picked area the app reads only the index of each file, which is one to three small reads. From that it works out exactly which bytes hold the area's tiles. That is why the size is exact.
- The phone then fetches those bytes and writes a smaller map file of its own. A whole county is the same job with the whole file as its one piece.
- The part that understands map files is tested against the real files and against the standard reference tool. In 24 test areas every copy matched the original tile for tile.
- The part that fetches bytes is native Android code. It checks that every answer is exactly the bytes it asked for, and it refuses anything else.
- The app makes no request at all until you open "Offline maps". One exception: a download that was unfinished when the app closed goes on when the app opens.

## The location plugin

You approved replacing it. The new one uses only Android's own location interface.

- The Step 2 build held 1,076 classes of Google's Play services library. The new build holds none.
- It listens to the GPS once a second. Where the phone has Android's own combined provider, it uses that only while no GPS fix younger than 5 seconds has arrived.
- On your phone its log showed fixes arriving straight from the GPS once a second, and the app stopped listening when it left the screen.
- One visible change: switching Location off while the app is tracking now shows "Location is switched off" at once and removes the marker. Before, it left a gray marker and the old card.

## What the independent review found

A reviewer with no part in the work read the code and the evidence. It found no fault that blocks the step. It confirmed that no data file is in git, no private owner's name is in any tracked file, no closed library is in the build, and the staged files hold no parcel data. It found these, all now fixed unless the line says otherwise:

1. **A download started on Wi-Fi would have gone on over mobile data without asking.** Neither part of the downloader looked at whether the connection is charged by use. Now such a download waits for Wi-Fi and shows a "Use mobile data" button. Seen on the emulator: with Wi-Fi switched off in the middle of a 145 MB download, the open request was cut within a tenth of a second, the list read "Waiting for Wi-Fi", and nothing more was fetched. It went on by itself when Wi-Fi came back, and at once after a tap on "Use mobile data". A download left over from the old build also waited.
2. **Nothing inside the app refused parcel data from a download list.** Only my publishing script did. The app now drops any parcel entry in a list and never plans one.
3. **Every size estimate re-read the same file headers.** One test session made 316 redirected requests. Reads are now kept. Panning a 3 km frame four times takes 3 reads where it took 15.
4. **"Goes on with the screen off" was claimed on a 98 second test.** The lock that keeps the phone awake was taken for 30 minutes and never renewed. The lock is now renewed every 30 seconds while bytes arrive and dropped at once when they stop. It was seen held for 4 minutes 42 seconds without a break on the emulator. A long download on a real phone is still unproven.
5. **The publishing script did not re-check its files before an upload.** It now compares every file's size and checksum with the list first.
6. **One layer was unproven in airplane mode.** The first test run found no public land site inside its area. The second run shows one drawing and answering a tap.
7. **No guard stops a public build from carrying parcel data.** The test builds carry the Macon County parcel file with real names, by design. A check that a release build carries none must exist before Step 5. Not fixed yet.
8. **GitHub's real behaviour is assumed.** See "What is not proven".

## Faults the tester found, all fixed

The first run on the emulator found nine faults. The second run confirmed each fix on the device.

- The Android back button left the app from every panel. Back now steps back inside a panel, then closes it, and leaves the app only with nothing open.
- On the folded screen the Name field was hidden, fully so with the keyboard up.
- A county card said "On this phone" when only its map was downloaded, and adding imagery downloaded the map a second time. The card is now truthful per layer, and adding imagery fetches only imagery.
- Every public land copy of an area in open farmland failed the reference tool's check. The file said it went to zoom 14 when its own tiles stopped at 13. The app drew it correctly, but the file was not valid.
- The Aerial view outside a downloaded area showed gray ground with no explanation.
- No screen said that property lines are not a download.
- Android's notification question came with no word from the app first. Sizes labelled MB were counted in units of 1,048,576 bytes.
- The Sources screen grew one line per download.
- An area across both counties was named after one. "Bigger area" grew by uneven amounts.

## What I got wrong or missed during the step

- **I asked "may I start Step 3" without telling you that its first task publishes map data.** I caught it before publishing anything, and asked again.
- **The first tests of the area copies used boxes over Decatur and Urbana.** Towns have parks, so the public land fault in open farmland went unseen until the tester picked a farmland area. The tests now include six boxes in empty farmland.
- **I specified the downloader without a word about mobile data.** The reviewer caught it.
- **I wrote "a download goes on with the screen off" into the design on thin evidence.**

## What is not proven

- **Nothing in Step 3's downloads has run on a real phone.** That includes the background service, the notification, the back button, the keyboard on the cover screen, and gloves on the buttons.
- **GitHub's real servers.** Every download so far came from this laptop. The test server copies GitHub's redirect to a short-lived address and its byte range answers. Whether GitHub's own answers differ in some detail is unknown until a first real release. I will treat that first release as a test before pointing the app at it.
- **A long download with the screen off on a real phone.** Android's battery saving, and Samsung's own limits, are untested.
- **A real mobile network.** The emulator's stand-in was used.
- **A full phone.** The out-of-space path is written but was not provoked.
- **Android's limit of six hours a day** on this kind of background work was not reached. When it is reached, the download stops and goes on the next time the app is opened.
- **Loss of power in the middle of a write.**
- **Gesture navigation.** The emulator uses the three buttons.

## Known defects and limits

- A public build has no way to get property lines. They reach a phone only inside a build. That is your decision to make (question 3).
- The overview map shows no minor roads. Past zoom 11 it shows only coarse roads until a county or an area is downloaded.
- After a forced stop, the first request of a resumed download came 18 seconds after the app opened in one test. Earlier tests were faster.
- Coming back to the app after leaving it with the back button showed a dark map for about 8 seconds on the emulator.
- The first taps on "Bigger area" after the picker opens are smaller steps than later ones.
- A downloaded area's outline shows only while the downloads panel is open, and has no entry in the Layers legend.
- On the folded screen the Offline maps panel covers the position card, as the other panels do.
- Adding imagery to a county already on the phone makes a second entry in the list for that county.
- A download cannot be renamed after it starts.
- A download that waits for Wi-Fi keeps its notification showing. Android would not let the app restart the download from the background otherwise. The waiting time counts toward Android's limit of six hours a day.
- If a finished download's own record is damaged, the list calls it "Unreadable download" and "Cannot be used", although its map still draws. The words need softening.
- Opening "Offline maps" on mobile data reads the list of maps, about 10 KB, without asking.
- The app took about 8 seconds from launch to a drawn map on the emulator.
- From Step 2, still open: Champaign County has no property lines. Nobody has walked across a known property line in Macon County with the app.

## Questions for you

1. **May Step 3 go on GitHub?** It is about 40 commits with about 150 new screenshots. As in Step 2, some show Macon County parcel lines and parcel IDs, with owner names masked. Your earlier yes named the Step 2 screenshots.
2. **May I publish the map archives as GitHub release files?** Six files, 383 MB, no parcel data. The base map and public land files go out under the Open Database License with their credits. One thing to read first, for the two imagery files only: the imagery is the USDA's and is public domain, but I fetched it through Microsoft's Planetary Computer. Microsoft's general terms, which I read only through a summary, say "Unless otherwise specified, the Services are for your personal and non-commercial use." The page is https://www.microsoft.com/en-us/legal/terms-of-use. You can say yes to the four other files now and decide on the imagery after reading it. A published file cannot be taken back once people have fetched it.
3. **How should property lines reach a phone that is not yours?** Today they travel only inside a build. A public release must either carry them, or offer them as a download, or go without. Each needs the counties' written word. This is the same as Step 2's question 2, still open.
4. **Champaign County.** The plan and a draft email to the county's GIS consortium are in my message of this evening. My part takes about two hours once a file arrives.

Still open from Step 2: the state geological survey's leaf-off imagery, the Department of Natural Resources' hunting table, and whether 3 m is the right allowance for error in the county's lines.

## Where things are

- `docs/DECISIONS.md`: D31 (location plugin), D33 (how downloads work).
- `docs/evidence/step3/location/`: the new location plugin on the emulator, and the proof that the closed library is gone.
- `docs/evidence/step3/downloader/`: the native downloader driven without the screens.
- `docs/evidence/step3/screens/`: every download screen, folded and unfolded.
- `docs/evidence/step3/emulator/`: the tester's two runs through the real screens.
- `docs/evidence/step3/review-fixes/`: what was shown after the review.
- `app/src/downloads/`: the part that understands map files, and the download manager. `app/src/ui/downloads/`: the screens. `app/android/.../downloads/`: the native downloader.
- `pipeline/publish.py`: prepares the map files for publishing. Its upload step has never been run.
