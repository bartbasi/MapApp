# Step 2 report: position and property lines

Date: 2026-11-17. Written for Bart.

## Result

The app now shows where the phone is against the property lines, with no network. It works for Macon County. It does not work for Champaign County yet, because that county's parcel data sits behind a login.

- **Works:** a GPS marker with a locate button and a follow mode. Property lines for all of Macon County, 57,096 parcel records. A tap on a parcel shows the owner, the acreage, the parcel ID, the county and the date of the data. A readout card says which parcel the phone is in, and how far and which way the nearest property line is. Near a line it says so, and names the parcels on both sides.
- **Does not work:** Champaign County has no property lines. In Champaign County the app says "No property lines for this place yet."
- **Not yet known:** how the marker behaves on your phone outdoors. All testing so far was on the emulator, with positions I sent to it.
- **Held back:** I have not pushed this step to GitHub. The new screenshots show Macon County's parcel lines and parcel IDs, and I want your word on that first. It is question 3.
- **Needed from you:** connect your phone so I can install the build, then check the marker outdoors. Answer the seven questions at the end. The first one, about Champaign County, decides whether the app is useful where you live.

This step is not the Step 2 of your brief. You said the phone's position against the property lines comes first, so I built that now. Offline downloads moved to Step 3. Nothing in the brief was dropped.

No money was spent. No license was accepted. No county parcel file was committed, pushed or hosted. The parcel data is on this laptop and inside the two test builds only.

You wrote "Continue, everything is approved." I took that to cover the plan I had described: fix what the tests found, run the review, write this report, and push the code and documents. I did not take it to cover publishing the county parcel files. The independent review then pointed out that the screenshots also show county data, which I had not told you. So I held the push as well.

## What you will see on the phone

1. Tap the round button at the bottom right. The phone asks for the location permission. Leave "Precise" selected and choose "While using the app". If you choose "Approximate", the app says it needs your precise location and shows no marker.
2. A blue dot shows where the phone is. The pale circle around it is the phone's own estimate of its error. The map follows the dot until you move the map by hand. Tap the button again to follow again.
3. Zoom in. Property lines are bright yellow-green lines with a dark edge. They show from about the scale of a small town inward.
4. The card at the bottom left is the readout. It reads, for example: the owner, "Property line 213 ft (65 m) to the W", the parcel ID, and "GPS accurate to about 16 ft (5 m)". Tap the card to open it. It then also names the parcel across the line.
5. Near a line the card turns amber and reads "On or near a property line. GPS cannot tell which side." It names both parcels. The stretch of line beside you is drawn in amber and black stripes.
6. Tap any parcel to see its owner. The tapped parcel gets a yellow outline.

The card says "near a line" whenever the line is closer than the GPS accuracy plus 3 m (10 ft). The 3 m is my allowance for error in the county's lines. County lines are drawn for tax purposes, and nobody publishes how exact they are.

One thing to know about the accuracy figure. A phone's "accurate to 5 m" means the true position is inside that circle about two times in three. One time in three it is outside. Under trees the phone's figure is often too hopeful. So the app can still name the wrong side of a line when you stand close to its "near a line" band. The 3 m is the only margin against that. Question 7 asks whether you want it larger.

## The test builds

- `C:\bart\MapApp\build\step2-debug.apk` is the build for your phone. It is about 400 MB, because all map data is inside it. It shows the real owner names.
- `C:\bart\MapApp\build\step2-masked-debug.apk` is the same build with every owner shown as "OWNER NAME". I made it so that screenshots can be kept as evidence without a private person's name in them. It is not for you.

The outdoor check, once the build is on your phone:

1. **Anywhere, including at home in Champaign County:** stand at a spot you know exactly, such as a street corner or the corner of a building. Compare the blue dot with the Aerial view. Tell me how far off the dot is and what accuracy the card shows.
2. **In Macon County, if you get the chance:** walk across a property line you know, such as a fence line or a field edge. Tell me whether the card names the right parcel on each side, and where it changes to "On or near a property line".
3. Turn on airplane mode and do the same. Everything should still work.

## The checks of Step 2

| Check | Result |
|---|---|
| Twenty random parcels in each county match the county's own records for owner and outline | Macon County: pass, 20 of 20. Champaign County: not run, there is no data. |
| The position marker follows a replayed GPS route | Pass on the emulator, 42 positions one second apart. |
| In airplane mode the parcel outlines draw and a tap returns the owner | Pass on the emulator. |
| The parcel data holds no mailing address, site address or phone number, and none was requested | Pass. The archive holds four fields. All 111 requests to Macon County are logged. |
| On a route across a property line the readout names the right parcel on each side, and its distance agrees with the county's own outline within 2 m | Pass. The largest difference is 0.054 m. |
| You check the marker outdoors on your phone | Pass, by the owner's word on 2026-11-17, after this report was written. He said the blue dot was "spot on", the card showed 1 m accuracy, and the dot took "a few seconds" to appear. The build was the one with the new location plugin (D31). Walking across a known property line in Macon County has not been done. |

