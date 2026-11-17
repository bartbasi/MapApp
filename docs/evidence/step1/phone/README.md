# Frame test on the owner's phone

Date: 2026-11-17. Phone: Samsung Galaxy Z Fold 5 (SM-F946U1), Android 16, connected by USB and charging. Build: `build/step1-debug.apk`, the Step 1 test build, installed with `adb install -r`.

The frame test is the one built into the app: Layers, Sources and licenses, Diagnostics, Run frame test. It moves the map on a fixed 15 second tour of pans, zooms and rotation. The taps were sent with `adb shell input tap`, and nothing touched the screen during a run.

## Folded (cover screen, 344 by 882 at pixel ratio 2.625)

| View | Average | Worst 1 percent | Frames over 33 ms | Tiles finished after stop | Screenshot |
|---|---|---|---|---|---|
| Map | 119.9 frames per second | 119 | 0 of 1806 | 350 ms | `folded-map-result.png` |
| Hybrid | 119.7 frames per second | 119 | 0 of 1802 | 594 ms | `folded-hybrid-result.png` |

The cover screen refreshes 120 times a second, so the app is drawing every frame the screen can show.

## Unfolded (main screen, 690 by 829 at pixel ratio 2.625)

| View | Average | Worst 1 percent | Frames over 33 ms | Tiles finished after stop | Screenshot |
|---|---|---|---|---|---|
| Map | 119.7 frames per second | 119 | 0 of 1802 | 363 ms | `unfolded-map-result.png` |
| Hybrid | 119.7 frames per second | 117.6 | 0 of 1801 | 309 ms | `unfolded-hybrid-result.png` |

Tile reads over the session: 2,115 requested, 0 failed.

## Result

The check "panning and zooming stay smooth on the Z Fold 5" passes on both screens. The map engine decision (DECISIONS D2) stands.

## Seen during the runs

- The "Frame test running" message sits on top of the credit line at the bottom right (`folded-hybrid-during.png`). It shows only during the test.
