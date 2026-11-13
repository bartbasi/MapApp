# Step plan for Phase 1

Each step ends with its checks run, a review by the step-reviewer agent, a report in `docs/reports/`, and (from Step 1 on) an installable APK in `build/`. Work stops for the owner's review at the end of each step and nowhere else.

The checks are copied from the brief. They are the definition of done.

Who does what: the lead plans, integrates, makes data and license decisions and writes small or central code. The data-engineer agent builds one layer's pipeline per task. The app-developer agent builds app modules. The ux-designer agent builds styles, icons and layouts. The qa-tester agent runs the checks. The step-reviewer agent reviews the finished step.

---

## Step 0. Survey and decisions (done 2026-11-12)

See `docs/reports/step-0.md`.

## Step 1. Map core and base data

Goal: an app that shows the three base views and the public land layer for both counties.

1. Lead: create the project skeleton (`app/`, `android/`, `pipeline/`), the archive reader interface with its Android and browser implementations (DECISIONS D5), and the build commands. Remove the Step 0 test app.
2. Lead: install GDAL and tippecanoe in WSL Ubuntu. Write the county list and the shared pipeline helpers.
3. data-engineer, three tasks in a row, not at once (memory): the base map archive from the Protomaps build, the NAIP aerial archive to zoom 16, and the public land archive from PAD-US with the forest preserve corrections.
4. ux-designer: the original map style for the map view, the aerial view and the hybrid view, the public land colors by managing body, and the legend. Fonts and icons bundled for offline use.
5. app-developer: the map screen, the base view switch, the public land tap panel (site name, manager, hunting note with its source), the layer legend, and the folded and unfolded layouts.
6. qa-tester: run the checks.
7. **The frame rate on the Galaxy Z Fold 5 is measured in this step.** If it is poor, DECISIONS D2 is revisited before anything else is built.

Checks:

- Public land colors match the source data along at least three boundaries inspected by hand.
- Every layer present names its source and license.
- Panning and zooming stay smooth on the Z Fold 5, with the measured frame rate in the report.
- Screenshots of all three base views, folded and unfolded.

In Step 1 the map data is loaded onto the device from the development machine. Downloads inside the app come in Step 2.

## Step 2. Offline downloads and GPS position

Goal: the user downloads an area or a whole county, and sees their position with no network.

1. Owner approval needed first: the first push to the public repository, because the archives are hosted as GitHub release files (DECISIONS D15).
2. app-developer: the native download plugin (pause, resume, survive an app kill), the area and detail picker with the size shown before starting, the one-tap county downloads, the download list with delete.
3. app-developer: the position marker from device GPS, and the true network state from the shell (DECISIONS D12).
4. qa-tester: run the checks.

Checks:

- In airplane mode, a downloaded area draws every bundled layer.
- The position marker follows a replayed GPS route.
- Killing the app in the middle of a download and reopening it resumes the download without corrupting the area.
- A downloaded area includes every layer the user had turned on.

## Step 3. Parcels and owners

Goal: parcel outlines and owner details for every county with an allowed source.

1. Lead: the `ParcelSource` interface and the Macon County live lookup (DECISIONS D8), with the field allowlist enforced in one place and tested.
2. app-developer: outlines at high zoom, the tap panel (owner, acreage, parcel ID, county, data date), the "not a legal survey" statement, saved results, and the "needs a connection" state.
3. Champaign County: built as bundled data if permission has arrived, as live lookup if the owner so decides, or left as "not available yet".
4. qa-tester: run the checks.

Checks:

- Twenty parcels picked at random in each county with a parcel source match that county's own records for owner name and outline.
- In airplane mode, a live lookup county shows its "needs a connection" message and its saved results. A bundled county returns the owner.
- No request made by the app contains a mailing address field. This is checked from a network log.

## Step 4. Scouting and tracking

Goal: waypoints, the track recorder, wind, export and import.

1. Lead: the data model and the storage interface (DECISIONS D9).
2. app-developer: waypoints with types, notes, photo and color. Edit, delete, export and import as GPX and GeoJSON.
3. app-developer: the native foreground location service that writes points itself (DECISIONS D10), with start, pause and stop, and the saved track view with distance and time.
4. app-developer: wind for a waypoint from the National Weather Service, the good and poor wind directions for a stand, the hourly rating, and the saved forecast with its age.
5. qa-tester: run the checks.

Checks:

- A two-hour replayed route with the screen off produces one continuous track with no gaps.
- A GPX file exported from the app imports back with every waypoint and track intact.
- Wind ratings are covered by unit tests, including directions that wrap past north.

## Step 5. Remaining layers, About, attribution, release

Goal: a release build.

1. data-engineer: the crop type archive, and the woodland archive with the "possible oak-hickory (modeled)" hint.
2. app-developer: the layer switches with legend and data date, the hunting unit display (DECISIONS D11), the About screen (source code link, feedback, the donation link with wording that donations are appreciated and never expected), and the attribution screen built from the archives' metadata files.
3. Lead: the README and the signed release build. The package ID and the app name are confirmed with the owner first.
4. qa-tester: every check from every step, on the release build.

Checks:

- Every layer names its source and license on the attribution screen.
- Panning and zooming stay smooth on the Z Fold 5 with all layers on, with the measured frame rate in the report.
- All earlier checks still pass on the release build.

---

## After Phase 1, for design awareness only

Contour lines (first), more counties and states, 3D terrain, an iPhone version, a desktop version, Android Auto, Wear OS, and trail camera and rangefinder connections. None is built in Phase 1. The decisions that keep them open are D2, D3, D4 and D14.
