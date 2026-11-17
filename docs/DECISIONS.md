# Decisions

Each decision has a number, the date it was made, what was decided and why. A later change gets a new entry that names the one it replaces. All entries below were made in Step 0 on 2026-11-12.

Terms used in this file:

- **Web map core**: the map drawn by a JavaScript library inside a browser engine, as opposed to a map drawn by a native Android library.
- **Shell**: the thin native Android app that hosts the web app and gives it things a browser cannot do.
- **Tile archive**: one PMTiles file holding all the map tiles for one layer and one county.
- **Live lookup**: fetching parcel data from a county's own public map service at the moment the user views or taps it, with nothing fetched ahead of time.

---

## D1. License: GPL-3.0 with the Play, Inc. additional terms

MapApp uses the same license as WoodLogic: the GNU General Public License version 3, plus the section 7 additional terms in `NOTICE` (keep the author credit, mark modified versions, use your own name and icon). The text was copied from the local WoodLogic repository and adapted. Map data is not under the GPL. Each dataset keeps its own license, and `NOTICE` says so.

## D2. Map engine: MapLibre GL JS (a web map core)

The map is drawn by MapLibre GL JS 6 running in the Android system WebView.

Why:

- **The iPhone goal with no Mac.** A web map core runs in mobile Safari. The map and most of the app can be tested on the owner's iPhone from a web page, with no Mac and no App Store. A native map engine cannot be tested on iOS at all without a Mac.
- **One code base for every platform.** The same code serves Android, a later iPhone app, a later desktop app and a browser.
- **3D terrain later.** MapLibre GL JS already draws 3D terrain and hillshade from elevation tiles. That keeps the later 3D phase open.
- **Tile archives are first class.** The PMTiles library is written for this engine.

What was checked:

- The brief's statement about Flutter was confirmed. The `maplibre_gl` Flutter plugin lists Android, iOS and web only. The newer `maplibre` plugin reaches Windows and macOS by wrapping MapLibre GL JS in a web view. So a Flutter app would end up on the web map core on desktop anyway, with a second, different engine on phones.
- The choice was proven with a test app on the emulator. See D5 and `docs/reports/step-0.md`.

What was given up: a native engine would likely draw faster on weak phones. The frame rate on the real Galaxy Z Fold 5 is not measured yet. If it is poor, this decision is the one to revisit, and Step 1 is the place to do it, before features are built on it.

## D3. App framework: Capacitor 8 shell, TypeScript web app

- The shell is Capacitor 8 (MIT license). It is a standard Android project that hosts the web app in a WebView and lets the web app call native code through plugins.
- The web app is TypeScript, built with Vite, with Svelte 5 for screens and panels.
- Android-only abilities are written as small native plugins inside the Capacitor Android project. There are five: reading tile archives from storage (D5), downloading files with pause and resume, the foreground location service (D10), a true network state check (D12), and the weather request (D13).
- Every one of those sits behind a TypeScript interface with a browser implementation beside it, so the app also runs in a plain browser.

Why Capacitor and not Flutter with a web view: with the map in a web view, a Flutter app would have two user interface systems that must talk across a bridge. Putting the whole interface in the web app removes that seam, and the browser build for the iPhone comes for free.

Why Svelte: it compiles to small, fast code with little runtime, which suits a WebView on a phone. This is the least important choice here and is easy to change before Step 1 ends.

Toolchain facts: Capacitor 8 needs JDK 21, Node 22 or later, and Android SDK 36. The minimum Android version is 7.0 (API 24), which is Capacitor's own minimum. The owner has not been asked whether older phones matter. The versions checked are in `docs/research/engine-and-hosting-checks.md`. JDK 21 was installed inside the project at `.tools/`. Nothing system-wide was changed.

## D4. Map data format: PMTiles archives, one per layer per county

Every layer is built ahead of time into a PMTiles archive. Vector layers (base map, public land, crops, woodland) are vector tiles. Aerial imagery is raster tiles in WebP. There is no tile server. An archive is a single static file that can sit on any free file host or on the phone.

One archive per layer per county keeps downloads small, lets a county be added without touching the others, and lets a layer be rebuilt alone.

## D5. Reading archives on the phone: the shell serves byte ranges, with the range in the URL

The web app asks the shell for "bytes at offset O, length N of archive A" with a plain request to `https://localhost/_tiles/<archive>?o=<offset>&n=<length>`. The shell reads exactly those bytes from app storage.

Why not ordinary HTTP Range headers: this was found by testing. When a request carries a Range header, Android WebView applies the range itself to whatever stream the app returns, and it measures the stream with a 32-bit number. So returning the exact bytes fails for any offset above zero, and returning the whole file fails for archives over 2 GB. Capacitor's built-in file server has the same limit. Putting the range in the URL avoids both problems and has no size limit.

In a browser, the same archive is read from a web server with ordinary Range requests. Both paths sit behind one "archive reader" interface.

## D6. Base map: OpenStreetMap data in the Protomaps tile layout, with our own style

