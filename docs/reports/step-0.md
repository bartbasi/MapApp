# Step 0 report: survey and decisions

Date: 2026-11-12. Written for Bart.

## Result

Step 0 is complete. The map engine is chosen and proven on the emulator. Every data source is evaluated. One county has a parcel problem that needs your decision.

- **Works:** a test app draws a 2D map of the Champaign County area on the Android emulator from a tile archive stored on the device, in airplane mode, on both the unfolded and the folded screen.
- **Does not work:** Champaign County parcels. The terms for the county's parcel map do not allow even the live lookup. Champaign County will have no parcel layer until permission arrives or you decide otherwise.
- **Not yet known:** the frame rate on your Z Fold 5. The emulator cannot answer that.
- **Needed from you:** eight answers, listed at the end. The two that matter most are the parcel decisions and a two-minute frame rate test on your phone.

No product code was written. No money was spent, no license was accepted and nothing was pushed. No county parcel data was downloaded or stored. I made three small requests to the Macon County service to learn what it holds, and they are described below.

## The parcel finding

Two names are used below. "The consortium" is the Champaign County GIS Consortium, the body that manages Champaign County's GIS data and runs its parcel map. "Live lookup" is the brief's default: the app asks a county's own public map service for the parcels the user is viewing or taps, and fetches nothing ahead of time.

### Macon County: the live lookup is allowed by default

- The county publishes its parcels as a public map service. It is the same service the county's own parcel viewer uses. It holds 57,096 parcels and was last edited on 2026-10-28.
- No terms of use and no license are posted on the service, on the viewer or on the county GIS page. The viewer says only that the maps are not a legal survey.
- The county website's footer, on every page, says "All rights reserved". So the data may not be copied in bulk or passed on, and the app will not do either.
- Nothing forbids an app from asking that service about the area a user is viewing, as the county's own viewer does. The app will do that.
- The app will request three things only: parcel ID, acreage and owner name. The service also holds mailing addresses. The app will never request them.

**One point for you to confirm.** The brief says the app may keep, on the phone, the results for parcels the user has tapped. Each saved result is a copy of one public record on the user's own phone. Macon County has neither allowed nor forbidden that. I plan to keep the feature for Macon County, because it is one record at a time at the user's own action. It is question 2.

**What I requested from the Macon County service.** The service's description. One count of its records. One test query for three records, with no outlines, to confirm which field holds the owner name. I read that result once and deleted it. Nothing from it is in the project.

### Champaign County: not allowed

- The county's free parcel map sits behind a page where the user must accept the consortium's terms.
- The terms allow "personal, non-commercial transitory viewing only".
- The terms forbid copying the materials and forbid "any public display (commercial or non-commercial)".
- The terms say "the copying, redistribution, use or publication by you of any portion of our Website is strictly prohibited".
- The terms cover the website, its sub-domains and associated applications. The parcel map is on a sub-domain.

An app that queries that map and shows the result to its users is outside those terms. Saving a tapped parcel on the phone is copying.

I looked for another route and found none. The consortium sells data under a signed agreement, and its prices are not posted. The regional planning commission's open data site and the City of Champaign's open data site have no parcel dataset. I did not open or query the consortium's map service at all.

Your permission request to the consortium is the only path for Champaign County. Until it is answered, the app will say that parcel data for Champaign County is not available yet.

The addresses, the quoted terms and every request I made are in `docs/research/county-parcel-terms.md`.

## The map engine decision

**Decision: a web map core.** The map is drawn by MapLibre GL JS, an open source JavaScript map library. It runs inside a thin native Android app built with Capacitor, an open source tool that wraps a web app as an Android app and lets it call native code. The app itself is written in TypeScript, built with a tool called Vite, with a small library called Svelte for the screens.

Why:

- The same map and app code will run in Safari on your iPhone as a web page. That gives an iPhone test path with no Mac.
- One code base covers Android now, and an iPhone app and a desktop app later.
- This library already draws 3D terrain, which keeps the later 3D phase open.
- I checked the brief's note about Flutter. The main Flutter map plugin lists Android, iOS and web only. The newer one reaches desktop by wrapping this same JavaScript library in a web view.

Native Android code is still needed for five things: reading tile archives from storage, downloading files, the location service that records a track with the screen off, reading the true network state, and the weather request.

The app will need Android 7.0 or newer, released in 2016. That is the minimum of the wrapping tool. Tell me if older phones matter to you.

