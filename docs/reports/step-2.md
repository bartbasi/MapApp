# Step 2 report: position and property lines

Date: 2026-11-17. Written for Bart.

## Result

The app now shows where the phone is against the property lines, with no network. It works for Macon County. It does not work for Champaign County yet, because I could not get that county's parcel data without a login.

- **Works:** a GPS marker with a locate button and a follow mode. Property lines for all of Macon County, 57,096 parcel records. A tap on a parcel shows the owner, the acreage, the parcel ID, the county and the date of the data. A readout card says which parcel the phone is in, and how far and which way the nearest property line is. Near a line it says so, and names the parcels on both sides.
- **Does not work:** Champaign County has no property lines. The county's map service answers "Token Required", which means it wants a login. I did not go around that. In Champaign County the app says "No property lines for this place yet."
- **Not yet known:** how the marker behaves on your phone outdoors. All testing so far was on the emulator, with positions I sent to it.
- **Needed from you:** connect your phone so I can install the build, then check the marker outdoors. Answer the five questions at the end. The first one, about Champaign County, decides whether the app is useful where you live.

This step is not the Step 2 of your brief. You said the phone's position against the property lines comes first, so I built that now. Offline downloads moved to Step 3. Nothing in the brief was dropped.

No money was spent. No license was accepted. No county parcel file was committed, pushed or hosted. The parcel data is on this laptop and inside the two test builds only.

You wrote "Continue, everything is approved." I took that to cover the plan I had described: fix what the tests found, run the review, write this report, and push the code and documents to GitHub. I did not take it to cover publishing the county parcel files. That needs you to say so by name. It is question 2.

## What you will see on the phone

1. Tap the round button at the bottom right. The phone asks for the location permission. Choose "While using the app".
2. A blue dot shows where the phone is. The pale circle around it is how exact the GPS says it is. The map follows the dot until you move the map by hand. Tap the button again to follow again.
3. Zoom in. Property lines are bright yellow-green lines with a dark edge. They show from about the scale of a small town inward.
4. The card at the bottom left is the readout. It reads, for example: the owner, "Property line 213 ft (65 m) to the W", the parcel ID, and "GPS accurate to about 16 ft (5 m)". Tap the card to open it. It then also names the parcel across the line.
5. Near a line the card turns amber and reads "On or near a property line. GPS cannot tell which side." It names both parcels. The stretch of line beside you is drawn in amber and black stripes.
6. Tap any parcel to see its owner. The tapped parcel gets a yellow outline.

The card says "near a line" whenever the line is closer than the GPS accuracy plus 3 m (10 ft). The 3 m is my allowance for error in the county's lines. County lines are drawn for tax purposes, and nobody publishes how exact they are. The 3 m is a judgement, and it is one number in the code that can be raised.

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
| The parcel data holds no mailing address, site address or phone number, and none was requested | Pass. The archive holds four fields. All 111 requests to the county are logged. |
| On a route across a property line the readout names the right parcel on each side, and its distance agrees with the county's own outline within 2 m | Pass. The largest difference is 0.06 m. |
| You check the marker outdoors on your phone | Open. Needs your phone. |

### Twenty random parcels

A script picked 20 parcels at random from the 56,718 parcel IDs in the Macon County archive. It fetched each one fresh from the county's service and compared it with the archive. The owner name matched on all 20, character for character. The acreage matched on all 20. The largest gap between the archive's outline and the county's outline was 0.068 m (under 3 inches). The script prints "match" or "differs" and never a name. The table is in `docs/evidence/step2/parcels/sample-il-macon.md`.

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

The middle column is the independent measurement. A separate script fetched the three parcels from the county's service today and measured from those outlines. It did not read the app's data. The script is `pipeline/checks/parcels_line_distance.py` and its output is `docs/evidence/step2/parcels/line-distance-il-macon.md`.

On the real-name build, the owner the readout showed at the first point was compared with the county record by a script that prints only "match" or "no match". It printed "match".

### Airplane mode

With airplane mode on and the app restarted, the outlines drew in Decatur, a tap opened the parcel panel, and the readout worked. Every one of the 250 requests the app made went to the phone itself. Nothing left the phone.

A second run with the network up showed the same: the phone's traffic table had no entry for the app.