### Twenty random parcels

A script picked 20 parcels at random from the 56,717 parcel IDs in the Macon County archive. It fetched each one fresh from the county's service and compared it with the archive. The owner name matched on all 20, character for character. The acreage matched on all 20. The largest gap between the archive's outline and the county's outline was 0.068 m (under 3 inches). The script prints "match" or "differs" and never a name. The table is in `docs/evidence/step2/parcels/sample-il-macon.md`.

What this proves is that my build kept the county's data intact. It compares the archive with the same service it was built from. It does not prove the county's lines are right on the ground.

### The route across a property line

The route is in open farmland north of Warrensburg. It runs west along one line of latitude, from parcel 08-06-23-100-005 into parcel 08-06-23-100-007. The line between them is at longitude -89.061662.

On the emulator the readout named 08-06-23-100-005 east of the line and 08-06-23-100-007 west of it. The emulator reports 5 m accuracy, so the "near a line" band should be 8 m each side of the line. The card changed state within one 5 m step of where it should, on both sides.

Distance to the line at four points:

| Point (longitude, latitude) | The app's distance | From the county's own outline | On the phone screen |
|---|---|---|---|
| -89.0609, 39.9155 | 65.012 m | 65.064 m | 65 m to the W |
| -89.0615, 39.9155 | 13.713 m | 13.764 m | 14 m to the W |
| -89.0625, 39.9155 | 71.786 m | 71.734 m | 72 m to the E |
| -89.0605, 39.91866, on a road | 9.769 m | 9.715 m | Not in a parcel, 10 m to the N |

The third column is the independent measurement. A separate script fetched the three parcels from the county's service today and measured from those outlines. It did not read the app's data. The script is `pipeline/checks/parcels_line_distance.py` and its output is `docs/evidence/step2/parcels/line-distance-il-macon.md`.

In the last emulator session the third point showed 71 m once, where 72 m is expected. That is within the 2 m limit.

On the real-name build, the owner the readout showed at the first point was compared with the county record by a script that prints only "match" or "no match". It printed "match".

### Airplane mode and network use

With airplane mode on and the app restarted, the outlines drew in Decatur, a tap opened the parcel panel, and the readout worked.

With the network up, the app still used no network. The phone's per-app traffic table has no row for the app after a full session. The app's own list of what it loaded holds 250 entries, all from the phone itself. Both are saved in `docs/evidence/step2/emulator/network-use.txt`.

### What the parcel data holds

Each parcel record in the archive has exactly four fields: the parcel ID, the owner name, the acreage and the county. The pipeline asks the county's service for four named fields and refuses to write anything if the service returns more. It made 111 requests to Macon County in all: 64 to build the archive and 47 for the checks. The summary is in `docs/evidence/step2/parcels/requests-summary.md`.

## Champaign County: what was tried

You said the county allows a stored copy. I set a rule before looking: use the county's service only if it can be read without accepting its terms page and without a login.

The search made 18 requests. 15 of them went to the county GIS consortium's own servers, and 3 to Esri's public search. No form was submitted and no login was used. The result: the parcel layer answers "Token Required", which means it wants a login. The public map reads the parcels through a login the consortium stored for its own map. I did not use that route.

You should know one more thing. Every item on the consortium's server carries this license line: "Unauthorized use of this service and/or the data it contains is strictly prohibited and punishable by law." The 15 requests read only public listings and descriptions, not parcel data. Still, given that line, the county's permission should be in writing before any parcel data is taken. The full list of the 18 addresses is in `docs/research/county-parcel-terms.md`.

## What the independent review found

Before each report, a reviewer with no knowledge of the work checks it. This time it found real faults. All of the ones below are fixed, rebuilt and tested again on the emulator.

- **Just outside Macon County the card said "Not in a parcel. This is often a road or a railway."** This was wrong in a strip up to about 475 m wide around the whole county. A hunter on private land in the next county would have been told he was in no parcel. The parcel data now carries the county outline. Outside it the card says "No property lines for this place yet." This was the serious one.
- **Choosing "Approximate" location had no message.** The card told the user to move into the open, which was wrong advice. The app now says it needs precise location.
- **A fix with no accuracy was treated as a perfect fix.** Android reports an accuracy of 0 when it does not know. The app now treats that as a weak fix.
- **A very poor fix could still name a probable owner.** It no longer does.
- **A parcel that lies inside another parcel** showed "no parcel" across its line. It now names the outer parcel.
- **An old position kept naming a parcel with no time limit.** After 5 minutes without a fix the card now says "No current position."
- **A note meant for the project was shown to users** on the Sources screen. It is gone.
- **Three statements in the test notes were not backed by their screenshots.** The screenshots were retaken.

