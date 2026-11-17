# Step 2 checks on the Android emulator

Run on the emulator `mapapp_fold` (Android 16, Pixel Fold profile), folded (1080 x 2092) and unfolded (2208 x 1840). Every screenshot here comes from the masked build `build/step2-masked-debug.apk`: every owner name on screen reads "OWNER NAME". Parcels are named by parcel ID only. The real-name build `build/step2-debug.apk` was used for one thing only (the owner comparison in check 3b) and nothing from it was saved.

Readout text was also read from the WebView through remote debugging, so the distances below are the app's own text. `route_follow_on_readout_log.txt` and `route_follow_off_readout_log.txt` hold the readout text for each of the 42 fixes of the two route runs (masked build, no names).

Result: no crash, and every check ran except the poor-fix wording in check 7. Small problems are listed at the end.

## 1. Install and start: pass
The masked build installed and started unfolded and folded with no crash and no FATAL or AndroidRuntime line from the app. Logcat holds WebView cache noise on first start and one Capacitor console error (Defect 3). Map, Aerial and Hybrid draw folded and unfolded.
Screenshots: `t1_unfolded_start.png`, `t1_unfolded_aerial.png`, `t1_unfolded_hybrid.png`, `t1_folded_map.png`, `t1_folded_hybrid.png`.

## 2. Permission and marker: pass
- 2a. The first tap on the locate button showed the system dialog "Allow MapApp to access this device's location?" (`t2a_permission_dialog.png`). After "While using the app" the marker appeared at the emulator fix and the map centered on it (`t2a_allowed_marker_folded2.png`).
- 2b. After "Don't allow" the app says "MapApp is not allowed to use your location. To allow it, open the app settings, choose Permissions, then Location, then Allow only while using the app. Then tap the position button again." with an "Open app settings" button (`t2b_denied_message.png`). Tapping it opened the system settings page for the app (window focus `com.android.settings`, `t2b_open_settings_result.png`). `SystemSettingsPlugin` works. Denied twice (once after `pm clear`, once after `pm revoke`) with the same message.
- 2c. Redone in the second session, because the first screenshots did not show the message. With location off system-wide and the app freshly started, a tap on the position button shows "Location is switched off on this phone. Turn on Location in the phone's quick settings. Then tap the position button again." with an "Open Location settings" button (`v2_C1_location_off_message.png`). Tapping the button opened the system Location page, with "Use location" switched off (window `Settings$LocationSettingsActivity`, `v2_C1_open_location_settings_result.png`). Pass. Note: if the app is already tracking when location is switched off, the button does not show this message; the app shows the stale card instead (check 7).
- 2d. The "My position" switch turns the marker and readout off (`t2d_position_switch_off_verify.png`) and on again (`t2d_position_on_again_verify.png`). After switching on, the marker and readout took 3 to 4 s to return with one fix a second (Defect 2).

## 3. Marker follows a replayed route: pass
Route from the readout README: 42 fixes, one a second, -89.06050 to -89.06296 along latitude 39.9155.
- Follow on (`r1_follow_on_start.png`, `_middle.png`, `_end.png`): the marker stayed in view and the map moved under it.
- Follow off, after a swipe (`r2_after_pan.png`, `r2_follow_off_start.png`, `_i10.png`, `_middle.png`, `_i32.png`, `_end.png`): the map stood still and the marker moved west along the route; by the end it was off the west edge of the screen (the connector to the property line still shows).
- Marker against the line: a fix at -89.061662, 39.9155 puts the marker on the property line (`r3_marker_on_line_fix.png`: marker centre x 557, line x 558 on a view 1033 wide).
- I did not compare a recorded track with the route by point count and time gap, because the app keeps no track in this step. The readout log has one line per fix.