### The proof

The test app is a throwaway. It shows OpenStreetMap data for the Champaign County area from a 12.1 MB tile archive in the app's storage. I ran the whole test twice. The second run used a clean install of the final APK and kept a log.

| Test | Result | Evidence in `docs/evidence/step0/` |
|---|---|---|
| Map draws from the archive on the device, unfolded, online | Pass | `run1-unfolded-online.png` |
| Network is down in airplane mode | Confirmed by a failed ping | `run2-test-log.txt` |
| Map draws in airplane mode, unfolded | Pass. 0 tile reads failed. | `run2-unfolded-airplane-mode.png`, `run2-test-log.txt` |
| Map draws in airplane mode, folded | Pass. 0 tile reads failed. | `run1-folded-airplane-mode.png`, `run2-folded-airplane-mode.png` |
| Clean install of the final APK | Pass | `run2-test-log.txt` |
| Frame rate on the emulator | 26.6 to 40.8 frames per second. See below. | `run2-test-log.txt` for run 2 |

The run 2 screenshots are dimmed by an Android "System UI isn't responding" dialog. The emulator's own interface stalled because the laptop was out of memory. The map is visible beneath the dialog. The run 1 frame numbers were read from the screen and the console and have no log file.

Two things the proof found are now decisions:

1. **Android's web view mishandles partial reads of local files.** A request for a slice of a file fails unless the slice starts at the beginning of the file, and the web view cannot address a file past 2 GB. Capacitor's standard file server has the same limit. I solved it by putting the offset and length in the request address. No archive in Phase 1 is near 2 GB. This matters later, when sharper imagery or more counties make archives larger. I have not tested a file that large.
2. **The web view reports "online" in airplane mode.** Both airplane mode screenshots show it. The app will ask Android for the true network state.

**One finding I got wrong and corrected.** In run 1, screenshots taken the instant the frame test ended showed the map on part of the screen and flat gray on the rest. I first took that for a failure to resize after a fold. Run 2 showed the same gray on the unfolded screen with no fold, and it filled in by itself five seconds later. It was map tiles still loading on an emulator starved of memory. There is no evidence of a fold problem. The pair of screenshots is `run2-unfolded-end-of-frame-test.png` and `run2-unfolded-5s-later.png`.

### Frame rate: not yet measured on the real phone

The frame test is a fixed 15 second camera tour that pans, zooms and rotates.

| Run | Screen | Average | Worst 1 percent of frames | Frames slower than 33 ms |
|---|---|---|---|---|
| 1 | Unfolded | 26.6 fps | 6.7 fps | 155 of 405 |
| 1 | Folded | 27.3 fps | 7.6 fps | 248 of 417 |
| 1, second emulator start | Unfolded | 38.5 fps | 12.0 fps | 115 of 587 |
| 2 | Unfolded | 29.4 fps | 7.5 fps | 135 of 450 |
| 2 | Folded | 40.8 fps | 13.3 fps | 147 of 616 |

These numbers say little about the Z Fold 5. The emulator translates graphics calls through the laptop, and the laptop had between 0.1 and 0.4 GB of free memory during the tests. The same test on the same screen gave 26.6 and 38.5 in different runs.

The test also covers the base map only. Aerial imagery and overlays are not in it.

**This is the main open risk in the engine decision.** I have not measured the real phone and will not guess. The test APK is built so you can measure it in two minutes. It is question 3.

## Data sources

Every candidate in the brief was evaluated. The details are in `docs/DATA_SOURCES.md`.

| Layer | Source chosen | License | Size for both counties |
|---|---|---|---|
| Roads, water, woodland, place names | OpenStreetMap | Open Database License. Credit required. | About 17 MB, measured |
| County boundaries | US Census TIGER/Line 2026 | Public domain | Taken from an 83 MB national file |
| Aerial imagery | USDA NAIP, summer 2025, 0.6 m | Public domain | About 140 MB as map tiles, estimated, plus or minus 40 percent |
| Public land | USGS PAD-US 4.1, corrected with open local data | Public domain and Open Database License | Under 2 MB |
| Crop types | USDA Cropland Data Layer 2025 | Public domain | 5.5 MB, measured |
| Woodland | USFS tree canopy cover 2025 | Free to use | About 5.5 MB, estimated |
| Likely oak | LANDFIRE vegetation classes | Not confirmed yet | About 11 MB, estimated |
| Wind | National Weather Service | Public domain | Live |