- Roads, water, woodland and place names come from OpenStreetMap.
- The tiles are cut from the public Protomaps daily build of the whole planet, using `pmtiles extract` with a county outline. Measured size for both counties, zoom 0 to 15: 16.7 MB.
- The tile layout (which layers and fields a tile holds) is the Protomaps one. Its code is BSD licensed and it asks for no extra on-map credit. The OpenMapTiles layout was rejected because it requires its own visible credit.
- The map style is written here from scratch. The test app used a stock Protomaps style, fonts and icons only to prove the engine. The stock style and icons are not in the repository or the product. One thing was kept: the glyph files of the Noto Sans font (SIL Open Font License 1.1), downloaded from the Protomaps assets repository, are bundled in `app/public/fonts/` with their license and credited on the Sources screen. The launcher icon and start screen are still the app framework's stock art until the app gets its own icon.
- **How this sits with the brief's rule against using another product's servers, layer names or data.** Protomaps is an open source mapping project, not a hunting map product. It publishes its planet build for reuse, the data in it is OpenStreetMap's, and its tile layout is BSD licensed. The pipeline downloads from its public build server once per build, on the development machine. The app never contacts it. The layer names inside the tiles are Protomaps' names. They are internal to the tile files and are not the layer names a user sees. This reading of the rule is the lead's, and it is put to the owner in the Step 0 report.
- Protomaps keeps about 60 days of builds. The pipeline keeps a copy of the build date it used, so a build can be repeated.
- If the Protomaps layout turns out to lack something a hunter needs (for example farm tracks or fence lines), the fallback is to build our own tiles from the Geofabrik Illinois extract (346 MB) with Planetiler. The pipeline step is written so that swap changes one script.
- US Census TIGER/Line supplies county boundaries, which are also the hunting units (D11). It is in the public domain.

## D7. Aerial imagery: NAIP 2025 by default, Illinois 2025 leaf-off imagery as the goal

- **Default aerial view: USDA NAIP 2025**, public domain, flown in summer with leaves on. The native detail is 0.6 m.
- **Changed in Step 1:** the county mosaics turned out to be in a proprietary format (MrSID) that the open source tools cannot read, so the layer is built from the cloud-hosted GeoTIFF copies of NAIP. Step 1 builds from their 1.2 m level, to zoom 16 with 512 pixel tiles, with NAIP 2023 filling the ground the 2025 copy lacks (southern Champaign County and eastern Macon County). Measured: 215 MB for Champaign County and 134 MB for Macon County. The join between the two years is plainly visible in Champaign County, which is an open point for the owner. **The cloud service's terms were read only after the download (2026-11-14). Using the service counts as accepting Microsoft's terms, which the owner had not been asked about. No aerial archive is published until he decides. See `docs/DATA_SOURCES.md`.** See `docs/DATA_SOURCES.md`, "NAIP delivery".
- **Better for hunters: the State of Illinois 2025 imagery**, 6 inch, flown with leaves off, stated as public domain in its metadata. Leaf-off imagery shows trails, creek bottoms and fence lines under the trees. The catch is delivery. No county download was found, and the state image service that covers most of Champaign County has downloads switched off. Getting it means asking the Illinois State Geological Survey for the two county image sets, which is an open question for the owner.
- Until that is answered, Step 1 builds the aerial view from NAIP. The leaf-off imagery becomes a second, optional aerial layer when a source is settled. Nothing else in the app depends on which one is used.

## D8. Parcels: one interface, live lookup for Macon County, nothing for Champaign County yet

All parcel access goes through one `ParcelSource` interface with two operations: outlines for a map area, and the details of the parcel at a point. Each county has its own implementation. A county can later switch to bundled offline data by swapping its implementation, with no change elsewhere.

**Macon County: live lookup, approved by default.**

- The county publishes its parcels as a public ArcGIS feature service with query access, the same service its own public parcel viewer uses. It holds 57,096 parcels and was last edited 2026-10-28.
- No terms of use or license is attached to the service, the map, the viewer or the county GIS page. The viewer's only statement is that the maps are based on assessment information and are not a legal survey. The county website's footer, on every page, reads "© 2010- Macon County, Illinois. All rights reserved."
- Nothing forbids an app from querying the service the way the county's own viewer does. So the live lookup is allowed by default. Silence is not permission to copy the data, and the footer reserves all rights. So nothing is fetched in bulk, bundled, hosted or committed. The app requests only the map area in view at high zoom, and the one parcel tapped.
- Saved results are the one place where the app keeps a copy: the record of a parcel the user tapped, on the user's own phone. The brief allows this. Macon County has given no permission for it and has not forbidden it. This is put to the owner in the Step 0 report. It can be switched off per county.
- The app requests only these fields: parcel ID, acreage and owner name. The service also holds mailing and site addresses. The app never requests them.
- The owner has asked the county for permission. If the county says no, the Macon implementation is switched off with one setting.
- Addresses, metadata and every request made to the service in Step 0 are recorded in `docs/research/county-parcel-terms.md`.

**Champaign County: no parcels until the owner decides.**