## 3b. Readout across a property line: pass
Accuracy reported by the emulator: 5 m ("GPS accurate to about 16 ft (5 m)"). The near-line band is 5 + 3 = 8 m each side, which is 0.000094 degrees of longitude here: -89.061568 to -89.061756.
- East of the line the readout names parcel 08-06-23-100-005. West of it, parcel 08-06-23-100-007. In the band it says "On or near a property line. GPS cannot tell which side." and names both parcels.
- State changes in the replay: inside (12 m) at -89.06152, near-line at -89.06158, -89.06164 and -89.06170, inside (9 m) at -89.06176. Expected edges -89.061568 and -89.061756. The replay step is 0.00006 (5 m), so both changes fall in the right step. Agrees.

| Point | Readout showed | Expected | Within 2 m |
|---|---|---|---|
| -89.0609, 39.9155 | 213 ft (65 m) to the W, parcel 08-06-23-100-005 | 65.0 m W | yes |
| -89.0615, 39.9155 | 45 ft (14 m) to the W, parcel 08-06-23-100-005 | 13.7 m W | yes |
| -89.0625, 39.9155 | 236 ft (72 m) to the E, parcel 08-06-23-100-007 | 71.8 m E | yes |
| -89.0605, 39.91866 (road) | Not in a parcel, 32 ft (10 m) to the N | 9.8 m, no parcel | yes |

The text rounds to whole meters, so each is within 0.5 m. Road point screenshot: `t3b_road_point.png`.
- Owner comparison with the real-name build at -89.0609, 39.9155: the owner line of the readout against the `owner` value of parcel 08-06-23-100-005 in `data/build/il-macon/parcels.pmtiles`: **match**. The masked build was reinstalled afterwards. Nothing with the name was kept.
- Sampling note: I read the readout one second after each fix, and a few rows lag one fix (for example -89.06236 repeats the reading of -89.06230). That is my sampling.

## 4. Airplane mode: pass
Airplane mode on (`airplane_mode_on` = 1, `ping` says "Network is unreachable", "Active default network: none"). App force-stopped and restarted. At -88.9548, 39.8403 (Decatur) the outlines draw, the readout works, and a tap on a parcel opens the panel with owner (masked), 0.9 acres, parcel ID 04-12-15-431-006, county Macon County, Illinois, data date October 28, 2026 and "Not a legal survey" (`t5_z17_parcel_highlight_panel.png`).
Network: the WebView's resource list after the session has 250 entries, all from `https://localhost` (bundled files and tiles). Logcat has no UnknownHost, ERR_ or connection failure from the app. The only outside address in logcat is the keyboard's own `gstatic.com` download (another process, not the app). No parcel request left the phone.

## 5. Parcel layer and tap panel: pass
- Outlines draw in Map, Aerial and Hybrid at about zoom 14, 16 and 19, folded and unfolded: `t5_folded_z{14,16,19}_{map,aerial,hybrid}.png`, `t5_unfolded_z{14,16,19}_{map,aerial,hybrid}.png`. I set the zoom by mouse wheel in the WebView and read it from the scale bar, so each is about the zoom named (the folded "z14" set is about 15.3). At zoom 19 the aerial imagery is blurry, which is the imagery's own resolution.
- "Property lines" switch off: outlines vanish and a tap opens no parcel panel (`t5_layers_property_off_panel.png`, `t5_property_off_tap_no_panel.png`). Switched on again, a tap opens the panel.
- A tap highlights the parcel (yellow border) and opens the panel; closing the panel clears the yellow border (`t5_z17_parcel_highlight_panel.png`, `t5_z17_after_close_highlight_cleared.png`). The dashed amber line that remains is the readout's mark for the nearest property line to the phone, not the tapped parcel.
- A tap on a road: "Not in a parcel. This is often a road or a railway." (`t5_tap_on_road_street.png`).
- The panel carries "From county tax records. Not a legal survey."
- Sources and licenses lists "Property lines, Macon County, Illinois GIS, tax parcels", data date October 28, 2026, with the note that it is not a legal survey (`t5_sources_parcel_entry.png`, `t5_sources_licenses_top.png`).

