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

## Step 2. Position and property lines (the core function)

The owner set this order on 2026-11-17 (DECISIONS D26). Both counties now allow a stored copy of their parcel data (D25), so parcels are built as offline data.

Goal: with no network, the hunter sees where the phone is against the property lines, and who owns the land on each side.

1. Lead: the first push to the public repository (approved, D25).
2. data-engineer: the parcel archive for each county. It holds the outline, parcel ID, acreage and owner name and nothing else. It is built on this laptop and is never committed or hosted.
3. app-developer: the position marker from the phone's GPS. A dot, an accuracy circle, a heading, a button that centers the map on the phone, and a follow mode.
4. app-developer: the parcel layer. Outlines readable in all three base views, the tap panel (owner, acreage, parcel ID, county, data date) and the "not a legal survey" statement. All parcel access goes through the `ParcelSource` interface (D8).
5. app-developer: the position readout. It names the parcel the phone is in and gives the distance and direction to the nearest property line, with the GPS accuracy beside it.
6. Lead: a test build with every archive inside it, parcels included.
7. qa-tester: run the checks.

Checks:

- Twenty parcels picked at random in each county match that county's own records for owner name and outline. (From the brief.)
- The position marker follows a replayed GPS route. (From the brief.)
- In airplane mode, the parcel outlines draw and a parcel tap returns the owner. (From the brief, for a county with stored data.)
- The parcel archives hold no mailing address, site address or phone number, and the pipeline requests none. This is checked from the archive's contents and from the pipeline's request log. (The brief's check on mailing address fields, applied to stored data.)
- On a replayed route that crosses a property line, the readout names the right parcel on each side, and its distance to the line agrees with a measurement made from the county's own outline to within 2 m. (New, for D26.)
- The owner checks the marker outdoors on his phone against a place he knows.

The brief's "needs a connection" message and saved results belong to a live lookup county. Neither county is one now, so those two parts are not built in this step.

## Step 3. Offline downloads

Goal: the user downloads an area or a whole county, and the app no longer needs its map data built in.

1. Lead: publish the base map, imagery and public land archives as GitHub release files (D15), and check range reads and the redirect.
2. Owner decision needed: whether the parcel archives may be published the same way. Until he says yes they are not hosted, and a parcel archive reaches a phone only inside a build.
3. app-developer: the native download plugin (pause, resume, survive an app kill), the area and detail picker with the size shown before starting, the one-tap county downloads, the download list with delete.
4. app-developer: the true network state from the shell (D12).
5. qa-tester: run the checks.

Checks:

- In airplane mode, a downloaded area draws every bundled layer.
- Killing the app in the middle of a download and reopening it resumes the download without corrupting the area.
- A downloaded area includes every layer the user had turned on.

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
