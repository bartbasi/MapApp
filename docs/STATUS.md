# Status

Last updated: 2026-11-17, start of Step 2.

## Where the project stands

**Step 1 (map core and base data) is finished and the owner has answered it.** His answers are in DECISIONS D25 and D26. The frame rate on his Galaxy Z Fold 5 is about 120 frames per second, folded and unfolded (`docs/evidence/step1/phone/README.md`).

**Step 2 is under way, and it is not the Step 2 of the brief.** The owner said the app's first job is to show the phone's position against the property lines (D26). So Step 2 is now "Position and property lines", and offline downloads moved to Step 3. See `docs/STEP_PLAN.md`.

**Both counties allow a stored copy of their parcel data**, by the owner's word (D25). Parcels are built as offline archives. They are never committed and never hosted until he says so.

## What exists

- `pipeline/`: scripts that build one layer for one county per run, in WSL. Layers so far: `basemap`, `aerial`, `publicland`. The archive contract is in `pipeline/README.md`.
- `data/build/<county-id>/`: the built archives for `il-champaign` and `il-macon`. Not in git. Rebuild with `wsl -d Ubuntu -- bash pipeline/build.sh <layer> <county-id>`. The aerial build takes 15 to 30 minutes per county from the image cache in `data/cache/naip/`.
- `app/`: the web app and the Android project. `npm run check` and `npm test` pass.
- `build/step1-debug.apk`: the Step 1 test build. It is installed on the owner's phone.
- Evidence: `docs/evidence/step1/`.

## How to build and run

- Browser: in `app/`, set `MAPAPP_ARCHIVES=../data/build` and run `npx vite`. In a development build, `window.__mapapp.map` is the map.
- Android: in `app/`, `npm run android:sync`, then in `app/android/` run `gradlew assembleDebug` with `JAVA_HOME` set to `.tools/jdk-21.0.13+9`. Then `gradlew --stop`.
- Never run the emulator, Gradle and a pipeline job at the same time on this laptop.
- The owner's phone, when connected by USB, shows in `adb devices` as model `SM_F946U1`. It has two displays, so a screenshot needs `-d <display id>`. Taps can be sent with `adb shell input tap`.

## Waiting on the owner

1. **Whether the parcel archives may be published on GitHub** for the app to download, or must stay inside the app build. Needed in Step 3. Until he says yes in plain words, no parcel file goes to any public host.
2. Any condition a county put on its grant: a required credit, a limit on passing the data on, or a set way to receive the data. He should keep each county's reply.
3. Whether to ask the Illinois State Geological Survey for the leaf-off imagery, and the Illinois Department of Natural Resources for its hunting table.
4. A check of the position marker outdoors on his phone, once the Step 2 build exists.

## Lesson from Step 1

Read a service's terms before the first request to it, not only the license of the data it serves. A free service with no sign-up can still say that use is acceptance. Record the terms in `docs/DATA_SOURCES.md` before the pipeline touches the service, and ask the owner if use means acceptance.

## Known defects and open risks

- **A phone's GPS and a county's parcel lines are both inexact.** The app must say so wherever it shows the position against a line (D26).
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