- The county's public parcel map sits behind a page where the user must accept terms before entering. Those terms (Champaign County GIS Consortium, last updated 2013-06-17) cover the website, its sub-domains and associated applications. They allow "personal, non-commercial transitory viewing only". They forbid copying the materials, any "public display (commercial or non-commercial)", and transferring or mirroring them. They state that copying, redistribution, use or publication of any portion of the website is prohibited.
- An app that queries that map service and shows the results is outside those terms, and saving tapped parcels on the phone is copying. So even the live lookup is not allowed.
- The consortium sells data under a signed license agreement. Prices are not posted. A search result reported agreement wording that forbids redistribution outside the licensee's organization without written permission. That wording was not read directly. Buying data would cost money and would be unlikely to allow the app to ship it.
- No openly licensed parcel dataset for Champaign County was found. The regional planning commission and City of Champaign open data portals were searched.
- The Champaign map service itself was not probed, because it is behind the terms page.
- Result: the Champaign implementation of `ParcelSource` reports "parcel data for Champaign County is not available yet" until the consortium grants permission or the owner decides otherwise.

**Saved results.** Parcels the user has tapped are kept on the phone with the date they were fetched, and shown when offline, as the brief describes. Outlines are held in memory for the session only.

## D9. User data: a native SQLite database in app storage

Waypoints, tracks, saved parcel results and saved forecasts live in a SQLite file in the app's private storage, reached through one storage interface.

Why not the WebView's own storage (IndexedDB or similar): a browser engine may clear its storage when the device is short of space. A hunter's marks must not be lost that way. A file in app storage is also something the native location service can write to while the web app is asleep.

The library that connects the web app to SQLite is chosen at the start of Step 4. The decision made now is where the data lives. The data model must not depend on a particular library.

Photos attached to waypoints are files in app storage, with the path in the database. Android backup settings are chosen in Step 4 so that the owner's data is not copied to a cloud without his choice.

## D10. Background tracking: a native foreground service that writes points itself

Track recording runs in a native Android foreground service with a visible notification. The service writes each GPS point to storage itself. It does not pass points to the web app, because Android pauses the WebView when the screen is off. The web app reads the points when it wakes. This is the only design that meets the check of a two-hour recording with the screen off and no gaps.

## D11. Hunting units: the county is the unit

Illinois issues firearm deer, muzzleloader deer, spring turkey and fall shotgun turkey permits by county, and each permit is valid only in that county. Archery deer and fall archery turkey permits are statewide. So no separate unit layer exists or is needed. The app shows the county boundary as the hunting unit and says so.

Facts the app will state for these two counties, each with its source in `docs/DATA_SOURCES.md`:

- Both are open for firearm deer, archery deer, spring turkey (Northern Zone) and fall archery turkey.
- Both are closed to fall shotgun turkey.
- Both are in the Restricted Archery Zone, where only antlered deer may be taken from October 1 to October 31.
- Neither is in the chronic wasting disease season list or the late-winter antlerless list for 2026 to 2027.

Rules change every licence year. The app shows the date of its rules and links to the Illinois Department of Natural Resources for the current ones.

## D12. Network state comes from the shell, not the browser

In the test, `navigator.onLine` reported "online" while the emulator was in airplane mode. The app asks the shell for the true network state. This matters for the "needs a connection" message on parcels.

## D13. Wind: the National Weather Service API, called from the phone

- The phone calls `api.weather.gov` directly. No key and no server are needed. It is public domain data.
- The hourly text forecast has no gust field and gives direction only as a compass word. The app uses the raw forecast grid for the point, which has wind speed, direction in degrees and gusts.
- The service rejects requests with an empty User-Agent. The request goes through the shell so that it carries an app name and the source code link, as the service asks. It carries no name, account or device identifier.
- The request does carry a location, which is unavoidable for a point forecast. The forecast grid is 2.5 km, so the app sends the waypoint's coordinates rounded to two decimal places (about 1 km), not the exact spot. See D21.
- The last forecast for each waypoint is saved with its fetch time and shown with its age when offline.
- The service has said a key will be required in the future. The fetch sits behind one interface for that reason.

## D14. Data pipeline: scripts in `pipeline/`, run in WSL Ubuntu, one county per run

- One command builds one layer for one county: `pipeline/build <layer> <county>`. Counties are listed in one file with their FIPS code and name. The county outline comes from TIGER. Adding a county is one new line.
- Tools: GDAL 3.12 and tippecanoe 2.53 from Ubuntu's own packages in WSL2, plus the PMTiles command line tool. All are open source. Docker is installed but not used, because Docker Desktop takes memory this machine does not have.
- Every archive is written with a small metadata file: source, license, credit text, data date, build date. The app's attribution screen and layer legends read those files, so credits cannot drift from the data.
- A contour layer later is one more layer script on the same pattern, fed by USGS 3DEP elevation.
- Tools are installed at the start of Step 1, not in Step 0.

## D15. Where map data is hosted: GitHub Releases, pending the owner's approval of the first push

