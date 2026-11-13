# MapApp build brief

You are starting a new project called MapApp (a working title). Read this whole brief before you do anything. It covers what to build, what is already decided, what was checked before the brief was written, and how to work.

## The product

MapApp is a GPS mapping app for hunters. In the field, often with no cell signal, a hunter sees where they are, where public land ends and private land starts, who owns a private parcel, and where their own marks are.

The app has to answer four questions fast:

1. Where am I, and whose land am I standing on?
2. What is the ground like between here and there?
3. Where are my stands, cameras, parking spots and sightings?
4. Is the wind right for the stand I want to sit?

This brief asks you to build Phase 1 only: an Android app that covers two Illinois counties in 2D, using free public data. Later phases are listed near the end so you can design with them in mind. Do not build them now.

Commercial apps in this category exist. MapApp is an original product. Write the code, map styles, icons and text yourself. Do not copy another product's name, branding, layer names, map styling or data, and do not pull data from another product's servers. Copying any of those would create legal exposure for the owner.

## Who you work for

Bart Basi is the owner and the only human on this project. He has a computer science background and has shipped several apps with Claude Code through his company, Play, Inc. He is not watching while you work. He reads your report at the end of each step and tests builds on his own phone, a Samsung Galaxy Z Fold 5, so the layout has to work both folded and unfolded.

This is a new codebase and it is yours. You are its owner and long-term maintainer, and its structure is your call. Keep it clean as it grows: merge duplicated code, fix problems you find, and record any known defect you choose to leave for later.

## Decisions already made

- Publisher and license: Play, Inc. The app is free and open source. Use the same license and attribution terms as the other Play, Inc. projects. Copy them from github.com/bartbasi/WoodLogic, and ask Bart if you cannot read that repo. Credit Bart Basi as developer and Play, Inc. as the company.
- No accounts, ads, analytics or data collection. User data stays on the device. A hunter's spots are private and the app has to treat them that way.
- The About screen has a link to the source code, a way to send feedback, and the donation link buymeacoffee.com/playinc. Donations are appreciated but never expected, and the wording should say so.
- Platform for Phase 1: Android only.
- No desktop version for now. An iPhone version is a real goal once the Android app works, and a desktop version may follow later, so keep the map core and the app code portable to both. Bart has no Mac, so do no iOS or macOS build work in Phase 1. Bart has an older iPhone. If the map core can run in mobile Safari at no cost, a browser test build for that phone is welcome but optional.
- Coverage for Phase 1: Champaign County and Macon County, Illinois, and nothing else.
- Data: free, publicly available sources only. No paid data. The target running cost is zero, including hosting.
- Map: 2D only. No 3D terrain. Contour lines are not in Phase 1, but they are the first thing planned after it. Build the data pipeline so a contour layer can be added later the same way as any other layer.
- No live sync. Waypoints and tracks move in and out as GPX and GeoJSON files.
- Development machine: Cabin-Laptop. Windows 11 Pro, Intel i7-10750H, 12 GB RAM, GTX 1650 Ti with 4 GB. It runs all day and is hardwired. Memory is tight, so do not run the Android emulator, a full build and a heavy data job at the same time.

## Phase 1 features

Each feature lists what it does and how you will know it works. Treat the checks as the definition of done.

### 1. Public and private land boundaries

- Public land is filled with a color for each managing body (state sites, forest preserve and conservation districts, federal land if any), with a legend. Tapping public land shows the site name and who manages it. Where the source data says whether hunting is allowed, show that too.
- Private parcels show as outlines once the map is zoomed in far enough to read them. Tapping a parcel shows the owner name, acreage, parcel ID and county, plus the date of the data.
- Show the owner name and parcel facts only. Leave out mailing addresses and phone numbers even if a source has them. The purpose is to avoid trespassing and to know whom to ask for permission.
- The app states plainly that boundaries come from public records and are not a legal survey.
- Most land in these two counties is private farmland, so the parcel layer is the most valuable layer in Phase 1.
- Bart has asked both county GIS offices for permission to use their parcel data and is waiting for answers. Until a county grants permission, build its parcel layer as a live lookup: when the phone is online, draw parcel outlines from the county's own public map service and fetch the owner for the parcel the user taps. Put the parcel source behind one interface, so a county can switch to bundled offline data when permission arrives without changes to the rest of the app.
- Live lookup rules: make requests only for what the user is looking at or taps, and do no bulk fetching ahead of time. The app may keep results for parcels the user has tapped on the device, with their date. With no connection, the app says that parcels for that county need a connection and still shows the saved results.
- Check: twenty parcels picked at random in each county match that county's own records for owner name and outline. Public land colors match the source data along at least three boundaries you inspect by hand.

### 2. Offline maps and GPS