## 6. Champaign County: pass
Fix at -88.2072, 40.1106: the readout says "No property lines for this place yet. Property lines are installed for Macon County only." (`t6_urbana_readout.png`). A map tap there gives the same sentence in the panel and nothing about parcels (`t6_urbana_map_tap.png`, `t6_urbana_zoomed_out.png`).

## 7. States of the readout: pass, poor-fix wording not tested
- Stale: after location was switched off the readout was still current at 8 s and was marked stale at 13 s: "Last position 13 s ago. The GPS has not reported since. The marker is gray until it does." and "From the last GPS position." (`t7_stale_after_location_off_16s.png`).
- Expanded (tap the card): the parcel across the line (08-06-23-100-007), "Parcel 08-06-23-100-005: 97.0 acres.", "Macon County, Illinois. County data of October 28, 2026.", "From county tax records. Not a legal survey." (`t7_readout_expanded.png`, `t9_unfolded_readout_expanded.png`).
- Poor fix (over 50 m): not tested. I sent NMEA sentences with HDOP 25 through `adb emu geo nmea`, and the app kept reporting 5 m accuracy.

## 8. Hard data cases: pass
Places found by a script over the parcel archive, named by parcel ID:
The card texts quoted here were read through the WebView debug port. Which screenshot shows what is stated for each line.
- Stack of 14 parcels on one outline, 07-07-27-132-005 to 07-07-27-132-018 (about -88.96596, 39.902634): the panel shows the first parcel, then "13 more parcels at this spot" with each ID and "acreage not listed". The readout says "and 13 more parcels at this spot". `t8_stack14_tap.png` shows the panel with the first parcel and the first entries of the list; the full list text was read through the debug port, no screenshot. `t8_stack14_readout.png` was taken with the panel closed.
- No acreage, parcel 13-10-11-178-001 (about -89.172337, 39.855717): the panel reads "Acreage not listed in the county record" (`t8_noacre_tap.png`). Retake of the readout with the panel closed: `v2_C2_no_acreage_parcel.png` shows the card "On or near a property line. GPS cannot tell which side." naming 13-10-11-128-001 and 13-10-11-128-002, because the spot I used is on a line between two parcels in the same row, not inside 13-10-11-178-001. So the retake shows a clear card but not the no-acreage parcel itself; the no-acreage wording is shown by `t8_noacre_tap.png`.
- A parcel inside another: 07-07-22-226-008 (8.5 acres) inside 07-07-22-226-006 (41.1 acres): the second is listed as "1 more parcel at this spot" (`t8_inside_tap.png`). The readout card with the panel closed is in the second session, check B5 (`v2_B5_parcel_inside_parcel.png`, `v2_B5_card_opened.png`).
- Multipart parcel 10-02-34-400-015, 2.9 acres, shows normally (`t8_hole_tap.png`). I could not tell on screen whether it also has a hole.
- Blank-ID strip (about -89.195135, 39.857806): the readout and a tap both say "Not in a parcel". Nothing is shown as a named parcel. Retake with the panel closed: `v2_C2_blank_id_strip.png` ("Not in a parcel. This is often a road, a railway or water. Nearest property line 67 ft (20 m) to the S"). The earlier tap screenshot is `t8_blankid_tap_retry.png`.
- The 101-parcel stack was not tried.

The screenshots `t8_blankid_readout.png`, `t8_inside_readout.png` and `t8_noacre_readout.png` were removed: each showed a leftover tap panel covering the readout. The three `t2c_` screenshots were removed because they did not show the "Location is switched off" message.

## Where this README quotes text that no screenshot shows
Read through the debug port, no screenshot: the per-fix readout texts of the two route runs (the two log files hold them), the four-point table in check 3b except the road point, the stale card texts in check 7 other than what `v2_D1_return_from_background_0.8s.png` and `v2_D2_after_5min_no_fix.png` show, the expanded readout text in check 7 where it runs past a screenshot, the Sources text in check 5 other than `t5_sources_parcel_entry.png`, and the full list of the 14-parcel stack. Text that a kept screenshot does show: the permission dialog (`t2a_permission_dialog.png`), the denied message (`t2b_denied_message.png`), the Urbana card (`t6_urbana_readout.png`), the road point card (`t3b_road_point.png`) and the expanded card (`t7_readout_expanded.png`).

