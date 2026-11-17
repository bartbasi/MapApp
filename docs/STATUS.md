# Status

Last updated: 2026-11-17, end of Step 2, waiting for the owner.

## Where the project stands

**Step 2 (position and property lines) is built, reviewed and tested on the emulator.** The report is `docs/reports/step-2.md`. One check is open: the owner checks the marker outdoors on his phone.

**Step 2 is not pushed.** `main` is ahead of `origin/main`. The push waits for the owner's answer on the screenshots that show county parcel lines (question 3 of the report). Nothing under `data/` is ever pushed.

**Step 2 is not the Step 2 of the brief.** The owner said the app's first job is to show the phone's position against the property lines (D26). Offline downloads moved to Step 3. See `docs/STEP_PLAN.md`.

**Macon County has property lines. Champaign County has none.** The Champaign County service answers "Token Required" and was not read. The app says "No property lines for this place yet" there. `pipeline/build.sh parcels il-champaign` stops with the reason.

**Both counties allow a stored copy of their parcel data**, by the owner's word (D25). No written grant is in the project. Parcel archives are never committed and never hosted until he says so by name.

## What exists

- `pipeline/`: scripts that build one layer for one county per run, in WSL. Layers: `basemap`, `aerial`, `publicland`, `parcels`. The archive contract is in `pipeline/README.md`. Parcel checks are in `pipeline/checks/parcels_*.py`.
- `data/build/<county-id>/`: the built archives. Not in git. `il-macon` has a parcel archive (57,096 records, data date 2026-10-28). Its `parcels.meta.json` carries the county outline as `coverage` (D32); `python3 -I pipeline/layers/parcels.py --update-meta <county>` adds it without asking the county again. `il-champaign` has none. Rebuild with `wsl -d Ubuntu -- bash pipeline/build.sh <layer> <county-id>`.
- `app/src/position/`: the GPS sources, the position store, heading and follow. `app/src/parcels/`: the parcel source, the nearest line, the readout rule and its words. `app/src/map/style/parcels.ts` and `position.ts`: the layers. `app/src/ui/PositionReadout.svelte` and `ParcelDetails.svelte`: the screens.
- `npm run check` passes and `npm test` passes with 327 tests. One of them reads the real Macon County archive and skips when it is absent.
- `build/step2-debug.apk`: the Step 2 test build with real owner names, for the owner's phone. `build/step2-masked-debug.apk`: the same with every owner shown as "OWNER NAME", for screenshots. Step 1's build is still on the owner's phone until he connects it.
- Evidence: `docs/evidence/step2/`.

## How to build and run

- Browser: in `app/`, set `MAPAPP_ARCHIVES=../data/build` and run `npx vite`. In a development build, `window.__mapapp` has the map, `position` (replay a walk) and `maskOwners(true)`. Add `?maskOwners` to the address to start masked.
- Android: in `app/`, `npm run android:sync`, then in `app/android/` run `gradlew assembleDebug` with `JAVA_HOME` set to `.tools/jdk-21.0.13+9`. Then `gradlew --stop`. For a masked build, set `VITE_MAPAPP_MASK_OWNERS=1` for the `android:sync` command.
- **Take every kept screenshot from a masked build.** Owner names of private people must not be in the repository.
- Emulator: send a position with `adb emu geo fix <longitude> <latitude>`. **Check airplane mode first** with `adb shell settings get global airplane_mode_on`. It was left on once and a whole session ran without a network. Turn it off with `adb shell cmd connectivity airplane-mode disable`, then `adb shell svc wifi enable`.
- Never run the emulator, Gradle and a pipeline job at the same time on this laptop.
- The owner's phone, when connected by USB, shows in `adb devices` as model `SM_F946U1`. It has two displays, so a screenshot needs `-d <display id>`. Taps can be sent with `adb shell input tap`.

## Waiting on the owner

1. **The outdoor check of the marker on his phone.** Install `build/step2-debug.apk` when the phone is connected. The steps are in the Step 2 report.
2. **How Champaign County will hand over its parcel data:** a file with outline, parcel ID, acreage and owner, or a login the county issues to him. And the grant in writing.
3. **Whether the Macon County parcel archive may be published on GitHub** for the app to download. Needed in Step 3. "Everything is approved" (2026-11-17) was not taken to cover this. He must say it by name.
4. **Whether the Step 2 screenshots may be pushed.** About 140 show Macon County parcel lines, parcel IDs and acreages, owners masked. If no, push the code without `docs/evidence/step2/` images (the history must then be rewritten before the push, because the images are already committed locally).
5. **Whether to replace the location plugin** with one of our own that links no Google library (D31).
6. Any condition a county put on its grant: a required credit, a limit on passing the data on, or a set way to receive the data.
7. Whether to ask the Illinois State Geological Survey for the leaf-off imagery, and the Illinois Department of Natural Resources for its hunting table.
8. Whether 3 m is the right allowance for error in the county's lines (D28).

## Lesson from Step 1

Read a service's terms before the first request to it, not only the license of the data it serves. A free service with no sign-up can still say that use is acceptance. Record the terms in `docs/DATA_SOURCES.md` before the pipeline touches the service, and ask the owner if use means acceptance.

## Known defects and open risks

- **A phone's GPS and a county's parcel lines are both inexact.** The readout shows the GPS accuracy and says "on or near a property line" when the line is within the accuracy plus 3 m (D28). The 3 m is a judgement.
- **Nothing in Step 2 has been seen on a real phone.** The emulator reports a perfect 5 m fix. Real GPS under trees is the open question.
- **The Macon County lines sit about 0.5 m east of the GPS frame** (D29). Not corrected.
- **On the folded screen an open parcel panel covers the readout card.** The marker and the striped line still show.
- **After "My position" is switched off and on, the marker takes 3 to 4 s to return.**
- **A stack of 101 parcels on one outline was not seen on screen**; 14 was. "Acreage not listed" is shown on Android only in the tap panel screenshot `t8_noacre_tap.png`.
- **Within 25 m inside the county outline, a place in no parcel reads "No property lines for this place yet"** (D32). Cautious, and wrong for a Macon County road on the line.
- **A position's age is counted from when it arrived, not from its own time stamp.** If a phone re-delivers an old position as new, the stale and 5 minute limits do not see it. The emulator re-sends its last fix every second, which is a GPS that is still reporting. Watch for this on the real phone.
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