- The user picks an area and a detail level, sees the download size before starting, and can pause, resume and delete downloads. With only two counties, also offer each whole county as a one-tap download.
- A downloaded area includes every layer the user had turned on.
- Live position comes from the device GPS with no network. Saved waypoints and tracks are always available offline.
- Check: in airplane mode, a downloaded area draws every bundled layer, a parcel tap returns the owner in any county whose parcel data is bundled, a live lookup county shows its "needs a connection" message and its saved results, and the position marker follows a replayed GPS route. Killing the app mid-download and reopening it resumes the download without corrupting the area.

### 3. Map views and layers

- Base views: aerial imagery, a map view (roads, water, woodland, place names), and a hybrid of the two.
- Layers the user can switch on: crop types, woodland with likely oak and other mast-producing stands, and public hunting sites. Each layer has a legend and its data date.
- Hunting units: find out how Illinois defines them for deer and turkey. If permits are issued by county, the county boundary is the unit and the app should say so.
- Check: every layer names its source and license on an attribution screen. Panning and zooming stay smooth on the Z Fold 5, and you write the measured frame rate in the report.

### 4. Scouting and tracking

- Waypoints with types for trail camera, tree stand, parking, animal sighting and a custom type. Each has a name, notes, an optional photo and a color. Waypoints can be edited, deleted, exported and imported.
- A tracker records the walking path as a breadcrumb trail, with start, pause and stop. It keeps recording with the screen off and the app in the background. Each saved track shows distance and time, and exports as GPX.
- Wind: for any waypoint the app shows current wind and an hourly forecast. For a stand, the hunter marks which wind directions are good, and the app marks each forecast hour as good or poor for that stand. A forecast fetched earlier stays viewable offline and shows its age.
- Check: a two-hour replayed route with the screen off produces one continuous track with no gaps. A GPX file exported from the app imports back with every waypoint and track intact. Wind ratings are covered by unit tests, including directions that wrap past north.

## What was checked before this brief was written

These were checked on 2026-11-12. Confirm each one yourself before you rely on it.

- Champaign County's GIS data is managed by the Champaign County GIS Consortium. A 2021 consortium agreement found online licensed data for a fee and kept ownership with the consortium. The county's public web map is free to look at, but looking is not permission to copy the data into an app or a public repository.
- Macon County has a county GIS department and a public map. Its download and reuse terms were not confirmed.
- Because of those two points, the parcel layer is the main risk in Phase 1. Read both counties' terms in Step 0. Do not bulk-download or scrape either county's map service until you know the terms allow it. Bart has already sent a permission request to both offices. Until he hears back, the default is the live lookup described under feature 1. Confirm that each county's service terms allow an app to query it that way. If a county's terms do not allow even that, say so in your Step 0 report and leave that county without parcels until Bart decides.
- Federal data such as USGS, USDA and NWS products is generally free to use. OpenStreetMap data is free under a license that requires attribution and has share-alike terms for the data. Confirm the exact terms for each source.
- The main Flutter MapLibre plugin reported no desktop support, and the newer one reached desktop by wrapping MapLibre GL JS in a web view. With 3D out of Phase 1, either a native Android map or a web map core could work. The iPhone goal means the choice has to work well on iOS. The lack of a Mac and the later 3D plan lean toward a web map core. Decide in Step 0 and record why.
- Whatever you choose, Android needs native code for a foreground location service.

## Data sources to evaluate

These are candidates, not decisions. For each one, confirm the license, coverage, update schedule and download size for the two counties, and record the result in docs/DATA_SOURCES.md. If a license does not allow the data to be used and redistributed by a free, open source app, drop the source and say so.

- Parcels and owners: Champaign County GIS Consortium, Macon County GIS.
- Public land: USGS PAD-US, Illinois Department of Natural Resources sites, Champaign County Forest Preserve District, Macon County Conservation District.
- Public hunting sites: Illinois Department of Natural Resources.
- Aerial imagery: USDA NAIP, and Illinois state orthoimagery from the Illinois Geospatial Data Clearinghouse.
- Roads, water, woodland and place names: OpenStreetMap, US Census TIGER.
- Crop types: USDA Cropland Data Layer.
- Woodland and likely oak stands: USFS forest type data or LANDFIRE vegetation. This is an estimate, and the layer has to say so.
- Wind and weather: the National Weather Service API.
- For the later contour phase: USGS 3DEP elevation and Illinois lidar elevation data. Note what is available, but build nothing with it yet.

## Architecture defaults

Change any of these if Step 0 gives you a good reason, and record the reason in docs/DECISIONS.md.

- Local first. User data lives in a database on the device.
- Map data is built ahead of time into static tile archives such as PMTiles. Two counties may be small enough to ship inside the app or as release downloads. Otherwise serve them from free static hosting with no tile server to run.
- The data pipeline is a set of scripts in the repo. One command rebuilds any layer for any county, so adding a county later is a parameter change.
- Some GIS tools run best under Linux. Check what is installed on Cabin-Laptop, including WSL2, before you choose tools.
- User data formats are open: GPX and GeoJSON in and out.