Sources dropped: the Champaign County Forest Preserve District website (all rights reserved), the Illinois Nature Preserves boundaries (redistribution forbidden), the Illinois Recreational Access Program (no data is published), and three forest datasets that the research found unfit for woods this small.

**The base map tiles come by way of Protomaps.** Protomaps is an open source mapping project. It publishes a daily build of OpenStreetMap data for the whole planet, meant for reuse. The build scripts cut the two counties out of that build on this laptop. The app itself never contacts Protomaps. The brief says not to pull data from another product's servers. I read that rule as being about commercial hunting map products, not about an open source project that publishes open data. If you read it more strictly, I can build the tiles myself from a 346 MB OpenStreetMap file for Illinois instead. It is question 8.

Five findings you should know:

1. **There is better aerial imagery than NAIP, but no complete way to get it yet.** The State of Illinois flew 6 inch imagery with the leaves off between 2023 and 2025. Its metadata says it is public domain. Leaf-off imagery shows trails, creek bottoms and fence lines under the trees. NAIP is always flown in summer. The state offers no county download package. Its image service for Macon County allows downloads in small batches. Its service for most of Champaign County has downloads switched off. The reliable route is to ask the Illinois State Geological Survey for the two county image sets. It is question 5.
2. **Public land for deer and turkey hunters is scarce in these counties.** There is no federal land open to the public. There is no state-run deer or turkey hunting in either county. State hunting is pheasant and rabbit by lottery at two small habitat areas, one of which straddles the Ford County line. The Champaign County Forest Preserve District bans hunting. The Macon County Conservation District runs archery deer hunting by its own lottery at four sites, with a turkey allowed at three of them. This confirms the brief: the parcel layer is the most valuable layer.
3. **The state has a table of hunting rules by species for every state site, but it has no license.** It is exactly what the public land feature asks for. I will not use it without written permission from the Illinois Department of Natural Resources. Until then the app shows a short note for each managing body with a link to the rule. It is question 6.
4. **The oak layer will be weak.** No public dataset can tell an oak woodlot from a maple one at the size of the woods here. The layer will show reliably where the woods are, and mark "possible oak-hickory (modeled)" as a hint. The legend will say it is an estimate. The hint depends on a federal dataset whose license I could not find stated. I will confirm it before Step 5 or leave the hint out.
5. **The app will make three kinds of network request, and each tells a server something.** Map downloads tell GitHub which county was downloaded. The Macon County parcel lookup tells the county's map service, which is hosted by the company Esri, which area is being viewed and which parcel was tapped. The wind forecast tells the National Weather Service where the waypoint is. I will round that position to about 1 km, which the forecast's 2.5 km grid allows. No request carries a name, an account or a device identifier, and no waypoint, track or photo ever leaves the phone. The About screen will list these three in plain words. This is recorded as decision D21.

**Hunting units.** Illinois issues firearm deer, muzzleloader deer and spring turkey permits by county, and each is valid only in that county. Archery deer and fall archery turkey permits are statewide. So the county boundary is the hunting unit, and the app will say so. Both counties are open for firearm deer, archery deer, spring turkey and fall archery turkey. Both are closed to fall shotgun turkey. Both are in the Restricted Archery Zone, where only antlered deer may be taken from October 1 to October 31.

## Download sizes and hosting

- The full map data for both counties is an estimated 200 to 300 MB with NAIP imagery. It would be up to about 1 GB if the leaf-off imagery is added later.
- Building it needs under 3 GB of downloads in total. No step comes near the 50 GB limit.
- Map data will not be inside the APK. The user downloads a county or an area.
- Hosting plan: files attached to a GitHub release of the project. GitHub's documentation says each file must be under 2 GiB, with no limit on total size or bandwidth.
- I tested one partial download from a GitHub release file and it worked. Pause, resume and area downloads all depend on partial downloads. I have not tested many of them in a row. I will test that at the start of Step 2, before the download design is fixed.
- Running cost: zero.
- County parcel data is never hosted anywhere.

## The machine