- Archives are not bundled in the APK. The APK stays small and the user downloads counties and layers. The one exception is the Step 1 test build, which carries both counties' archives inside it because downloads come in Step 2.
- Total size for both counties is estimated at 200 to 300 MB with NAIP imagery to zoom 16, and up to about 1 GB if leaf-off imagery to zoom 17 is added.
- Archives are published as files attached to a GitHub release of the project's public repository. GitHub's documentation says each release file must be under 2 GiB and that there is no limit on total size or bandwidth. One byte range request against a public release file was tested and returned the requested 100 bytes. Pause and resume and area downloads both rely on that. Many range reads in a row are not tested yet, and release downloads pass through a short-lived redirect that the downloader must renew. Both are checked at the start of Step 2. An archive that would pass 2 GiB is split.
- "Pick an area" downloads work by reading only the tiles for that area out of the hosted archive, by byte range, into an archive on the phone. "Whole county" is the same thing with the whole county as the area.
- County parcel data is never hosted. This applies only to the base map, imagery, public land and habitat layers.
- GitHub release downloads do not send the headers a web page needs to read them from another site. That affects only a browser build, not the Android app. If the iPhone browser test build needs hosted data, a second free host is chosen then.

## D16. Public land: PAD-US and OpenStreetMap now, the state's hunting table if permission comes

- Boundaries come from USGS PAD-US 4.1 (public domain), corrected with OpenStreetMap and the regional planning commission's open space dataset where PAD-US is out of date. Both corrections are under the Open Database License.
- PAD-US has no hunting field. The Illinois Department of Natural Resources runs a live table with a hunting code for every species and season at every state site. It is exactly what feature 1 asks for, but it carries no license. It is not used until the department gives permission in writing. That is an open question for the owner.
- Until then, "is hunting allowed" is shown only where a public rule can be cited, as a short hand-written note per managing body with a link to the rule:
  - Champaign County Forest Preserve District: no hunting (district ordinance).
  - Macon County Conservation District: archery deer by district lottery permit at four sites, with one turkey allowed at three of them.
  - State sites: per the department's public site pages.
- The app never implies that public land is open to hunting. "Public" and "huntable" are shown as different things.

## D17. Woodland and likely oak: tree canopy for where, a modeled hint for what

- The woodland layer is built from the USFS tree canopy cover data (2025, 30 m).
- A "possible oak-hickory (modeled)" hint is added from LANDFIRE vegetation classes. LANDFIRE is a federal product, but no license statement was found on its website. Its license is confirmed before the hint is built in Step 5. If it cannot be confirmed, the hint is left out and the woodland layer ships without it.
- The research found that no public dataset can tell an oak woodlot from a maple one at the size of the woods in these counties. The layer and its legend say plainly that it is an estimate.

## D18. Crop types: USDA Cropland Data Layer 2025

Public domain, 30 m, 5.5 MB for both counties from the per-county download. A 10 m version exists but only in a 9.8 GB national file. Start with 30 m.

## D19. Repository layout

```
app/          the web app (TypeScript, Svelte, map styles, tests)
app/android/  the Capacitor Android project and native plugins
pipeline/     data build scripts
docs/         decisions, data sources, step plan, status, reports, evidence
data/         downloads and built archives (ignored by git)
.tools/       project-local tools such as JDK 21 (ignored by git)
```

The Android project sits inside `app/` because that is where Capacitor expects it.

The app's package ID follows WoodLogic's pattern: `io.github.bartbasi.mapapp`. The ID cannot change after a store release, and the name is a working title, so it was put to the owner. He confirmed the package ID on 2026-11-12 (D22).

## D20. Fold and unfold: no engine problem found

The app must keep working across a fold or unfold. In the test, the web app saw the new screen size at once after a fold (412 by 732 on the folded screen) and the map canvas matched it.

An earlier reading in Step 0 said the map failed to resize after a fold. That was wrong. The partly gray map in those screenshots was map tiles still loading on an emulator starved of memory. The evidence is in `docs/research/engine-and-hosting-checks.md`. The app still resizes the map when the viewport changes, as ordinary good practice.

Layout rules for the two screen sizes are in `.claude/agents/ux-designer.md`.

## D21. What leaves the phone

The app has no accounts, analytics or crash reporting, and never sends the user's waypoints, tracks or photos anywhere. Three kinds of request do leave the phone, and each reveals something to the server that answers it. The About screen lists them in plain words.

| Request | Goes to | What the server can see |
|---|---|---|
| Map data downloads | GitHub | The phone's network address and which county or area was downloaded |
| Parcel lookup (Macon County) | The county's map service, hosted by Esri | The phone's network address, the map area being viewed at high zoom, and the ID of a tapped parcel |
| Wind forecast | The National Weather Service | The phone's network address and the waypoint's position rounded to about 1 km |

Rules that follow:

- Parcel outlines are requested by fixed map tile areas, not by the exact screen position, so a request does not reveal exactly where the user is looking.
- The parcel lookup never runs in the background. It runs only when the parcel layer is switched on and the map is zoomed in.
- The parcel layer has a plain note that it contacts the county's server.
- No request carries a name, an account or a device identifier.

## D22. The owner's answers to the Step 0 report (2026-11-12)

The owner answered the eight questions in one short message. His words are quoted, then how they are applied.

