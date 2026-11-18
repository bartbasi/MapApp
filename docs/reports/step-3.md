# Step 3 report: offline downloads

Date: 2026-11-17. Written for Bart.

## Result

The app can now download a whole county or a picked area, and it no longer needs its map data built in. It works on the emulator, against a file server on this laptop that I built to copy what GitHub's servers are believed to do. It has not downloaded anything on a real phone yet, and nothing is published.

- **Works:** one-tap county downloads. An area picker with four levels of imagery detail and the exact size shown before the download starts. A list of downloads with pause, resume and delete. A download that goes on in the background and after the app is killed. A small overview map that comes with the app.
- **Also done in this step:** the location plugin was replaced, as you approved. The closed Google library is gone from the build. You checked the new plugin outdoors and told me the dot was "spot on", at 1 m accuracy, within a few seconds. That is your word; I have no screenshot of it.
- **Does not work yet:** downloads on your phone away from this laptop. The map data is not on GitHub, because you have not said yes to publishing it. Until then a phone can download only through the cable from this laptop.
- **Not proven:** a long download on a real phone with the screen off, a real mobile network, and GitHub's real servers. See "What is not proven".
- **Held back:** I have not pushed Step 3 to GitHub. It is question 1.
- **Needed from you:** the answers to the four questions at the end. Plug the phone in so I can install the build and you can try the downloads through the cable. That has not been tried yet.

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
- `build/step3-masked-debug.apk` is for the emulator. It shows every owner as "OWNER NAME" on the screen. Every screenshot in the repository comes from a masked build.
- **Neither file may be passed on to anyone.** Both hold the Macon County parcel file with the real owner names inside. Masking changes only what the screen shows.
- Neither build fetches anything from GitHub. The phone build asks this laptop for its list of maps, through the cable. The masked build asks the laptop at an address only the emulator has.

To download on your phone, three things must be true. I do the first two each time the phone is plugged in.

1. The file server is running on this laptop (`node app/scripts/release-test-server.mjs data/publish/phone-test --port 8765`).
2. The cable is set to carry the phone's requests to the laptop (`adb reverse tcp:8765 tcp:8765`). This must be done again after every plug-in.
3. The phone stays on the cable until the download is done.

What you download this way stays on the phone and works in the field. Away from the cable, "Offline maps" will say the list of maps could not be fetched. This has not been tried on your phone yet.

## The checks of Step 3

| Check | Result |
|---|---|
| In airplane mode, a downloaded area draws every bundled layer | Pass on the emulator, on the final build. The base map, the imagery, public land and property lines all drew, and taps on a parcel and on a public land site answered. |
| Killing the app in the middle of a download and reopening it resumes the download without corrupting the area | Pass on the emulator, seven times in three different ways. Every resumed base map and imagery file passed the check of the standard `pmtiles verify` tool. The public land files failed that check in the first run for a reason that had nothing to do with the kill, and pass since the fix. |
| A downloaded area includes every layer the user had turned on | Pass for the base map, public land and imagery. Property lines were on but are not a download. The screens say so. |

Step 2's position checks were run again with the new location plugin and pass.

### Airplane mode

This was run on the final build, in one session, on one area. The area was 19 by 14 km around Decatur, downloaded with imagery at high detail. It was 50.0 MB on the screen and 50,018,025 bytes on the phone.

The tester stopped the app, turned on airplane mode and waited until the emulator had no network at all. The server's last request was 25 seconds before that moment, and there was none after. On reopening:

- The Map view drew, with public land on it.
- A tap on a public land site opened its panel: 777 acres, "Limited: permit needed".
- The Aerial view and the Hybrid view drew.
- Property lines drew. A parcel tap returned the owner (shown as OWNER NAME), 3.2 acres and parcel ID 04-12-03-153-010.
- Outside the area, the Hybrid view showed the card "No imagery here on this phone" and the Map view showed "Only a rough map here".

All three files of the area passed the `pmtiles verify` check.

One thing was not captured: the overview map itself, zoomed out, outside the area in airplane mode. The first run saw it on an earlier build.

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

The kills were run on three builds as the step went on. The last row is the final build's code. The others are earlier builds.

### Sizes shown against bytes on the phone

| Download | Size on the screen | Bytes on the phone |
|---|---|---|
| Macon County, map and public land | 4.4 MB | 4,371,440 |
| Macon County, imagery | 141 MB | 140,565,035 |
| Champaign County, map and public land | 12.2 MB | 12,168,646 |
| Champaign County, imagery | 226 MB | 225,572,890 |
| An area north of Warrensburg | 4.0 MB | 4,032,172 |

