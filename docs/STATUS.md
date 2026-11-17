# Status

Last updated: 2026-11-17, end of Step 1, frame test on the phone half done.

## Where the project stands

**Step 0 is finished and the owner has answered it.** His answers are in DECISIONS D22.

**Step 1 (map core and base data) is built, tested on the emulator, reviewed and reported.** The report is `docs/reports/step-1.md`. The work stops here for the owner's review. Do not start Step 2 until he answers.

## What exists

- `pipeline/`: scripts that build one layer for one county per run, in WSL. Three layers: `basemap`, `aerial`, `publicland`. The archive contract is in `pipeline/README.md`.
- `data/build/<county-id>/`: the built archives for `il-champaign` and `il-macon`. Not in git. Rebuild with `wsl -d Ubuntu -- bash pipeline/build.sh <layer> <county-id>`. The aerial build takes 15 to 30 minutes per county from the image cache in `data/cache/naip/`.
- `app/`: the web app and the Android project. `npm run check` and `npm test` pass (93 tests).
- `build/step1-debug.apk`: the test build for the owner, with both counties' archives inside it.
- Evidence: `docs/evidence/step1/`. The tester's report is `device/qa-report.md`. The final pass on the delivered build is `final/qa-final.md`, with the last double tap recheck in `final2/`. The boundary check is in `boundaries/`.

## How to build and run

- Browser: in `app/`, set `MAPAPP_ARCHIVES=../data/build` and run `npx vite`. In a development build, `window.__mapapp.map` is the map.
- Android: in `app/`, `npm run android:sync`, then in `app/android/` run `gradlew assembleDebug` with `JAVA_HOME` set to `.tools/jdk-21.0.13+9`. Then `gradlew --stop`.
- Never run the emulator, Gradle and a pipeline job at the same time on this laptop.

## Waiting on the owner

1. The frame rate on his Galaxy Z Fold 5 with the phone **unfolded**. Folded is done: 119.9 frames per second in the Map view and 119.7 in the Hybrid view, with no slow frames (`docs/evidence/step1/phone/README.md`). The test build is installed on the phone. When it is connected and unfolded, run the frame test over adb as that file describes. If the unfolded Map view averages well under 30 frames per second, DECISIONS D2 (the map engine) is revisited before anything else.
2. **Whether he accepts the terms of Microsoft's Planetary Computer**, where the aerial imagery was fetched from. They were read only after the download, and using the service counts as accepting them (`docs/DATA_SOURCES.md`, "The terms of the service the imagery was fetched from"). **No aerial archive may be published or hosted until he decides.** If he says no, delete `data/build/*/aerial.*`, `data/cache/naip/` and the test build, and build the imagery another way.
3. What to do about the patchwork of imagery years and flight dates, worst in Champaign County.
4. Whether the eight hunting notes in `app/src/content/hunting-notes.json` are right.
5. What each county actually granted for its parcel data: live lookup only, or a copy that may be bundled in the app. Until he says, both counties are live lookup only (D22).
6. A plain yes or no on the first push to a public GitHub repository, and which files go public. Needed before Step 2.
7. Whether to ask the Illinois State Geological Survey for the leaf-off imagery, and the Illinois Department of Natural Resources for its hunting table.

## Lesson from Step 1

Read a service's terms before the first request to it, not only the license of the data it serves. A free service with no sign-up can still say that use is acceptance. Record the terms in `docs/DATA_SOURCES.md` before the pipeline touches the service, and ask the owner if use means acceptance.

## First actions in Step 2

1. Read the owner's answers and update this file and `docs/DECISIONS.md`.
2. If the frame rate is poor, stop and revisit D2.
3. Follow `docs/STEP_PLAN.md`, Step 2. The first push needs the owner's yes.

## Known defects and open risks

- **The frame rate on the real phone is measured folded only** (about 120 frames per second). Unfolded is still to run. The emulator gave 15 to 24 frames per second in the first Step 1 run, 55.8 in one later run after a fresh emulator start, and 27 to 41 in Step 0. The emulator number moves with the state of the laptop and settles nothing.
- **Aerial imagery is two years joined.** About a quarter of Champaign County and half of Macon County is 2023 imagery, because the cloud copy lacks the 2025 images there. The joins are obvious in Champaign County and visible in Macon County when zoomed out.
- **Aerial imagery is at half detail** (1.2 m). Full detail needs about 50 GB of reading or the MrSID decoder.
- **Closed sites.** PAD-US lists state nature preserves as closed even where people may walk in. The app shows "do not enter or hunt" for every closed record, ahead of the manager's own note. Seven such records are in or at the two counties.
- **Poor source records:** four "Unnamed Property" records, one "City Park" record that covers several parks, seven Champaign County parks with no manager.
- **A site's credit is matched by name.** `sourcesForSite` in `app/src/map/public-land.ts` finds a site's dataset by a word in the source's name. A new county with its own local source needs a better link: give each metadata source an id equal to the tile's `source` value. Do this when the next source is added.
- **A site's panel opens 500 ms after the tap**, to tell a tap from a double tap. Revisit if it feels slow on the phone.
- **The near-miss tap lookup and the double tap cancel have no unit test.** Both were checked on the emulator only. On a touch screen the engine swallows the second tap of a double tap, so the app cancels a waiting tap when a zoom starts (`map-view.ts`).
- **A selected site can sit under the base view switch** on the folded screen.
- **Parking aisles are drawn as roads.** Creeks appear only from zoom 13. No night mode.
- **The launcher icon and start screen are the framework's stock art.** The app needs its own before release.
- **`app/scripts/make-standin-aerial.py` and `data/fixtures/aerial-standin`** were for design work before real imagery existed. They can go.
- **Two-finger zoom and rotate, and the links to hunting rules, were not tested** on the emulator.
- **Tile loading after fast movement** is still to be measured on the phone ("Tiles finished after stop" in the frame test).
- **No archive over 2 GB has been tested.** The largest is 215 MB.
- **GitHub release hosting is only lightly tested.** Checked at the start of Step 2.
- **LANDFIRE license not confirmed.** The oak hint is blocked until it is.
- **The Illinois 2025 leaf-off imagery** has no complete download route.
- **Backup rules.** The app has `allowBackup="false"` until Step 4 sets its backup rules deliberately (D9).
- **The laptop runs out of memory with the emulator open.** See CLAUDE.md.
- Two stray empty folders in the project root, `BASI\PADX` and `C:SERSBART`, are left for the owner to delete.
- `MapApp-kickoff-prompt.md` is the brief. Whether it goes public is the owner's decision.
