# Status

Last updated: 2026-11-12, start of Step 1.

## Where the project stands

**Step 0 is finished and the owner has answered it.** His answers are in DECISIONS D22.

**Step 1 (map core and base data) is in progress.** The plan is in `docs/STEP_PLAN.md`.

## Done

- Machine surveyed. JDK 21 and the PMTiles tool installed in `.tools/`. Android 16 emulator image installed and the foldable virtual device `mapapp_fold` created.
- County parcel terms read for both counties. Macon County: live lookup allowed by default. Champaign County: blocked. See DECISIONS D8 and `docs/research/county-parcel-terms.md`.
- All data sources evaluated. See `docs/DATA_SOURCES.md`.
- Map engine and framework chosen and proven on the emulator: MapLibre GL JS 6 in a Capacitor 8 shell. See DECISIONS D2, D3, D5 and `docs/research/engine-and-hosting-checks.md`.
- Agent team written in `.claude/agents/`. A new session is needed before they load.
- License and notice files added, copied from WoodLogic and adapted.
- Local git repository created. Nothing pushed.
- The step-reviewer's findings on the first draft of the report were all corrected.

## Waiting on the owner

1. What each county actually granted for its parcel data: live lookup only, or a copy that may be bundled in the app. Until he says, both counties are live lookup only (D22).
2. A plain yes or no on the first push to a public GitHub repository, and which files go public. Needed before Step 2.
3. The frame rate on his Galaxy Z Fold 5. He said he would test on 2026-11-13.
4. Whether to ask the Illinois State Geological Survey for the leaf-off imagery, and the Illinois Department of Natural Resources for its hunting table.

## First actions in Step 1

1. Read the owner's answers and update this file and `docs/DECISIONS.md`.
2. Install GDAL and tippecanoe in WSL Ubuntu: `wsl -d Ubuntu -u root -- apt-get install -y gdal-bin python3-gdal tippecanoe`.
3. Create the project skeleton (`app/`, `android/`, `pipeline/`). Carry over from the test app only the archive reader design (D5). Then delete `spikes/step0-map-proof`.
4. Follow `docs/STEP_PLAN.md`, Step 1.

## Known defects and open risks

- **The frame rate on the real phone is unmeasured.** The emulator gave 27 to 41 frames per second under heavy memory pressure, which says little about the phone. The frame test covers the vector base map only, with no aerial imagery or overlays.
- **Tile loading after fast movement.** On the emulator, tiles at zoom 15.5 took several seconds to appear after a fast camera move. Measure this on the phone in Step 1.
- **No archive over 2 GB has been tested.** The design in D5 removes the limit, but no file that large exists yet.
- **GitHub release hosting is only lightly tested.** One byte range request worked. Many in a row, and the short-lived redirect address, are checked at the start of Step 2.
- **LANDFIRE license not confirmed.** The oak hint is blocked until it is.
- **NAIP county mosaics** are on a USDA Box site with no stable direct link. The download may need one manual step by the owner. The image format inside the zip is not confirmed.
- **The Illinois 2025 leaf-off imagery** has no complete download route. Macon County's service allows batch downloads. Champaign County's does not.
- **The test app** has Capacitor template leftovers, including `allowBackup="true"` in its manifest. It is deleted in Step 1. The product sets its backup rules deliberately (D9).
- **The laptop runs out of memory with the emulator open.** The emulator's own interface stalled in every session. See CLAUDE.md for the rules that keep it working.
- `MapApp-kickoff-prompt.md` is the brief. It is kept in the repository because the step-reviewer agent reads it. Whether it goes public is question 4.