The Champaign County imagery on the phone was the same, byte for byte, as the file on the server.

For one frame of 12 by 8.7 miles the picker showed 2.6 MB with no imagery, 7.8 MB at low detail, 18.8 MB at medium and 50.0 MB at high.

### Step 2's line check, again

With the new location plugin, in airplane mode, with an area downloaded over the spot. This was run on the build of the second test run, before the review fixes, and was not repeated on the final build:

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
- The part that understands map files is tested against the real files and against `pmtiles`, the standard open source tool for this file format. In 24 test areas every copy matched the original tile for tile.
- The part that fetches bytes is native Android code. It checks that every answer is exactly the bytes it asked for, and it refuses anything else.
- The app makes no request at all until you open "Offline maps". One exception: a download that was unfinished when the app closed goes on when the app opens.

## The location plugin

You approved replacing it. The new one uses only Android's own location interface.

- The Step 2 build held 1,076 classes of Google's Play services library. The new build holds none.
- It listens to the GPS once a second. Where the phone has Android's own combined provider, it uses that only while no GPS fix younger than 5 seconds has arrived.
- On your phone, Android's own location log showed the app registered with the GPS directly, three fixes about a second apart, and the app no longer listening once it left the screen. The lines are in `docs/evidence/step3/location/phone-location-log.txt`.
- One visible change: switching Location off while the app is tracking now shows "Location is switched off" at once and removes the marker. Before, it left a gray marker and the old card.

## What the independent review found

A reviewer with no part in the work read the code and the evidence, twice. Its first verdict was "not ready to report". It found no blocking fault in the code. What blocked the report was that the checks had not yet been shown on the final build, that two documents were out of date, and that there was no report. Its second pass found five wrong statements in my draft of this report, which are corrected here.

It checked the rules and found them kept. No data file is in git. No private owner's name is in any text file, log or commit message. The staged files hold no parcel data. Neither build holds a closed library. It opened about 20 of the roughly 290 screenshots of Steps 2 and 3 and each read OWNER NAME. The rest rest on the masked builds.

It found these, all now fixed unless the line says otherwise:

1. **A download started on Wi-Fi would have gone on over mobile data without asking.** Neither part of the downloader looked at whether the connection is charged by use. Now such a download waits for Wi-Fi and shows a "Use mobile data" button. Seen on the emulator: with Wi-Fi switched off in the middle of a 145 MB download, the open request was cut 56 thousandths of a second after Android reported the loss, the list read "Waiting for Wi-Fi", and nothing more was fetched. It went on by itself when Wi-Fi came back, and at once after a tap on "Use mobile data". A download left over from the old build also waited.
2. **Nothing inside the app refused parcel data from a download list.** Only my publishing script did. The app now drops any parcel entry in a list and never plans one.
3. **Every size estimate re-read the same file headers.** One test session made 316 redirected requests. Reads are now kept. Panning a 3 km frame four times takes 3 reads where it took 15.
4. **"Goes on with the screen off" was claimed on a 98 second test.** The lock that keeps the phone awake was taken for 30 minutes and never renewed. The lock is now renewed every 30 seconds while bytes arrive and dropped at once when they stop. It was seen held for 4 minutes 42 seconds without a break on the emulator. A long download on a real phone is still unproven.
5. **The publishing script did not re-check its files before an upload.** It now compares every file's size and checksum with the list first.
6. **One layer was unproven in airplane mode.** The first test run found no public land site inside its area. The second run shows one drawing and answering a tap.
7. **No guard stops a public build from carrying parcel data.** Both test builds carry the Macon County parcel file with real names, by design, which is why neither may be passed on. Any build made the usual way carries it too. A check that a release build carries none must exist before Step 5. Not fixed yet.
8. **GitHub's real behaviour is assumed.** See "What is not proven".

## Faults the tester found, all fixed

The first run on the emulator found nine faults. The second and third runs confirmed the fixes on the device, with one exception noted in the last line.

