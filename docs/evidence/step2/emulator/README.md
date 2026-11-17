# Step 2 checks on the Android emulator

Run on the emulator `mapapp_fold` (Android 16, Pixel Fold profile), folded (1080 x 2092) and unfolded (2208 x 1840). Every screenshot here comes from the masked build `build/step2-masked-debug.apk`: every owner name on screen reads "OWNER NAME". Parcels are named by parcel ID only. The real-name build `build/step2-debug.apk` was used for one thing only (the owner comparison in check 3b) and nothing from it was saved.

Readout text was also read from the WebView through remote debugging, so the distances below are the app's own text. `route_follow_on_readout_log.txt` and `route_follow_off_readout_log.txt` hold the readout text for each of the 42 fixes of the two route runs (masked build, no names).

Result: no crash, and every check ran except the poor-fix wording in check 7. Small problems are listed at the end.

## 1. Install and start: pass
The masked build installed and started unfolded and folded with no crash and no FATAL or AndroidRuntime line from the app. Logcat holds WebView cache noise on first start and one Capacitor console error (D3). Map, Aerial and Hybrid draw folded and unfolded.
Screenshots: `t1_unfolded_start.png`, `t1_unfolded_aerial.png`, `t1_unfolded_hybrid.png`, `t1_folded_map.png`, `t1_folded_hybrid.png`.

## 2. Permission and marker: pass
- 2a. The first tap on the locate button showed the system dialog "Allow MapApp to access this device's location?" (`t2a_permission_dialog.png`). After "While using the app" the marker appeared at the emulator fix and the map centered on it (`t2a_allowed_marker_folded2.png`).
- 2b. After "Don't allow" the app says "MapApp is not allowed to use your location. To allow it, open the app settings, choose Permissions, then Location, then Allow only while using the app. Then tap the position button again." with an "Open app settings" button (`t2b_denied_message.png`). Tapping it opened the system settings page for the app (window focus `com.android.settings`, `t2b_open_settings_result.png`). `SystemSettingsPlugin` works. Denied twice (once after `pm clear`, once after `pm revoke`) with the same message.
- 2c. With location off system-wide the app says "Location is switched off on this phone. Turn on Location in the phone's quick settings. Then tap the position button again." with an "Open Location settings" button. It was unchanged 12 s later (`t2c_location_off_after_tap.png`, `t2c_location_off_later.png`). I did not tap "Open Location settings".
- 2d. The "My position" switch turns the marker and readout off (`t2d_position_switch_off_verify.png`) and on again (`t2d_position_on_again_verify.png`). After switching on, the marker and readout took 3 to 4 s to return with one fix a second (D2).

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
- Stack of 14 parcels on one outline, 07-07-27-132-005 to 07-07-27-132-018 (about -88.96596, 39.902634): the panel shows the first parcel, then "13 more parcels at this spot" with each ID and "acreage not listed". The readout says "and 13 more parcels at this spot" (`t8_stack14_tap.png`, `t8_stack14_readout.png`).
- No acreage, parcel 13-10-11-178-001 (about -89.172337, 39.855717): the panel reads "Acreage not listed in the county record" (`t8_noacre_tap.png`).
- A parcel inside another: 07-07-22-226-008 (8.5 acres) inside 07-07-22-226-006 (41.1 acres): the second is listed as "1 more parcel at this spot" (`t8_inside_tap.png`).
- Multipart parcel 10-02-34-400-015, 2.9 acres, shows normally (`t8_hole_tap.png`). I could not tell on screen whether it also has a hole.
- Blank-ID strip (about -89.195135, 39.857806): the readout and a tap both say "Not in a parcel. This is often a road or a railway." Nothing is shown as a named parcel (`t8_blankid_readout.png`, `t8_blankid_tap_retry.png`).
- The 101-parcel stack was not tried.

## 9. Folded and unfolded layout: pass
- Folded: the readout card, locate button, scale bar and credit line do not overlap one another. The readout does not cover the marker while following (the marker stays above the card, also with the card expanded: `t7_readout_expanded.png`). With the tap panel (bottom sheet) open, the sheet covers most of the readout card; only its top two lines show (`t5_z17_parcel_highlight_panel.png`).
- Unfolded: the tap panel is a side panel on the right; the map, readout, locate button, scale bar and credit line stay clear of it (`t9_unfolded_following_with_side_panel_open.png`, `t9_unfolded_readout_expanded.png`, `t5_unfolded_z16_hybrid.png`).
- Folding and unfolding while following, with a panel open: marker, readout and panel carried over in both directions (`t9_folded_after_fold_following.png`, `t9_unfolded_following_with_side_panel_open.png`); the sheet became the side panel and back.
- Rotation: a two-finger rotate sent through the WebView turned the map, the heading wedge turned with it and a compass button appeared under the Layers button (`t9_rotated_map_folded.png`). Not tried with real fingers.

## 10. Battery and noise: pass
In the foreground the app holds one location request (BALANCED, 1 s). After the Home button `dumpsys location` shows that request as `{bg, na}` and `(inactive)`, and the app logged no fixes in 6 s in the background. The manifest has fine and coarse location only, no background location.

## Defects found (all small)
- D1. On the folded screen the bottom sheet covers most of the readout card while a tap panel is open.
- D2. After the "My position" switch is turned off and on, the marker and readout take 3 to 4 s to return.
- D3. Console error "Error injecting safe area CSS: TypeError: Cannot read properties of null (reading 'style')" at start (Capacitor/Console, line 6), seen in logcat. No visible effect.
- D4. With location off system-wide, logcat shows the Geolocation plugin's `checkPermissions` rejecting with "Location services are not enabled." (OS-PLUG-GLOC-0007). The app shows the right message, so this is noise only.
- Test note, not an app defect: after `adb emu fold` the cover display shows the lock screen and needs a swipe up before the app can be seen.
