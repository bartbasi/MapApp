# Status

Last updated: 2026-11-17, end of Step 3, waiting for the owner.

## Where the project stands

**Step 3 (offline downloads) is built, tested on the emulator twice, and reviewed.** The report is `docs/reports/step-3.md`. The design is D33. Its three checks pass on the emulator. Nothing in its downloads has run on a real phone.

**Step 3 is not pushed.** `main` is ahead of `origin/main` (5c706d9, the end of Step 2). The push waits for the owner's word on the new screenshots, which show Macon County parcel lines and IDs with owners masked (report question 1). His yes on 2026-11-17 named the Step 2 screenshots.

**Nothing is published as a release file.** `pipeline/publish.py upload` has never been run. It needs the owner's yes and `--yes-publish` (report question 2). The catalog the app reads by default, `catalog/catalog.json` on GitHub, does not exist yet, so a default build can download nothing.

**The steps are not the brief's order.** Step 2 was position and property lines (D26). Step 3 was offline downloads. See `docs/STEP_PLAN.md`.

**The location plugin was replaced** (D31, approved 2026-11-17). No closed library is left in the build. The owner checked it outdoors on his phone: the dot was "spot on", accuracy 1 m, a few seconds to the first fix. Nobody has walked across a known property line in Macon County.

**Macon County has property lines. Champaign County has none.** The Champaign County consortium's service needs a token and was not read. The owner wants Champaign County next. He has a plan and a draft email to the consortium (in the conversation of 2026-11-17, and described in the Step 3 report, question 4). The build takes about two hours once a file with outline, parcel ID, acreage and owner arrives. See `docs/research/county-parcel-terms.md`.

**Property lines are not a download.** A parcel archive reaches a phone only inside a build. The app refuses any parcel entry in a catalog (`app/src/downloads/catalog.ts`). No check yet stops a release build from carrying parcel data: that check must exist before Step 5.

## What exists

- `pipeline/`: one layer for one county per run, in WSL. Layers `basemap`, `aerial`, `publicland`, `parcels`, and the overview map (`layers/overview.sh`). `publish.py` stages archives and writes the catalog.
- `data/build/<county-id>/`: the built archives, and `data/build/overview/`. Not in git.
- `data/publish/data-2026-11-17-test/`: the six archives staged for the test server, catalog base `http://10.0.2.2:8765/dl/` (the emulator). `data/publish/phone-test/`: the same with base `http://localhost:8765/dl/` (a phone on the cable).
- `app/src/downloads/`: the extract planner, the download manager, the contract (`contract.ts`). `app/src/ui/downloads/`: the screens. `app/android/.../downloads/`: the native downloader and its foreground service. `app/android/.../location/`: the location plugin.
- `npm run check` passes. Vitest passes with 602 tests. JUnit passes with 73.
- `build/step3-debug.apk`: real owner names, for the owner's phone, catalog at `http://localhost:8765/catalog.json`. `build/step3-masked-debug.apk`: masked, with the download test hook, catalog at `http://10.0.2.2:8765/catalog.json`. Both carry only the overview map and the Macon County parcel archive.
- Evidence: `docs/evidence/step3/` (`location`, `downloader`, `screens`, `emulator`, `review-fixes`).

## How to build and run

- Browser: in `app/`, `MAPAPP_ARCHIVES=../data/dev-step3 VITE_MAPAPP_CATALOG_URL=http://10.0.2.2:8765/catalog.json npx vite`, with the test server running. Add `?maskOwners` to mask owners and `?fakeDownloads` for the stand-in service that shows every state.
- Test server: `node app/scripts/release-test-server.mjs data/publish/data-2026-11-17-test --port 8765` (read its header for `--kbps`, `--expire`, `--drop-every`).
- Android: in `app/`, set `VITE_MAPAPP_CATALOG_URL` and, for a masked build, `VITE_MAPAPP_MASK_OWNERS=1`, then `npm run android:sync`. In `app/android/`, `gradlew assembleDebug` with `JAVA_HOME` at `.tools/jdk-21.0.13+9`, then `gradlew --stop`. Delete `app/android/app/build/outputs/apk` first if the staged archives changed, or the APK keeps dead space. `node scripts/stage-archives.mjs --all` bundles every archive as Step 2 did.
- **A phone on the cable can download from this laptop:** start the test server on `data/publish/phone-test`, run `adb -s <phone> reverse tcp:8765 tcp:8765`, and use `build/step3-debug.apk`.
- **Take every kept screenshot from a masked build.** Owner names of private people must not be in the repository.
- **Check the emulator's airplane mode at the start of a session** (`adb shell settings get global airplane_mode_on`). The emulator reports airplane mode on a few seconds before the network is really gone.
- The owner's phone is serial R3CWA0Q2JQP. Agents pass the emulator's serial on every adb command and never touch the phone.

## Waiting on the owner