| Question | His answer | Applied as |
|---|---|---|
| 1. Champaign County parcels | "We can use it" | Champaign County gets a parcel source. It is built as live lookup in Step 3. This replaces the "nothing for Champaign County yet" part of D8. |
| 2. Macon County parcels, and saving tapped parcels | "Said we call use those as well" | The Macon County live lookup and saved tapped results go ahead. |
| 3. Frame rate on the Z Fold 5 | "I'll test it tomorrow" | Step 1 starts on the current engine. D2 is revisited if his numbers are poor. |
| 4. First push to GitHub | The message breaks off after "4" | **Not approved.** Nothing is pushed until he says so plainly. |
| 5. Leaf-off imagery request | No answer | The aerial view is built from NAIP. |
| 6. State hunting table request | No answer | The state table stays blocked. Hand-written notes are used (D16). |
| 7. Feedback address and package ID | "7 is good" | `io.github.bartbasi.mapapp` and the address in `NOTICE` are confirmed. |
| 8. Protomaps as the route for base map tiles | "8 is good" | Confirmed (D6). |

**What answers 1 and 2 do not settle.** They read as the counties having replied to his permission requests, but the message does not say what each county granted. Until the owner says what was granted, and ideally shows it in writing, the rule is unchanged: live lookup and saved tapped results only. No bulk download, no bundled county data, no county data in the repository or on any host. Finding the Champaign County map service's address is now allowed, because the owner has decided the county may be used. That is done in Step 3.

## D23. How the app reads several counties' archives (2026-11-12, Step 1)

Each county has its own archive of each layer (D4). The app has to show them as one map.

- **Vector layers: one map source per layer.** A tile request is answered from the first installed archive that has that tile. This works because every tile in a vector archive is whole: it holds everything the source data has for that tile, even past the county line. The map style never names a county.
- **Raster layers: one map source per archive.** A county's imagery archive covers that county and is transparent beyond it, so the app draws each one as its own layer and they overlap cleanly.
- **A layer starts at the lowest zoom where whole tiles are practical.** Public land runs from zoom 10 to 14. Below zoom 10 a tile is wider than several counties, and the sites here are too small to see. Imagery runs from zoom 7 to 16. It first ran from zoom 10, but the app opens on both counties at about zoom 8, and the aerial view then showed no imagery at all. The low zoom tiles add almost nothing to the size. In the aerial and hybrid views the plain base map still sits under the imagery, so the screen is never blank outside the counties.
- **For later:** a state with large public lands needs a statewide low-zoom overview archive. That is a new layer on the same pattern, not a change to this design.

## D24. What counts as public land (2026-11-12, Step 1)

The public land layer shows land a member of the public could reasonably think of as public. The source, PAD-US, also lists other protected land. The rules:

- **Kept:** land owned or managed by a public body, whatever its access. Land owned by a land trust or similar conservation group, if its access is open or restricted.
- **Dropped:** privately owned land, including private easements, private reserves and country clubs, even where PAD-US marks it "open". Planning boundaries that are not ownership. A record that repeats another record of the same site.
- **Corrected:** Champaign County Forest Preserve District land is taken from the regional planning commission's open dataset, because PAD-US has it badly out of date. Any PAD-US record lying mostly inside one of those shapes is dropped as a duplicate.
- Access is shown as access on foot. It is never shown as permission to hunt (D16).

Known faults left in the data, to be listed in the Step 1 report: one PAD-US record named "City Park" bundles many small parks far apart, and seven Champaign County parks have no recorded manager.

## D25. The owner's answers to the Step 1 report (2026-11-17)

His words are quoted, then how they are applied.

| Question | His answer | Applied as |
|---|---|---|
| Frame rate on the Z Fold 5 | Measured on his phone over USB: about 120 frames per second in the Map and Hybrid views, folded and unfolded, no frame over 33 ms. He added "Works great". | The check passes. D2 (the map engine) stands. Evidence: `docs/evidence/step1/phone/`. |
| First push to GitHub | "yes, include the brief CLAUDE.md and the reports" | The repository is pushed to `github.com/bartbasi/MapApp` as a public repository, with every tracked file. |
| Microsoft's terms for the imagery service | "yes i accept them" | The aerial archives stay as built and may be hosted with the other layers. |
| What each county granted for parcels | "can store a copy" | Both counties become bundled offline parcel data. See below. |
| The imagery patchwork | "I agree with your recommendation on leaving it, it looks good." | Left as built: newest imagery where it exists. |
| The hunting notes | "Hunting notes are right" | Kept as written. |

**Parcels: both counties are now stored data.** This replaces the live lookup in D8 and the limits at the end of D22.

- Each county's parcels are built into a parcel archive, like any other layer, and work with no network. The brief says this is what happens when a county grants permission.
- The archive holds four things per parcel and nothing else: the outline, the parcel ID, the acreage and the owner name. The pipeline never requests a mailing address, a site address or a phone number. That rule is unchanged.
- The grant rests on the owner's word. No written grant is in the project. He should keep each county's reply, and tell the project any condition it carries: a required credit, a limit on passing the data on, or a set way to receive the data.
- Parcel archives are built on this laptop and stay under `data/`, which is never committed.
- **Parcel archives are not put on GitHub or any other public host until the owner says so in plain words.** The brief requires his say before any county data file is pushed. Until then they reach a phone only inside a test build that he installs himself.
- The Champaign County data comes from the county's own map service only if that service can be reached without clicking through the consortium's 2013 terms page. Those terms forbid copying, and accepting them in order to copy would be wrong. If the service cannot be reached that way, Champaign County waits for the owner to say how the county wants to hand the data over.
- The `ParcelSource` interface from D8 stays, with a stored-data implementation. A live lookup implementation is not built now, because no county needs it. A later county without permission would get one.
- D21 changes with this: no parcel request leaves the phone. The parcel row of that table no longer applies to these two counties.

