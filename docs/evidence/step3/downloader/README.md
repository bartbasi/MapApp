# The native downloader, checked on the emulator

Result: every check below passed on the emulator `mapapp_fold` (Android 16), on 2026-11-17, with masked debug builds (`VITE_MAPAPP_MASK_OWNERS=1`, owners read "OWNER NAME") that carry the test hook `window.__mapappDownloads` (`VITE_MAPAPP_DOWNLOAD_HOOK=1`). Two faults were found during check d and fixed; check d and check g were then run again on the fixed build. Nothing was published. Every download came from `app/scripts/release-test-server.mjs` on this laptop, serving `data/publish/data-2026-11-17-test` staged with the base `http://10.0.2.2:8765/dl/`.

How the checks were driven: `tools/cdp.mjs` runs JavaScript in the app's WebView over the DevTools protocol through adb. Plans were made in the WebView by the real planner (`planExtract` through the shell's `RemoteFiles`, `planWholeArchive` with the catalog's size and checksum), and started with `DownloadJobs.start`. Finished files were pulled with `adb exec-out run-as io.github.bartbasi.mapapp cat ...`.

The reference for an extract is `assemble()` (app/src/downloads/assemble.ts) of the WebView's own plan, run in Node on the staged hosted file (`tools/reference.ts`, bundled with `npx rolldown tools/reference.ts -o reference.mjs -p node`). The reference for a whole file is the staged file itself.

The extract used everywhere: a 10 km box around the middle of Macon County, bounds -89.039958, 39.809084, -88.922942, 39.898916, full detail. Aerial: head 2,108 bytes, 45 ranges, 22,707,794 bytes. Base map: head 1,911 bytes, 29 ranges, 1,738,061 bytes.

| Check | Result | Evidence |
|---|---|---|
| a. An extract and a whole file finish | Aerial and base map extract, and the whole Macon base map (4,271,625 bytes, sha256 checked by the downloader), all complete. Each is identical (cmp) to its reference and passes `pmtiles verify`. Progress events came about once a second. | `a-extract-and-whole.log`, `01_notification_permission_asked.png` |
| b1. `am force-stop` mid-download, app reopened | Killed at 8,277,724 of 22,707,794 bytes, at 200 KB/s. On reopening (only `am start`) it went on from the checkpoint, byte 8,277,864. The server's first request after the kill starts at the hosted byte that position maps to. Finished file identical. | `b1-force-stop.log` |
| b2. Process killed (`kill -9`) mid-download | Android restarted the download service by itself 1 s later and it went on from the checkpoint, 9,156,744, before the app was opened. Server log shows the next request at exactly the mapped byte. Finished file identical. | `b2-process-killed.log` |
| c1. Signed addresses running out (`--expire 5`, 400 KB/s) | 7 refusals (403), each followed by a fresh redirect from the original address. Finished file identical. | `c-expiry-and-cuts.log` |
| c2. Connections cut mid-answer (`--drop-every 3`) | 8 answers cut. Each time the bytes that arrived were kept and the rest was asked for. Extract and whole file both identical. | `c-expiry-and-cuts.log` |
| d. Airplane mode mid-download | Status `waiting` within 2 s, network state offline. Airplane mode off: downloading again within 1 s of Android reporting a network. Finished file identical. | `d-airplane-mode.log` |
| e. Pause, resume, remove | A second area waited (`queued`) while the first ran, and started when the first was paused. Pause stopped all requests; resume went on from the checkpoint. Remove of a downloading, a paused and a complete area: each folder was gone at once, the complete area's archive left the archive list and its path answered 404. A paused area stayed paused after `am force-stop` and reopening. | `e-pause-resume-remove.log` |
| f. Area on the map in airplane mode | An area is listed by the archive plugin only once complete, with `area` set. In airplane mode, after a cold start, the area's base map and aerial imagery draw (no Macon base map or imagery is bundled in this build). | `f-area-on-map.log`, `02_area_basemap_airplane_mode.png`, `03_area_aerial_airplane_mode.png` |
| g. Network state | Wi-Fi and mobile data: online, not metered. Wi-Fi off: online, metered. Airplane mode: offline. Every change reached the web app as an event. | `g-network-state.log` |
| h. Screen off | 98 s with the display off (`mWakefulness=Asleep`, display `mState=OFF`): the file grew steadily at the server's 150 KB/s. Foreground service of type dataSync with the progress notification. Finished file identical. | `h-screen-off.log`, `04_progress_notification.png` |

## Faults found and fixed during the session

1. **Offline was not reported when the network went.** `NetworkWatch.onLost` asked Android for the active network and was given the one being torn down, so the state stayed online in airplane mode. It now reports offline on `onLost` and waits for Android to name a new default network.
2. **A waiting download did not go on when the network came back.** The wait between tries ended only when the "usable" flag changed, which, because of fault 1, it never did. Any network change now ends the wait. Losing the network also cuts the open connection at once, so a connection that hangs silently does not hold the area in "downloading" until a read times out.
3. **Small numbers from the web app were refused** ("bad read"): Capacitor's `getLong` returns nothing for numbers that arrive as integers. The plugin reads numbers with its own helper.

## A finding about the planner

An extract planned in the WebView and the same extract planned in Node differ in one byte: byte 136, the operating system byte in the gzip header of the compressed root directory (3 from Chromium's CompressionStream, 10 from zlib on Windows). The ranges are identical and readers ignore that byte. So the downloader's output is checked against `assemble()` of the plan the WebView made, and each such file was identical.

## Not checked here

- A real phone. Doze, a battery saver and a real mobile network are untested.
- Running out of storage (`no-space`). The check before each request and the handling of the storage error are in the code but were not provoked.
- Android 15 and 16's 6 hour daily limit for dataSync services (`onTimeout`).
- GitHub's real release files and their redirect.