1. **Install and try Step 3 on his phone** through the cable (above). The build is ready; the phone was not attached when it was finished.
2. **May Step 3 be pushed,** screenshots included (report question 1).
3. **May the six map archives be published** as release files (report question 2). He has been shown the sentence from Microsoft's general terms about personal and non-commercial use, which bears on the two imagery files only. After a yes: stage under a real tag, upload, verify, treat the first release as a test of GitHub's real behaviour, and only then commit `catalog/catalog.json`.
4. **How property lines reach a phone that is not his** (report question 3; Step 2's question 2).
5. **Champaign County's parcel data:** a file or a county-issued login, and the grant in writing.
6. From Step 2: any condition a county put on its grant, the leaf-off imagery and hunting table requests, and whether 3 m is the right allowance (D28).

## Lesson from Step 1

Read a service's terms before the first request to it, not only the license of the data it serves. A free service with no sign-up can still say that use is acceptance. Record the terms in `docs/DATA_SOURCES.md` before the pipeline touches the service, and ask the owner if use means acceptance.

## Known defects and open risks

From Step 3 (the full list is in the Step 3 report):

- Nothing in the downloads has run on a real phone: the background service, a long download with the screen off, a real mobile network, gesture navigation, the keyboard on the cover screen.
- GitHub's real release files and redirect are untested.
- No guard stops a release build from carrying parcel data.
- A download waiting for Wi-Fi keeps its notification, and the waiting counts toward Android's six hours a day for this kind of service.
- The overview map has no minor roads. Outlines of downloads show only while the downloads panel is open.

From Step 2:

- **A phone's GPS and a county's parcel lines are both inexact.** The readout shows the GPS accuracy and says "on or near a property line" when the line is within the accuracy plus 3 m (D28). The 3 m is a judgement.
- **Step 2 on a real phone:** the owner checked the marker outdoors once (spot on, 1 m accuracy). Real GPS under trees, and a walk across a known property line, are still open.
- **The Macon County lines sit about 0.5 m east of the GPS frame** (D29). Not corrected.
- **On the folded screen an open parcel panel covers the readout card.** The marker and the striped line still show.
- **After "My position" is switched off and on, the marker takes 3 to 4 s to return.**
- **A stack of 101 parcels on one outline was not seen on screen**; 14 was. "Acreage not listed" is shown on Android only in the tap panel screenshot `t8_noacre_tap.png`.
- **Within 25 m inside the county outline, a place in no parcel reads "No property lines for this place yet"** (D32). Cautious, and wrong for a Macon County road on the line.
- A position's age is now counted from the fix's own time on Android (fixed with the new location plugin). The browser source still counts from arrival.
- **With accuracy unknown the poor-fix title still says "GPS is too weak to place you."**
- **`real-archive.test.ts` logs one side mismatch** between zoom 15 and zoom 16 at a point where two lines are within 0.05 m of the same distance. Not asserted.
- **The tapped parcel and a tapped public land site share one yellow outline.**
- **There are two distance formatters**, `position/messages.ts` (rounded, for the accuracy) and `parcels/format.ts` (exact, for the line). They give different text for the same distance.
- **Two harmless log lines on Android:** "Error injecting safe area CSS" at start, and the location plugin's "Location services are not enabled" when location is off.
- **The location plugin uses Google's fused location service when there is a network**, and the GPS provider directly when there is none. The app sends nothing.
- **Some agents' commits carry "Claude Opus 5.5" as co-author**, the model that wrote them. Left as is.
- **Aerial imagery is two years joined.** About a quarter of Champaign County and half of Macon County is 2023 imagery. The owner has seen it and chose to leave it.
- **Aerial imagery is at half detail** (1.2 m). Full detail needs about 50 GB of reading or the MrSID decoder.
- **Closed sites.** PAD-US lists state nature preserves as closed even where people may walk in. The app shows "do not enter or hunt" for every closed record, ahead of the manager's own note. Seven such records are in or at the two counties.
- **Poor source records:** four "Unnamed Property" records, one "City Park" record that covers several parks, seven Champaign County parks with no manager.
- **A site's credit is matched by name.** `sourcesForSite` in `app/src/map/public-land.ts` finds a site's dataset by a word in the source's name. Give each metadata source an id equal to the tile's `source` value when the next source is added.
- **A site's panel opens 500 ms after the tap**, to tell a tap from a double tap. The owner used the build and did not object.
- **The near-miss tap lookup and the double tap cancel have no unit test.** On a touch screen the engine swallows the second tap of a double tap, so the app cancels a waiting tap when a zoom starts (`map-view.ts`).
- **A selected site can sit under the base view switch** on the folded screen.
- **The "Frame test running" message covers the credit line** while the test runs.
- **Parking aisles are drawn as roads.** Creeks appear only from zoom 13. No night mode.
- **The launcher icon and start screen are the framework's stock art.** The app needs its own before release.
- **`app/scripts/make-standin-aerial.py` and `data/fixtures/aerial-standin`** were for design work before real imagery existed. They can go.
- **The links to hunting rules were not tested.**
- **No archive over 2 GB has been tested.** The largest is 215 MB.
- **GitHub release hosting is only lightly tested.** Checked at the start of Step 3.
- **LANDFIRE license not confirmed.** The oak hint is blocked until it is.
- **The Illinois 2025 leaf-off imagery** has no complete download route.
- **Backup rules.** The app has `allowBackup="false"` until Step 4 sets its backup rules deliberately (D9).
- **The laptop runs out of memory with the emulator open.** See CLAUDE.md.
- Two stray empty folders in the project root, `BASI\PADX` and `C:SERSBART`, are left for the owner to delete.