## D26. The core function: the phone's position against the property lines (2026-11-17)

The owner wrote: "this app should first and foremost be focused on showing the exact GPS location of the phone itself in relationship to property lines. That's the core functionality above and beyond anything else."

Applied as:

- **The order of the steps changes.** The position marker and the parcel lines are built next, together, as the new Step 2. Offline downloads move to Step 3. Nothing in the brief is dropped. `docs/STEP_PLAN.md` has the new order.
- **The app tells the user where they stand, in words as well as on the map.** A position readout names the parcel the phone is in and gives the distance and direction to the nearest property line.
- **The app is honest about how exact it can be.** A phone's GPS is usually good to 3 to 10 m in the open and worse under trees. County parcel lines are drawn for tax assessment and can sit several meters off the true line. So the readout shows the GPS accuracy beside the distance, and when the accuracy is larger than the distance to the line it says the phone may be on either side. The "not a legal survey" statement is shown with it.
- **When a choice has to be made between features, this one wins**: the marker and the parcel lines are drawn above every other layer, are readable in all three base views, and are tested hardest.

## D27. The parcel archive and how the app reads it (2026-11-17, Step 2)

- **One archive per county**, `data/build/<county-id>/parcels.pmtiles`, with its metadata file, on the same contract as the other layers (`pipeline/README.md`). The layer id is `parcels` and the tile layer inside is named `parcels`.
- **Four properties per parcel and no others:** `pid` (the parcel ID as the county writes it, text), `owner` (the owner name as the county writes it, text, may be empty), `acres` (a number, or absent if the county has none) and `county` (the county id). Any other field in a parcel tile is a defect.
- **Zoom 13 to 16.** Zoom 16 holds every parcel at full detail with nothing dropped or simplified. One tile unit there is about 0.11 m on the ground, which is finer than the data. Closer zooms are drawn from the zoom 16 tiles.
- **One map source per county archive**, as for imagery (D23), not one per layer. A county's parcel tile holds only that county's parcels, so two counties that share a tile must both be drawn.
- **The position readout does not depend on what the map is showing.** It reads the zoom 16 tile under the phone straight from the archive, and the neighbouring tile when the phone is near a tile edge. It finds the parcel that holds the point and the nearest outline. Edges made by cutting a parcel at a tile boundary are not property lines and are ignored.
- **The map can zoom to level 20**, so a few meters fill the screen.

## D28. How the readout decides which side of a line the phone is on (2026-11-17, Step 2)

- **The app never names a side the evidence cannot support.** The doubt around a position is the GPS accuracy the phone reports, plus 3 m for error in the county's lines. If the nearest property line is closer than that, the readout says the phone is on or near the line and names the parcels on both sides.
- **What the phone's accuracy figure means.** Android's accuracy is a radius the true position lies inside about 68 times in 100. About one fix in three lies outside it, and under trees the figure is often too hopeful. So "never" above is a rule for the app's words, not a promise about the ground: at the edge of the band the app can still name the wrong side. The 3 m is the only margin against that. (Added after the step review, 2026-11-17.)
- **The 3 m is a judgement, not a measurement.** County lines are drawn for tax assessment. Their error is not published and varies from place to place. The figure is one named constant in `app/src/parcels/readout.ts` and can be raised.
- **A weak fix is said to be weak.** When the accuracy is worse than 50 m the readout says the GPS is too weak to place the phone, and marks any parcel it names as a guess.
- **Each answer belongs to one fix.** The parcel lookup is made again for each new fix. An older answer is widened by how far the phone has moved since, and is dropped after 30 m.
- **Every place is answered by the tile that owns it.** A tile's copy of a parcel beyond its own edge can sit a few centimeters off, which was found on the Macon County data to hide a real line and overstate the distance by more than a meter. The parcel code reads the neighbouring tile instead of trusting that copy.
- **D8 is amended:** the two operations of `ParcelSource` are now the parcel at a point (for a tap) and the position query (for the readout). The map draws the outlines straight from the archive (D27).

## D29. The parcel lines and the GPS frame (2026-11-17, Step 2)

- The county stores its parcels in the NAD83 map frame. A phone's GPS reports in the current world frame, which sits about 1.3 m from NAD83 in central Illinois. A parcel archive that ignored this would be off by that much, always in the same direction.
- **The Macon County archive does not ignore it.** The county's service converts to the world frame as of 1997 when it hands out coordinates. That was checked on one parcel, to the millimeter, with an independent calculation (`docs/evidence/step2/parcels/datum.md`).
- **What is left is about 0.5 m east**, from the drift of the continent since 1997. It is not corrected. It is small beside a phone's GPS error and the 3 m allowance in D28, and correcting it would need a fresh download of the county's data.
- A rough test against road centerlines agrees that the county's lines are placed in true NAD83, but it cannot prove it. Survey control would.
- **Rule for any new county:** find out what frame its coordinates arrive in before building, and never apply a datum shift without checking whether the service has already applied one. A first reading of this very case had the sign reversed and the size doubled.