### What the parcel data holds

Each parcel record in the archive has exactly four fields: the parcel ID, the owner name, the acreage and the county. The pipeline asks the county's service for four named fields and refuses to write anything if the service returns more. It made 111 requests to Macon County in all: 64 to build the archive and 47 for the checks. The summary is in `docs/evidence/step2/parcels/requests-summary.md`.

## What I got wrong or missed during the step

- **The first emulator session ran in airplane mode from start to finish.** Airplane mode was left on from Step 1 and nobody noticed. So the first session tested the no-network case only. That is the case that matters in the field, but a phone with a signal takes a different path to its GPS. I ran that path afterwards. With a network the phone asks for high accuracy GPS, and the readout gave the same distances.
- **My first reading of the map datum was wrong.** County data and GPS use slightly different reference frames. I first thought the county's lines needed a shift of over 1 m. Checking before changing anything showed the county's service already makes the conversion. The lines sit about 0.5 m (under 2 ft) east of where a perfect GPS would put them, and I left them alone. The details are in DECISIONS D29.
- **A real bug was found and fixed in the distance code.** A copy of a parcel in a neighbouring map tile could sit a few centimeters off. That hid a real line and made the readout say 7.29 m where the truth was 5.60 m. The code now reads each place from the one tile that owns it, and a test guards it.

## Known defects and limits

- **On the folded screen, an open parcel panel covers the readout card.** The marker and the striped line still show above the panel. Close the panel to see the card. I left this as it is, because lifting the card above the panel would leave almost no map.
- **After "My position" is switched off and on, the marker takes 3 to 4 seconds to return.**
- **The "GPS too weak" wording was not seen on Android.** I could not make the emulator report a poor fix. It was seen in the desktop browser and is covered by unit tests.
- **The largest stack of parcels was not tried on screen.** One outline in the county holds 101 parcel records. A stack of 14 was tried and listed correctly. The 101 case is covered by a unit test only.
- **Right after a sudden jump in position, the phone's own smoothing lags a second or two.** On the emulator a 50 m jump read 4 m short for a moment. A person walking cannot make such a jump.
- **The tapped parcel and a tapped public land site use the same yellow outline.** When both are selected you cannot tell which outline is which.
- **26,379 parcel records have no acreage in the county's data.** The app says "Acreage not listed in the county record" for them. Most are town lots.
- **379 records have no parcel ID.** Most are road strips. The app never names them, and treats a position inside one as not in a parcel.
- **Two harmless error lines appear in the Android log** at start and when location is switched off. Neither has a visible effect.
- **The location library is Google's fused location service when the phone has a network.** The app sends nothing anywhere. The phone's own location service may still use Wi-Fi and cell signals, as it does for every app, according to your phone's settings.

## Questions for you

1. **How will Champaign County hand over its parcel data?** Its map service needs a login, and its website terms forbid copying. You said the county allows a stored copy. I need one of two things from the county: a file of the parcels with the outline, parcel ID, acreage and owner name, or a login the county issues to you for this purpose. Please also keep the county's reply in writing. Until then Champaign County has no property lines.
2. **May the Macon County parcel file be published on GitHub for the app to download?** Step 3 makes the app download its map data. If you say yes, anyone can download the file, which holds every owner's name in the county. If you say no, parcel data stays inside the app build. Please answer this one by name.
3. **Did either county attach a condition to its permission?** For example a credit line, a limit on passing the data on, or a set way to receive it.
4. **Should I ask the Illinois State Geological Survey for its leaf-off imagery, and the Illinois Department of Natural Resources for its hunting table?** These are carried over from Step 1.
5. **Is 3 m (10 ft) the right allowance for error in the county's lines?** A larger number makes the app say "on or near a line" more often.

Two empty folders in the project folder, `BASI\PADX` and `C:SERSBART`, are strays from an earlier mistake of mine. They are safe to delete.

## Where things are

- The evidence is in `docs/evidence/step2/`: `parcels/` for the data checks, `readout/` and `parcels-ui/` for the desktop browser, `emulator/` for Android, `position/` for the marker.
- The decisions of this step are D25 to D30 in `docs/DECISIONS.md`.
- The state of the work is in `docs/STATUS.md`.
