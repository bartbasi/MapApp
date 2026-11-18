# Step 3 review fixes

## Native side (the Android downloader)

Result: every review item on the native side is fixed and was seen working on the emulator `mapapp_fold` (Android 16) on 2026-11-17. The code is commit `d3a0a54`. The final build is `build/step3-masked-debug.apk`, built from `d3a0a54` with `VITE_MAPAPP_MASK_OWNERS=1`, `VITE_MAPAPP_CATALOG_URL=http://10.0.2.2:8765/catalog.json` and the download test hook (`VITE_MAPAPP_DOWNLOAD_HOOK=1`). Its SHA-256 is `8abac4ddb67f0bb320a12543e379bca01c1caa516b387b7742242a486dace08f` (27,223,621 bytes). The checks ran on a build of the same sources. JUnit passes 73 tests, `npm run check` is clean and Vitest passes 602 tests.

All downloads came from `app/scripts/release-test-server.mjs` on this laptop. Its log stamps each line in UTC when an answer ends; a request begins with its `/dl` redirect line. Every adb command named the emulator. Every screenshot is from the masked build.

| Check | Result | Evidence |
|---|---|---|
| a. Mobile data | A job stored by the old build (no `allowMetered` field) counts as not allowed. The new build, started on mobile data, made no request for it. A county download started on Wi-Fi through the screens: Wi-Fi off, the open request was cut 56 ms after Android reported the loss, the area read "Waiting for Wi-Fi" within 1 s with "Use mobile data", and the notification said "Waiting for Wi-Fi. 5.3 MB of 145 MB". No request started while it waited. Wi-Fi back on: it went on by itself within 1 s of Android validating Wi-Fi. On mobile data again, the app was force-stopped and reopened: still waiting, nothing requested. "Use mobile data": it went on over mobile data within 1 s. A download started on mobile data showed the question. "Not now" started nothing and made no request. "Download now" downloaded over mobile data to completion. | `native-a-mobile-data.log`, `native-01` to `native-03` |
| b. Wake lock | Held without a break for 4 min 42 s of downloading, renewed every 30 s. A single taking lasts 120 s, so this proves renewal; the old 30 minute limit was not run. Let go when the download was paused, when it waited for Wi-Fi, and 7 ms after an area completed. | `native-b-wake-lock.log` |
| c. Remove | 41 rounds of start then remove after 0 to 1,500 ms. 6 of them completed while remove was running, the race the review found. In every round the area was gone from both lists. No area folder and no trash folder existed afterwards, or 10 s later. A remove in the middle of a 145 MB download: the folder was gone when remove returned, and no request followed. | `native-c-remove.log` |
| d. Damaged `job.json` | A complete area with its `job.json` cut to 5 bytes stays listed as complete, with an empty record and its 4,032,172 bytes. Its three archives stay in the archive list and read through the shell. The screens show it as "Unreadable download" with Delete (`native-04`). An incomplete area with a damaged job was deleted at load. | `native-d-damaged-job.log`, `native-04` |
| e. Signed address ending in 404 or 400 | With `--expire 5 --expire-status 404`, and again with `400`: 7 expiries each, every one tried again from the original address. Both files are identical to the reference and pass `pmtiles verify`. | `native-e-expiry-status.log` |
| f. Regression | An extract (aerial and base map) and a whole file are identical to their references and pass `pmtiles verify`. A force-stop at 6.2 MB went on from the checkpoint at exactly the mapped byte, and the file is identical. Airplane mode gave "waiting for a connection" within 2 s and it recovered; the file is identical. | `native-f-regression.log` |

What changed, in short:
- **Mobile data.** The job stores `allowMetered`. `Schedule` decides which area may fetch and what each shows. A network change that forbids the running area cuts its request at once. `setAllowMetered` is new. Every state carries `waitingFor` and `allowMetered`.
- **Wake lock.** `WakeLease` takes the lock for 120 s and renews it while bytes move.
- **Signed addresses.** Any 4xx from a signed address except 416 is tried once from the original address.
- **Plain http.** Plain http that the build does not allow fails the area at once as `server`.
- **Remove.** `AreaGuard` makes remove win over the worker.
- **Damaged jobs at load.** `AreaScan` keeps a complete area whose job cannot be read.
- **Unused parts removed.** `ServiceHook.busy` and the template's FileProvider. Nothing used the provider, and its paths covered all of shared storage.
- **Test server.** `--expire-status` added.

Not seen here; these need the real phone or another setup:
- A real mobile network and Wi-Fi hand-over.
- Doze.
- A download longer than 30 minutes with the screen off.
- Android's 6 hour daily limit for the service.
- Plain http refused in a release build. That is shown by JUnit only; no release APK was built.