## 9. Folded and unfolded layout: pass
- Folded: the readout card, locate button, scale bar and credit line do not overlap one another. The readout does not cover the marker while following (the marker stays above the card, also with the card expanded: `t7_readout_expanded.png`). With the tap panel (bottom sheet) open, the sheet covers most of the readout card; only its top two lines show (`t5_z17_parcel_highlight_panel.png`).
- Unfolded: the tap panel is a side panel on the right; the map, readout, locate button, scale bar and credit line stay clear of it (`t9_unfolded_following_with_side_panel_open.png`, `t9_unfolded_readout_expanded.png`, `t5_unfolded_z16_hybrid.png`).
- Folding and unfolding while following, with a panel open: marker, readout and panel carried over in both directions (`t9_folded_after_fold_following.png`, `t9_unfolded_following_with_side_panel_open.png`); the sheet became the side panel and back.
- Rotation: a two-finger rotate sent through the WebView turned the map, the heading wedge turned with it and a compass button appeared under the Layers button (`t9_rotated_map_folded.png`). Not tried with real fingers.

## 10. Battery and noise: pass
In the foreground the app holds one location request (BALANCED, 1 s). After the Home button `dumpsys location` shows that request as `{bg, na}` and `(inactive)`, and the app logged no fixes in 6 s in the background. The manifest has fine and coarse location only, no background location.

## Defects found (all small)
- Defect 1. On the folded screen the bottom sheet covers most of the readout card while a tap panel is open.
- Defect 2. After the "My position" switch is turned off and on, the marker and readout take 3 to 4 s to return.
- Defect 3. Console error "Error injecting safe area CSS: TypeError: Cannot read properties of null (reading 'style')" at start (Capacitor/Console, line 6), seen in logcat. No visible effect.
- Defect 4. With location off system-wide, logcat shows the Geolocation plugin's `checkPermissions` rejecting with "Location services are not enabled." (OS-PLUG-GLOC-0007). The app shows the right message, so this is noise only.
- Test note, not an app defect: after `adb emu fold` the cover display shows the lock screen and needs a swipe up before the app can be seen.

## Addendum: the run with the network up

The whole session above ran with the emulator in airplane mode. It was already on when the session began, left over from Step 1. So checks 1 to 10 show the app with no network, which is the case that matters in the field. They do not show the location path a phone takes when it has a network. That path was run afterwards, by the lead, on the same masked build.

Setup: airplane mode off, wifi connected, a ping to the internet answered. The app's data was cleared, so the permission dialog came up again.

- The first tap on the locate button showed the system dialog (`n1_network_up_permission_dialog.png`). "While using the app" was chosen. No other dialog appeared.
- With the network up the app's location request is on the phone's fused provider at HIGH_ACCURACY, every 1 s, and the fused provider in turn runs the GPS at HIGH_ACCURACY. These are the lines from `dumpsys location`:
  - `fused provider +registration 10216/io.github.bartbasi.mapapp -> Request[@+1s0ms HIGH_ACCURACY, minUpdateInterval=+500ms]`
  - `gps provider +registration 10145/com.google.android.gms[fused_location_provider] -> Request[@+1s0ms HIGH_ACCURACY, hiddenFromAppOps, WorkSource{10216 io.github.bartbasi.mapapp}]`