## D30. How the property lines and the readout are shown (2026-11-17, Step 2)

- **The line.** A property line is a bright yellow-green line on a near-black edge, with no fill, the same in all three base views. It is thin at zoom 13 and heavy at zoom 19. It draws above public land and below place names and the position marker. The colour was chosen to stand out on both the pale map and the dark imagery, and to differ from the yellow of a tapped feature and the blue of the marker.
- **One map source per county archive.** The outlines draw straight from each county's archive (D27). A county without an archive simply has no lines, and the app says so in words.
- **The readout card.** It sits at the bottom left, beside the locate button. It has five states: inside a parcel, on or near a line, not in a parcel, GPS too weak, and no property lines for this place. Closed, it gives the owner, the distance and direction to the nearest line, the parcel ID and the GPS accuracy. Opened, it adds the parcel across the line, the acreage, the county, the data date and the "not a legal survey" sentence.
- **On the map.** From zoom 15 a dashed line runs from the marker to the nearest property line. When the phone is on or near a line, that stretch of line is drawn in amber and black stripes instead. The lines of the parcel the phone is in get a soft blue glow, drawn under the lines so it does not change their colour.
- **A parcel record with no parcel ID is never named.** The county has 379 of them, mostly road strips. A position inside one reads as not in a parcel. Their edges still count as property lines.
- **Several parcels on one outline** (condominiums) are listed, with the count. The first is shown and the rest are in the opened card and the tap panel.
- **A missing or zero acreage** reads "Acreage not listed in the county record". The county records zero for many town lots.
- **D28 is amended in one detail.** A new lookup is skipped when the phone has moved less than 0.5 m since the last one. The older answer is still widened by that movement, so the readout can only be more cautious.
- **Owner names in evidence.** A development build, or a test build made with `VITE_MAPAPP_MASK_OWNERS=1`, can show "OWNER NAME" in place of every owner, so screenshots can be kept. No other build can mask. The build given to the owner shows the real names.
- **The distance check.** `pipeline/checks/parcels_line_distance.py` fetches named parcels from the county's service and measures test points against those outlines, without reading the archive. This is the independent side of the Step 2 distance check.

## D31. The phone's position is read through a location plugin of our own, with no closed library (2026-11-17, decided by the owner the same day)

- **The problem.** Through Step 2 the position marker read the phone's location through the Capacitor geolocation plugin. On Android that plugin links Google's `play-services-location` library, which is not open source. MapApp is published under the GPL. An app that links a closed library cannot be listed on F-Droid, and the GPL's terms and a closed library sit badly together. The step review found it.
- **Decided.** The owner said yes on 2026-11-17 to replacing it with a plugin of our own. The Capacitor geolocation plugin is removed from the app.
- **What was built.** The `DeviceLocation` plugin, in `app/android/app/src/main/java/io/github/bartbasi/mapapp/location/`, about 400 lines of Java with its comments. It uses only Android's own location interface (`LocationManager`). It has no Google Play services code in it or under it. The app side is `app/src/position/native-source.ts`, behind the same position source interface as before, so the store, the readout and the screens did not change.
  - It always listens to the phone's GPS, one fix a second, with no minimum distance.
  - On a phone with Android 12 or later that has the platform's own fused provider, it also listens to that, at high accuracy.
  - **The rule between the two:** a GPS fix is always passed on. A fused fix is passed on only while no GPS fix younger than 5 seconds has been heard. A fix that is not newer than the last one passed on is dropped, from either provider, so the marker never steps back in time. The rule is `FixArbiter.java`, with its own tests.
  - It reports the precise and approximate permissions as before, so approximate-only is still refused (D32). It hears the phone's Location switch go off, through the providers and through Android's broadcast, and says so.
  - It stops listening when the app leaves the screen and starts again when the app comes back. If Location was switched off meanwhile, it says so on return.
  - Each fix carries its age at delivery, from Android's steady clock. The app now counts a fix's age from when the fix was taken, not from when it arrived.
- **Proof the closed library is gone.** The debug runtime classpath has no `play-services` and no `iongeolocation`, and the built app has no class under `com/google/android/gms/` (the Step 2 build had 1,076). See `docs/evidence/step3/location/`.
- **What the platform's fused provider is.** It is part of the phone, not of MapApp. On a phone with Google services, Android hands that provider to Google's own system service, which may use Wi-Fi and cell signals as the phone's settings allow. MapApp links none of that code and sends nothing. A phone without Google services has the open source fused provider of Android itself, or none, and then MapApp uses the GPS alone.
- **The cost.** Without Google's fused service there is no Wi-Fi or cell position to give a quick first fix indoors and in town, except what the phone's own fused provider gives. On a phone without it, the first fix waits for the GPS: seconds under open sky, a minute or more indoors or after a long time off. A hunter outdoors is not affected.
- **Why the 5-second rule.** A fused fix is often smoothed and can lag a real move (seen in Step 2: about 4 m short for a second or two after a jump). The raw GPS fix is the one a hunter at a property line wants. The fused provider is there only so that the app is not blank before the GPS has a fix, or when the sky is lost.
- **Not checked on a real phone yet:** how quickly the first fix comes indoors and outdoors, and whether a real fused provider fills gaps under trees as it did on the emulator.