## Steps in Phase 1

Stop for Bart's review at the end of each step and nowhere else. Inside a step, keep working. From Step 1 on, each step ends with an installable APK and a note saying where it is.

- Step 0, survey and decisions. Write no product code beyond small throwaway tests. Verify the items under "What was checked". Read the data terms for both counties and evaluate every data source. Choose the map engine and app framework, and prove the choice with a test app that draws a 2D map from a local tile archive on the Android emulator. Estimate download sizes and hosting needs. Set up the agent team. Write docs/DECISIONS.md, docs/DATA_SOURCES.md and a step plan. End with a report that lists every open question for Bart.
- Step 1, map core and base data: the three base views and the public land layer for both counties.
- Step 2, offline downloads and GPS position with no network.
- Step 3, parcels and owners: live lookup by default, and bundled offline data for any county that has granted permission by then.
- Step 4, scouting and tracking: waypoints, the tracker, wind, export and import.
- Step 5, the remaining layers, the About and attribution screens, a README, and a release build.

## Later phases, for design awareness only

Do not build these. Avoid choices that would block them.

- Contour lines for elevation.
- More Illinois counties, then other states. Wildfire history and timber cut layers belong here, because they matter in forested states and have little to show in these two counties.
- 3D terrain.
- An iPhone version, which is the next platform after Android.
- A desktop version, which is possible later but not planned.
- Android Auto, a Wear OS watch app, and trail camera and rangefinder connections.

## Agent team

You are the lead and you run on Fable 5.2 at high effort. On Bart's Max plan, Fable use is capped at about half of the weekly limit and uses the limit faster than other models. Spend Fable where judgment matters most and give volume work to other models.

Create these subagents as files in .claude/agents. Check the current Claude Code documentation for the file format.

- Lead (you, Fable 5.2): the plan, the architecture, data and license decisions, task briefs, integration and the step reports. You also act as product manager. Write code yourself when a piece is small or central to the design.
- data-engineer (Opus 5.5): pipeline scripts for each data layer. Several can run at once, one per layer.
- app-developer (Opus 5.5): the app code, including the native Android parts.
- ux-designer (Opus 5.5): the map style, icons, screens, and the folded and unfolded layouts.
- qa-tester (Sonnet 5.5): runs the checks, GPS route replays and emulator sessions, takes screenshots, and reports failures with evidence.
- step-reviewer (Fable 5.2): runs once per step with fresh context. It reviews the finished work against this brief's checks before you report to Bart.

Subagents cost real usage and each one starts with no context. Use one when work splits into independent parts or when a fresh reviewer is the point. Do small or tightly connected work yourself. Give every subagent a written task with the goal, the files involved, the check that defines done, and what to report back. If the mix is not working, for example if the weekly limit is running short, say so in your report and propose a change.

## How to work

### Finishing work

Carry each step through to its checks. If you catch yourself listing what is left and offering to continue, do the next item instead. Errors, timeouts, failed builds, empty results and missing tools are ordinary obstacles. Diagnose them and work through them: retry, fix the request, or use another tool or source. Stop early only when the work cannot move without Bart's answer, or when something was blocked on purpose, such as access that was deliberately withheld. In that case leave it alone, say what you found, and look for another safe way to finish.

### Approvals

Ask Bart before you do any of these:

- Spend money, start a paid plan or a trial that needs a card, or accept a data license.
- Make the first push to a public repository, or push any county data files at any time.
- Publish to an app store.
- Delete or change files outside this project folder.
- Turn on a Windows feature that needs a restart.
- Download more than 50 GB of data in one step.

Everything else is routine and needs no approval. That includes creating and editing files in the repo, installing development tools and libraries, running builds, tests and emulators, downloading public datasets under the size limit, committing to the local git repository, pushing code after the first push is approved, and restructuring your own code.

### Keeping Bart informed

Before you start a step, say in one line what you are about to do. Every few tool calls, give a one-line update on where things stand. Keep docs/STATUS.md current with what is done, what is in progress and what is next, so a new session can pick up from the file alone.

### Reports

Write step reports for a reader who has not seen your tool calls or files and may be coming from other work. Put the result first: what works, what does not, and what you need from Bart. Use plain words and full sentences. Keep to one idea per sentence, and use the same word for the same thing throughout. Do not use names you made up during the work without saying what they are. Do not use em dashes. Include the check results for the step, with numbers where a check asks for them.

### Verification

Every step ends with its checks run and the results in the report. Take screenshots of the running app and look at them yourself before you claim a map feature works. A feature that compiles but was not seen working is not done.

## Start here

Begin Step 0 now. Your first message should say in one line what you are about to do.