- In airplane mode the same build registers on the GPS provider directly. Its request is labelled BALANCED there, which is what check 10 recorded. The label has no effect on a GPS-only request: the fix is the GPS fix either way. The location library chooses this path itself when there is no network.
- At (-89.0609, 39.9155) the readout said parcel 08-06-23-100-005, property line 213 ft (65 m) to the W, GPS accurate to about 16 ft (5 m) (`n2_network_up_readout_east.png`). At (-89.0625, 39.9155) it said parcel 08-06-23-100-007, 235 ft (72 m) to the E (`n3_network_up_readout_west.png`). Both match the expected 65.0 m and 71.8 m.
- Right after a jump of 50 m between two fixes, the fused provider reported a position about 4 m short of the new fix for a second or two (68 m where 72 m was expected). With the fix held steady it read 72 m. This is the phone's own smoothing of a jump that a walking person cannot make, not the app.
- Network use by the app with the network up: none. The phone's per-app traffic table (`dumpsys netstats`) had no entry for the app's user ID after the session.
- After the Home button the request showed as `{bg, na}` and `(inactive)`, as in check 10.

Not run with the network up: the deny path, the location-off path and the hard data cases. They do not depend on the network.


## Second session, after the review

Run after the lead rebuilt both builds at 15:07. Masked build `build/step2-masked-debug.apk`, installed with `adb install -r`, then `pm clear`. Folded screen. The session started with `airplane_mode_on` = 0 and wifi connected (ping answered). Everything ran with the network up, except `v2_B1_airplane_outside_county.png`, which ran in airplane mode (`airplane_mode_on` = 1, "Active default network: none") and was turned off again afterwards. Each B fix was held by resending it once a second for 6 s before the card was read. Card texts were read through the WebView debug port.

### A. Approximate location: pass
- A1 pass. The dialog offered Precise and Approximate (`v2_A1_dialog_approximate_selected.png`). After "Approximate" and "While using the app" the app showed the title "MapApp needs your precise location." and the text "This phone gives MapApp only an approximate location, which can be off by a mile or more. That is too rough to show you against the property lines. Open the app settings, choose Permissions, then Location, and turn on Use precise location. Then tap the position button again." with an "Open app settings" button, no marker and no readout card (`v2_A1_approximate_message.png`).
- A2 pass. The second tap on the position button brought up the Android dialog "Change MapApp's location access from approximate to precise?" with "Change to precise location", "Only this time" and "Keep approximate location" (`v2_A2_tap2.png`). I chose "Keep approximate location". The app went back to the same "MapApp needs your precise location." message. Three further taps showed no dialog: the app stayed in front each time with the same message and no marker (`v2_A2_tap5_state.png`). So the user sees the change-to-precise dialog once and after that only the message.
- A3 pass. "Open app settings" opened the system settings for the app (I used the app button, then by mistake reached an Uninstall prompt on the App info page and cancelled it). In Permissions, Location, I turned on "Use precise location", went back to the app and tapped the position button. The marker and the readout started: "Property line 213 ft (65 m) to the W, Parcel 08-06-23-100-005" (`v2_A3_marker_and_readout_after_precise.png`). My screenshots of the system Permissions pages were deleted by mistake during cleanup, so those pages are not in the evidence folder. The package state below is.
- A4. `dumpsys package` after A1: ACCESS_FINE_LOCATION granted=false, ACCESS_COARSE_LOCATION granted=true. After A3: both granted=true. Geolocation plugin lines in logcat: `checkPermissions` then `requestPermissions` with {"permissions":["location"]} at the first tap, and `checkPermissions` then `watchPosition` with {"enableHighAccuracy":true,"maximumAge":1000,"timeout":30000,...} after A3. No plugin error line.