## D32. Where a parcel archive can speak, and other limits on the readout (2026-11-17, after the step review)

The step review found that the readout could say more than its data supports. These rules were added. Each has a unit test.

- **An archive speaks only for its own county.** The parcel archive's metadata now carries the county outline (the Census outline, simplified to 5 m), under the name `coverage`. Before this, the app took any place inside the archive's map tiles as covered. A tile that crosses the county line made land in the next county read "Not in a parcel. This is often a road or a railway." That was wrong for up to about 475 m outside Macon County. Now a place in no parcel and outside the outline reads "No property lines for this place yet."
- **A parcel that contains the position is believed wherever it is.** The Census line and the county's own parcel edges differ by some meters, and the parcel is the better evidence.
- **A band of 25 m inside the outline counts as outside, for a place in no parcel.** Along the county line the nearest parcel sits a median 8 m inside the Census line, and 23 m at the 99th percentile, mostly the half of a road that runs on the line. Inside that band the data cannot tell a Macon County road from the next county, so the app says it has no property lines there. The figure is `COVERAGE_EDGE_M` in `app/src/parcels/coverage-area.ts`.
- **Across a line at the county edge** the opened card says "No property lines are installed across that line." It no longer says "no parcel".
- **A place inside the county with no map tile** (Lake Decatur) reads "Not in a parcel", with "often a road, a railway or water".
- **A parcel inside another parcel:** the card names the parcel that is really across the line. Before, it could say "no parcel".
- **An accuracy of 0 means unknown.** Android reports 0 when a fix has no accuracy. The readout treats it as a fix too weak to place the phone.
- **No guess from a very poor fix.** When the accuracy plus 3 m reaches the 150 m search distance, the card names no parcel.
- **Approximate location is refused.** If the user gives only approximate location, the app says it needs precise location and shows no marker and no readout. An approximate fix can be off by a mile.
- **A position older than 5 minutes names nothing.** The card says "No current position." (`NO_POSITION_AFTER_MS` in `app/src/position/store.ts`.)
- **Notes written for the project are not shown to users.** The Sources screen showed a build note about not publishing the archive. Build notes now live in a part of the metadata the app does not show.


## D33. How offline downloads work (2026-11-17, Step 3)

- **The hosted files.** `pipeline/publish.py` puts the base map, aerial imagery and public land archives of each county in a GitHub release as plain files, and writes a catalog that lists them with size and checksum. A release's files never change. New data goes out as a new release, and the catalog moves to it. This way a phone in the middle of a download keeps getting the same bytes.
- **The catalog** is `catalog/catalog.json` in the repository. The app fetches it from the repository's raw file address. A test build can be pointed at another address when it is built.
- **A picked area copies only its own tiles.** The app reads the hosted archive's index (one or two small reads), works out which bytes hold the tiles of the area, and writes a new, smaller archive on the phone. The size shown before the download starts is exact, because it comes from that index. Measured: a 10 km box of Macon County is 1.7 MB of base map and 22.7 MB of imagery at full detail, or 2.9 MB of imagery at zoom 14. No area tested needs more than 56 requests.
- **A whole county is the same job** with the whole file as its one piece.
- **Two parts, split on purpose.** The part that understands map archives is TypeScript (`app/src/downloads/`), where it is tested against the real archives and against the reference tool. The part that fetches bytes is native Android code that knows nothing about maps. It writes the bytes it is told to, in order, and can stop and go on at any byte. The contract between them is `app/src/downloads/contract.ts`.
- **A download goes on with the screen off.** The native part runs as an Android foreground service with a notification that shows progress. Android asks the user to allow notifications. If the user refuses, the download still runs.
- **A killed app loses nothing.** The job and the bytes written so far are on the phone's storage. When the app opens again the download goes on from where it was.
- **An area shows on the map only when every one of its files is complete.** A half-written file is never opened as map data.
- **The app carries an overview map.** It is a low-detail base map (zoom 0 to 11, 6.9 MB) of the box around both counties plus half a degree. It gives the map and the area picker something to show before anything is downloaded. It shows highways, main roads, towns, rivers and lakes. Its zoom is the highest that stays under 8 MB. This is the one exception to "archives are not bundled in the APK" in D15.
- **Parcel data is not hosted** (D15, D25). Until the owner says by name that it may be, a parcel archive reaches a phone only inside a build. If parcel data is hosted later, an area's copy must carry the county outline cut down to the area's rectangle, so that the readout does not say "Not in a parcel" outside the downloaded rectangle (the fault described in D32).
- **Mobile data.** The app asks Android for the true network state (D12). Before a download on a connection that is charged by use, the size screen says so.
- **What leaves the phone** is as D21 says: GitHub sees the phone's network address and which parts of which file were read, which shows roughly the area downloaded. No request carries a name, an account or a device identifier.
- **Not tested yet:** many reads in a row against GitHub's real release files, and the short-lived redirect they pass through. Both are tested on this laptop with a server that behaves the same way (`app/scripts/release-test-server.mjs`), and against GitHub itself once the owner allows the first data release.
