# The location plugin of our own, checked on the emulator

Result: the app reads the phone's position through MapApp's own `DeviceLocation` plugin (DECISIONS D31), and every check below passed on the emulator. The closed Google library is gone from the build. How quickly the first fix comes on a real phone, indoors and outdoors, still needs the owner's phone.

Run on 2026-11-17 on the emulator `mapapp_fold` (Android 16), unfolded (2208 x 1840), with the masked build `build/location-masked-debug.apk`. Every owner name on screen reads "OWNER NAME". Parcels are named by parcel ID only. The session began with airplane mode off (`airplane_mode_on` = 0) and Location on, and ended the same way. Every adb command named the emulator. Card texts were read from the screen through `uiautomator dump`; each point was held by sending the same fix once a second for 6 s.

## Proof that the closed library is gone

- `debugRuntimeClasspath.txt`: the output of `gradlew :app:dependencies --configuration debugRuntimeClasspath`. It has no line with `play-services`, `iongeolocation`, `gms` or `firebase`.
- `dex-check.txt`: every class in the built app's 8 dex files, listed with `dexdump`. 5,309 classes. None under `com/google/android/gms/`, `io/ionic/` or the old plugin's package. The one class under `com/google/` is Guava's `ListenableFuture` interface (Apache 2.0), used by AndroidX. For contrast, the Step 2 build had 1,076 classes under `com/google/android/gms/`.

## Checks

| # | Check | Result | Screenshots |
|---|---|---|---|
| 1 | Start | The app starts and draws the map. | `01_start.png` |
| 2 | Approximate only is refused | After a fresh install the locate button shows Android's dialog (`02`). With "Approximate" and "While using the app" the app says "MapApp needs your precise location." with the full text and an "Open app settings" button, and shows no marker or card (`03`). The app held no location request (`dumpsys location` had no line for it). The fine permission was `granted=false`, the coarse one `granted=true`. | `02_permission_dialog.png`, `03_approximate_refused.png` |
| 3 | Change to precise | The next tap brought Android's "Change MapApp's location access from approximate to precise?" (`04`). After "Change to precise location" the marker appeared and the card said "Property line 213 ft (65 m) to the W, Parcel 08-06-23-100-005, GPS accurate to about 16 ft (5 m)" (`05`). The watch call reached the plugin at 17:04:53.31 and the first fix passed at 17:04:57.27, 4.0 s later. The GPS and fused requests were both registered within 40 ms of the call; the 4 s is the emulator's GPS. | `04_change_to_precise_dialog.png`, `05_first_fix_east_of_line.png` |
| 4 | Across the line between 08-06-23-100-005 and 08-06-23-100-007 (latitude 39.9155) | -89.0609: 65 m to the W, parcel 08-06-23-100-005 (`05`). -89.0615: 14 m to the W, parcel 08-06-23-100-005 (`06`). -89.06166: "On or near a property line. GPS cannot tell which side." naming both parcels (`07`). -89.0625: 72 m to the E, parcel 08-06-23-100-007 (`08`). The same figures as Step 2. | `06`, `07`, `08` |
| 5 | Walk across the line | 27 fixes one a second from -89.0609 to -89.0625, then 6 s held. 36 GPS fixes passed and 36 fused fixes dropped, none the other way. Age at delivery 1 to 62 ms, median 8 ms. | `walk-log.txt` |
| 6 | The rule between GPS and fused | The emulator feeds both providers from one source, so Android's test providers drove them separately (`cmd location providers`; removed afterwards). Fused fixes alone, east of the line, 30 m: dropped until 5 s after the last GPS fix, then passed; the card named 08-06-23-100-005 at 30 m (`09`). GPS fixes west of the line at 5 m, with fused fixes east of it at the same time: every GPS fix passed and every fused fix was dropped; the card named 08-06-23-100-007 at 5 m (`10`). GPS stopped, fused continued: the fused fix at 4.1 s after the last GPS fix was dropped, the one at 5.2 s passed (`11`). | `09`, `10`, `11`, `arbiter-log.txt` |
| 7 | Airplane mode | `airplane_mode_on` = 1, ping "Network is unreachable". App force-stopped and started again. The three points of check 4 gave the same cards (`12` to `14`). 34 GPS fixes passed, 34 fused dropped. First fix 7.2 s after the requests were registered; the emulator's GPS again. | `12_airplane_east.png`, `13_airplane_on_line.png`, `14_airplane_west.png` |
| 8 | Location switched off while tracking | Within 3 s the app said "Location is switched off on this phone. Turn on Location in the phone's quick settings. Then tap the position button again." with "Open Location settings", and the GPS and fused registrations were removed (`15`). A tap with Location still off gave the same message (`16`). | `15_location_off_while_tracking.png`, `16_tap_while_location_off.png` |
| 9 | Location on again | A tap brought the marker and the card back: 65 m to the W, parcel 08-06-23-100-005 (`17`). | `17_location_on_again.png` |
| 10 | Back from the background | Home pressed: the GPS and fused registrations were removed at once. 15 s later the app came back. At 0.8 s the marker was gray at the old place and the app said "Last position 17 s ago." with the old card marked "From the last GPS position." (`18`). The registrations came back at once and the first new fix passed 3.6 s later; the marker moved to the new place and the card named 08-06-23-100-007 (`19`). The fixes sent while the app was away were never delivered. | `18_back_from_background_0.8s.png`, `19_back_from_background_4s.png` |
| 11 | Location switched off while in the background | On return the app said Location is switched off, with no marker. | `20_back_after_location_off_in_background.png` |
| 12 | Crashes | The crash log was empty after the session. | none |

## What differs from the Step 2 plugin

- **The Location switch.** In Step 2, switching Location off while tracking left a gray marker and the stale card. Now the app says Location is switched off at once, and the marker goes until the user taps again.
- **Heading.** The old plugin always sent a course, 0 when the phone had none. The new one sends the bearing only when Android reports one, and none otherwise. The app's heading choice (compass when still, course when walking) is unchanged.
- **Smoothing.** With a network, the old plugin used Google's fused service, which smoothed a jump for a second or two (Step 2: about 4 m short). The raw GPS fix is now used whenever there is one, so there is no smoothing.
- **Age.** A fix's age now counts from when it was taken, not from when it arrived. On the emulator the difference was 1 to 62 ms.
- **First fix on the emulator:** 3.6 to 7.2 s. Step 2 recorded 3 to 4 s with the old plugin.

## Not checked here

- The first fix on a real phone, indoors and outdoors, and after the phone has been off for a while.
- Whether a real phone's fused provider fills gaps under trees as the test providers did here.
- A phone without a fused provider (Android 11 or older, or a phone without one).