### B. The county edge: pass
| Check | Fix | Card text | Screenshot |
|---|---|---|---|
| B1 | -89.14271, 39.65290 | "No property lines for this place yet. Property lines are installed for Macon County only." A map tap gave the same two sentences. "Not in a parcel" does not appear. | `v2_B1_outside_county.png`, `v2_B1_map_tap.png` |
| B1, airplane mode | same | the same two sentences, and the same after a map tap | `v2_B1_airplane_outside_county.png` |
| B2 | -89.13400, 39.65550 | "OWNER NAME / Property line 98 ft (30 m) to the S / Parcel 15-19-18-300-002 / GPS accurate to about 16 ft (5 m)". Opened: "No property lines are installed across that line. Property lines are installed for Macon County only. Parcel 15-19-18-300-002: 79.6 acres. Macon County, Illinois. County data of October 28, 2026. From county tax records. Not a legal survey." | `v2_B2_inside_edge_parcel.png`, `v2_B2_card_opened.png` |
| B3 | -89.13400, 39.65510 | "No property lines for this place yet. Property lines are installed for Macon County only." (the expected no-data message at 5 m accuracy) | `v2_B3_just_outside_edge.png` |
| B4 | -88.93900, 39.81900 | "Not in a parcel. This is often a road, a railway or water. No property line within 492 ft (150 m). GPS accurate to about 16 ft (5 m)." Not the no-data message. | `v2_B4_lake_decatur.png` |
| B5 | -88.96018, 39.91608 | "OWNER NAME / Property line 33 ft (10 m) to the N / and 1 more parcel at this spot / Parcel 07-07-22-226-008". Opened: "Across that line: OWNER NAME, parcel 07-07-22-226-006. Parcel 07-07-22-226-008: 8.5 acres. ... Also at this spot (1): OWNER NAME, parcel 07-07-22-226-006." It does not say "no parcel". | `v2_B5_parcel_inside_parcel.png`, `v2_B5_card_opened.png` |

### C. Repairs
- C1 done, see check 2c above.
- C2 done, see check 8 above. The no-acreage retake did not land inside parcel 13-10-11-178-001 and shows a different card (explained in check 8).
- C3 done, see "Where this README quotes text that no screenshot shows" above.

### D. Other fixes
- D1 pass. A fix was sent and the card was current. Home was pressed, 15 s passed with no new fix commands, and the app was brought back. At 0.8 s after the return the marker was already gray and the card said "Last position 15 s ago. The GPS has not reported since. The marker is gray until it does." with the readout grayed and "From the last GPS position." (`v2_D1_return_from_background_0.8s.png`).
- D2 pass, with a condition on how it was run. The emulator keeps repeating the last fix by itself, so with the app in the foreground and no new `geo fix` command the card stayed current for 6 minutes (`v2_D2_before_current_after_6min_of_no_new_fix_commands.png`). To stop the fixes I switched location off system-wide at 15:22:36. The card then showed "Last position N min ago" with the old parcel grayed ("From the last GPS position.") through "Last position 4 min ago" at 4 min 50 s. At 5 min 12 s it said "No current position. The parcel and the distance to the line show again when the GPS reports." and named no parcel or distance (`v2_D2_after_5min_no_fix.png`).
- D3 pass. The Macon County parcels entry in Sources and licenses has Source "Macon County, Illinois GIS, tax parcels", License "Used with Macon County's permission, as stated by the project owner on 2026-11-17. Not an open license.", the credit, and the data date October 28, 2026. No sentence about publishing on a public host and no "D25" in the screen text (checked through the debug port: no match for "D25", "public host" or "not to be published") (`v2_D3_sources_parcels_entry.png`).
- D4 pass. (-89.0609, 39.9155): "Property line 213 ft (65 m) to the W, Parcel 08-06-23-100-005" (`v2_D4_east_of_line.png`). (-89.06166, 39.9155): "On or near a property line. GPS cannot tell which side." naming 08-06-23-100-005 and 08-06-23-100-007 (`v2_D4_on_line.png`). (-89.0625, 39.9155): "Property line 234 ft (71 m) to the E, Parcel 08-06-23-100-007" (`v2_D4_west_of_line.png`). The expected value is 71.8 m, so the 71 m shown is within 1 m.
- D5 done. `network-use.txt`: the WebView resource list holds 250 entries (the browser's cap), all `https://localhost`. The app's user ID 10216 has no row in `mAppUidStatsMap` after a session with the network up. The only other mention is a counter-set line with no byte counts.

### Notes
- The emulator replays its last fix once a second without being asked, so "stop sending fixes" is not possible by silence. Silence needs location switched off. This is how D2 was run.
- The real-name build was not used in this session.