- The Android back button left the app from every panel. Back now steps back inside a panel, then closes it, and leaves the app only with nothing open.
- On the folded screen the Name field was hidden, fully so with the keyboard up.
- A county card said "On this phone" when only its map was downloaded, and adding imagery downloaded the map a second time. The card is now truthful per layer, and adding imagery fetches only imagery.
- Every public land copy of an area in open farmland failed the `pmtiles verify` check. The file said it went to zoom 14 when its own tiles stopped at 13. The app drew it correctly, but the file was not valid.
- The Aerial view outside a downloaded area showed gray ground with no explanation.
- No screen said that property lines are not a download.
- Android's notification question came with no word from the app first. Sizes labelled MB were counted in units of 1,048,576 bytes.
- The Sources screen grew one line per download. It now says, for example, "Macon County, in 3 downloads".
- An area across both counties was named after one.
- "Bigger area" grew by uneven amounts. **Not fully fixed:** on the final build, seven taps gave six doublings and one smaller step (1.6 km to 2.5 km).

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
- One tap in seven on "Bigger area" is a smaller step than a doubling.
- On the Sources screen the base map's source and license block appears twice, once for the overview map and once for the county files, because their data dates differ.
- A downloaded area's outline shows only while the downloads panel is open, and has no entry in the Layers legend.
- On the folded screen the Offline maps panel covers the position card, as the other panels do.
- Adding imagery to a county already on the phone makes a second entry in the list for that county.
- A download cannot be renamed after it starts.
- A download that waits for Wi-Fi keeps its notification showing. Android would not let the app restart the download from the background otherwise. The waiting time counts toward Android's limit of six hours a day.
- If a finished download's own record is damaged, the list calls it "Unreadable download" and "Cannot be used", although its map still draws. The words need softening.
- On mobile data, two small things are fetched without asking: the list of maps when "Offline maps" opens (about 10 KB), and the index reads behind each size shown in the area picker. The download itself always asks.
- "Waiting for Wi-Fi" is also what the app says on a Wi-Fi that the phone marks as charged by use.
- The app took about 8 seconds from launch to a drawn map on the emulator.
- From Step 2, still open: Champaign County has no property lines. Nobody has walked across a known property line in Macon County with the app.

## Questions for you

1. **May Step 3 go on GitHub?** It is 31 commits with 202 new image files. As in Step 2, some of the screenshots show Macon County parcel lines and parcel IDs, with owner names masked. I have not counted how many. The evidence text also names a few parcels by their ID. Your earlier yes named the Step 2 screenshots. If you say no, I must rewrite the local history to take the images out before pushing the code, because they are already in commits.
2. **May I publish the map archives as GitHub release files?** Six files, 383 MB, no parcel data. Things to know before you answer:
   - It depends on question 1. The app finds its maps through a small list file in the repository, so nothing switches on until I can push.
   - A published file cannot be taken back once people have fetched it. A release's files are never changed; new data goes out as a new release.
   - The base map and public land files go out under the Open Database License with their credits.
   - GitHub, and the storage host it hands downloads to, see the phone's network address and which parts of which file were read. For a picked area that shows roughly where the area is. For a whole county it shows only the county.
   - For the two imagery files only: the imagery is the USDA's and is public domain, but I fetched it through Microsoft's Planetary Computer. You accepted that service's own terms on 2026-11-17. Microsoft's general terms, which I have read only through a summary, say "Unless otherwise specified, the Services are for your personal and non-commercial use." The page is https://www.microsoft.com/en-us/legal/terms-of-use. My reading is that the sentence is about using Microsoft's service, not about what may be done with public domain imagery fetched from it. I am not a lawyer and I have not read the full page, so please read it yourself.
   - You can say yes to the base map and public land files now and decide on imagery later. The publishing script can stage just those four.
   - I will treat the first release as a test of GitHub's real servers before pointing the app at it.
3. **How should property lines reach a phone that is not yours?** Today they travel only inside a build. A public release must either carry them, or offer them as a download, or go without. Each needs the counties' written word. In the Step 2 report this was question 2, "May the Macon County parcel file be published on GitHub for the app to download?", and it is still open.
4. **Champaign County.** The county's GIS consortium (ccgisc@co.champaign.il.us, 217-819-3555) hands out parcel data by a data request or a yearly subscription, both with a signed license agreement. Its parcel service needs a login, and I did not go around it. The plan: you ask the consortium for the parcel layer as a file, with outline, parcel ID, acreage and owner name, and for written permission to distribute it inside a free public app. You sign its agreement and pay any fee, which are yours to decide. You put the file in this folder. My part then takes about two hours. I gave you a draft email in our conversation on 2026-11-17 and can put it in your Gmail drafts.

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