The step now has 327 unit tests, up from 280.

## What I got wrong or missed during the step

- **I missed the county edge.** I tested Champaign County, 60 km away, and never the edge of Macon County. The reviewer found it.
- **The first emulator session ran in airplane mode from start to finish.** Airplane mode was left on from Step 1 and nobody noticed. I ran the network path afterwards. With a network the phone asks for high accuracy GPS, and the readout gave the same distances.
- **My first reading of the map datum was wrong.** County data and GPS use slightly different reference frames. I first thought the county's lines needed a shift of over 1 m. Checking before changing anything showed the county's service already makes the conversion. The lines sit about 0.5 m (under 2 ft) east of where a perfect GPS would put them, and I left them alone.
- **A bug in the distance code was found and fixed early in the step.** A copy of a parcel in a neighbouring map tile could sit a few centimeters off. That hid a real line and made the readout say 7.29 m where the truth was 5.60 m.

## Known defects and limits

- **Nothing here has been seen on a real phone.** The emulator reports a steady 5 m fix. Real GPS under trees is the open question.
- **Within 25 m inside the county line, a road reads "No property lines for this place yet"** where "Not in a parcel" would be right. Along the county line the data cannot tell a Macon County road from the next county, so the app says the more cautious thing.
- **On the folded screen, an open parcel panel covers the readout card.** The marker and the striped line still show above the panel. Close the panel to see the card.
- **After "My position" is switched off and on, the marker takes 3 to 4 seconds to return.**
- **The 5 minute limit depends on the GPS going silent.** If a phone keeps handing the app the same old position as if it were new, the app cannot tell. I do not know yet whether your phone does that.
- **The largest stack of parcels was not tried on screen.** One outline in the county holds 101 parcel records. A stack of 14 was tried and listed correctly.
- **The tapped parcel and a tapped public land site use the same yellow outline.**
- **26,379 parcel records have no acreage in the county's data.** The app says "Acreage not listed in the county record". Most are town lots.
- **379 records have no parcel ID.** Most are road strips. The app never names them.
- **Two harmless error lines appear in the Android log.** Neither has a visible effect.

## Questions for you

1. **How will Champaign County hand over its parcel data?** I need one of two things from the county: a file of the parcels with the outline, parcel ID, acreage and owner name, or a login the county issues to you for this purpose. Please get the permission in writing, given the license line above. Until then Champaign County has no property lines.
2. **May the Macon County parcel file be published on GitHub for the app to download?** Step 3 makes the app download its map data. If you say yes, anyone can download the file, which holds every owner's name in the county. If you say no, parcel data stays inside the app build. Please answer this one by name.
3. **May the Step 2 screenshots go on GitHub?** About 140 of them show Macon County's parcel lines, parcel IDs and acreages for parts of Decatur and Warrensburg. Every owner name is masked. They are pictures, not data files, but they do show county data on a public page. If you say yes I push at once. If you say no I push the code and leave the pictures out.
4. **Did either county attach a condition to its permission?** For example a credit line, a limit on passing the data on, or a set way to receive it.
5. **May I replace the location plugin?** The plugin I used links a Google library that is not open source. That sits badly with the GPL, and it would keep the app out of the F-Droid store. I recommend a small plugin of our own that uses only Android's own GPS interface. It is about 200 lines. The cost is a slower first fix indoors. The reasoning is in DECISIONS D31.
6. **Should I ask the Illinois State Geological Survey for its leaf-off imagery, and the Illinois Department of Natural Resources for its hunting table?** These are carried over from Step 1.
7. **Is 3 m (10 ft) the right allowance for error in the county's lines?** A larger number makes the app say "on or near a line" more often, and makes a wrong side less likely.

Three smaller things for you to know before anything is pushed:

- Every commit message ends with a link to this Claude session. The link needs your login to open, but its address will be public.
- The test route for the marker is a made-up walk in south Urbana, with round coordinates near -88.200, 40.100. It was not chosen with your home in mind. Tell me if it is too close to it and I will move it.
- Two empty folders in the project folder, `BASI\PADX` and `C:SERSBART`, are strays from an earlier mistake of mine. They are safe to delete.

## Where things are

- The evidence is in `docs/evidence/step2/`: `parcels/` for the data checks, `readout/` and `parcels-ui/` for the desktop browser, `emulator/` for Android, `review-fixes/` for the fixes after the review, `position/` for the marker.
- The decisions of this step are D25 to D32 in `docs/DECISIONS.md`.
- The state of the work is in `docs/STATUS.md`.