- Already installed: Flutter, JDK 17, the Android SDK, Node, Docker, git and WSL2 with Ubuntu. There were no GIS tools.
- I installed, without changing any system setting: JDK 21 and the tile archive tool inside the project folder, and an Android 16 emulator image with a foldable virtual device.
- Hardware acceleration for the emulator already works. No Windows feature needed turning on.
- GDAL and tippecanoe, the GIS tools, are available as standard Ubuntu packages. I will install them in WSL at the start of Step 1.
- **Memory is a real limit.** The laptop had under 1 GB free when I started and 0.1 GB free with the emulator running. The emulator's own interface stalled in every session. Closing Chrome and the ChatGPT app during test sessions would help. Testing on the real phone over USB would help more.

## The agent team

The five agent files are in `.claude/agents/`: data-engineer, app-developer and ux-designer on Opus 5.5, qa-tester on Sonnet 5.5, and step-reviewer on Fable 5.2. Claude Code loads a new agents folder only when a session starts, so they become available in the next session.

In Step 0, two Opus research agents did the data source survey in parallel, using about 540,000 tokens between them. I did the county terms, the engine test and the decisions myself. A Fable reviewer with fresh context then checked this report against the repository, using about 180,000 tokens. It found about a dozen problems, including the wrong fold finding, the Macon County footer I had left out, and missing evidence files. All are corrected in this version. I propose no change to the mix.

## Documents written

- `docs/DECISIONS.md`: twenty-one decisions with reasons.
- `docs/DATA_SOURCES.md`: every source, its license and its status.
- `docs/STEP_PLAN.md`: the plan for Steps 1 to 5 with their checks.
- `docs/STATUS.md`: where the work stands, for a new session.
- `docs/research/`: the detailed evidence behind the decisions.
- `docs/evidence/step0/`: the screenshots and the test log.
- `CLAUDE.md`, `LICENSE`, `NOTICE`: project rules, and the GPL 3 license with the same additional terms as WoodLogic.

Everything is committed to the local git repository. Nothing is pushed.

## Known gaps

- The frame rate on the real phone is unmeasured.
- Tiles took several seconds to appear after a fast camera move on the emulator. That is probably the emulator, but it needs measuring on the phone too.
- No archive over 2 GB has been tested.
- Many partial downloads in a row from GitHub are untested.
- The complete NAIP county images are on a USDA file sharing site with no direct link. Getting them may need one manual download.
- The test app is throwaway code with template leftovers. It is deleted in Step 1.

## Questions for you

1. **Champaign County parcels.** The terms do not allow the live lookup. My recommendation is to ship Champaign County without parcels until the consortium answers your request. Do you agree? Please tell me when either county replies.
2. **Macon County parcels.** Are you content to run the live lookup on the basis that the county has posted no terms, while your permission request is still open? And may the app save tapped parcels on the phone for Macon County, as the brief describes?
3. **Frame rate on your Z Fold 5.** Please install `C:\bart\MapApp\build\step0-map-proof-debug.apk`, open it, and tap "Run frame test" once unfolded and once folded. Each run takes 15 seconds. Send me the "frames" line from the bottom panel each time. As a rule of thumb of my own, an average under about 45 frames per second would make me reconsider the engine in Step 1, before anything is built on it.
4. **First push to GitHub.** Step 2 needs the public repository, because the map data is hosted as release files. May I create `github.com/bartbasi/MapApp` and push when Step 1 is done? Three things would become public and you may want a say in each: the brief file, which names you and your equipment; the project rules in `CLAUDE.md`; and these reports, which set out my reading of both counties' terms. I can keep any of them out of the public repository. Is "MapApp" the repository name you want while the title is a working one?
5. **Leaf-off imagery.** Will you ask the Illinois State Geological Survey for the 2025 county image sets for Champaign and Macon, or shall I draft the email for you to send? Until there is an answer, I will build the aerial view from NAIP.
6. **State hunting table.** Will you ask the Illinois Department of Natural Resources for written permission to use its site boundaries and its hunting table by species, or shall I draft that email too?
7. **Feedback address and package ID.** I reused the WoodLogic feedback address in `NOTICE`. I plan to use the package ID `io.github.bartbasi.mapapp`, following WoodLogic. The package ID cannot change after a store release. Are both right?
8. **Protomaps.** Are you content for the build scripts to take the OpenStreetMap base map tiles from the Protomaps public build, as described above? The alternative is to build them here from the Illinois OpenStreetMap file, which is more work and gives the same data.

Step 1 can start without answers to questions 4 to 7. Question 8 changes one build script. Question 3 matters to Step 1 only if the frame rate is poor.
