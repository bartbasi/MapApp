# Map engine, test app and hosting: what was checked

Done by the lead on 2026-11-12. This file records the checks behind `docs/DECISIONS.md` D2, D3, D5, D12, D15 and D20.

## Versions

Read from the npm registry and the installed tools on 2026-11-12.

| Thing | Version |
|---|---|
| MapLibre GL JS (`maplibre-gl`) | 6.18.0 |
| PMTiles JavaScript library (`pmtiles`) | 4.5.0 |
| Capacitor (`@capacitor/core`, `@capacitor/android`) | 8.6.2 |
| Protomaps style helper used only in the test (`@protomaps/basemaps`) | 5.7.2 |
| Vite | 8.3.8 |
| Svelte (not used in the test) | 5.57.3 |
| PMTiles command line tool | 1.31.2 |
| Capacitor Android template | minimum Android API 24 (Android 7.0), compile and target API 36, Gradle 8.14.3 |
| JDK needed by Capacitor 8 | 21 (installed 21.0.13 in `.tools/`) |
| Emulator | Android 16, system WebView 133.0.6943.137 |

MapLibre GL JS 6 differs from older versions in two ways that cost time: it has named exports only, and it loads its worker from a separate file next to its own module. A bundler moves the module, so the worker has to be bundled as its own entry and its address passed to `setWorkerUrl`.

## The Flutter check

The brief said the main Flutter MapLibre plugin has no desktop support and the newer one reaches desktop through a web view. A web search on 2026-11-12 agreed:

- `maplibre_gl` (`https://pub.dev/packages/maplibre_gl`): Android, iOS and web. Its documentation says desktop is not supported.
- `maplibre` (`https://pub.dev/documentation/maplibre/latest`): its documentation says Windows and macOS use MapLibre GL JS through a web view.

These were read as search result summaries of the package pages, not line by line. The check was not taken further, because the decision does not turn on it.

## The byte range finding (D5)

Test, run inside the test app's WebView through the debugging port, against a first version of the shell that answered Range requests with exactly the requested bytes:

| Request | Result |
|---|---|
| No Range header | 200, 12,140,611 bytes |
| `Range: bytes=0-16383` | 206, 16,384 bytes |
| `Range: bytes=1000-1999` | "TypeError: Failed to fetch" |

The first map load showed the same thing: 7 tile reads requested, 6 failed.

Cause: for a response supplied by the app, Android WebView applies the Range header itself. It skips to the start offset in the stream it was given and sizes the stream with `InputStream.available()`, which returns a 32-bit number. Capacitor's own file server (`WebViewLocalServer.java`, `handleLocalRequest`) works with this behaviour by returning the whole file stream and reading its size with `available()` into an `int`, and by parsing the range end with `Integer.parseInt`. So it cannot address a file past 2 GB.

Fix: the range travels in the request address (`?o=<offset>&n=<length>`), the shell returns exactly those bytes with status 200, and no Range header is involved. After the fix: 0 failed reads in every run.

Not tested: a real archive larger than 2 GB. The design removes the limit, but no file that large exists yet.

## Test runs on the emulator

The test app is `spikes/step0-map-proof`. The archive is OpenStreetMap data for the Champaign County area from the Protomaps build of 2026-11-12, zoom 0 to 15, 12,140,611 bytes.

**Run 1** (archive pushed to app storage with adb, first APK). Results transcribed from the session, with no log file kept:

- Online, unfolded: map loaded, 7 tile reads, 0 failed. Screenshot `docs/evidence/step0/run1-unfolded-online.png`.
- Airplane mode on, `ping 8.8.8.8` failed (network down). App restarted: map loaded, 0 failed.
- Frame test, unfolded: 15.3 s, 405 frames, average 26.6 fps, worst 1 percent 6.7 fps, 155 frames over 33 ms.
- Folded: frame test 15.3 s, 417 frames, average 27.3 fps, worst 1 percent 7.6 fps, 248 frames over 33 ms. Screenshot `run1-folded-airplane-mode.png`, 184 tile reads, 0 failed.
- A second emulator start, clean install of the final APK, unfolded, airplane mode: 15.3 s, 587 frames, average 38.5 fps, worst 1 percent 12.0 fps, 115 frames over 33 ms.

**Run 2** (clean install of the final APK, which carries the archive inside it). Log kept in `docs/evidence/step0/run2-test-log.txt`:

- Network down confirmed by ping and by the airplane mode setting.
- Unfolded: map loaded, 7 tile reads, 0 failed. Screenshot `run2-unfolded-airplane-mode.png`.
- Frame test, unfolded: 15.3 s, 450 frames, average 29.4 fps, worst 1 percent 7.5 fps, 135 frames over 33 ms.
- Folded: the web app saw a 412 by 732 viewport and the map canvas matched it. Screenshot `run2-folded-airplane-mode.png`.
- Frame test, folded: 15.1 s, 616 frames, average 40.8 fps, worst 1 percent 13.3 fps, 147 frames over 33 ms.

The run 2 screenshots are dimmed by an Android "System UI isn't responding" dialog. That dialog is the emulator's own interface stalling because the laptop had almost no free memory. The map is visible beneath it.

### What the frame numbers mean

Very little about the real phone. The emulator translates graphics calls to the laptop's GPU, the laptop had 0.1 to 0.4 GB of free memory, and the emulator's load average was between 13 and 26 during the tests. The same test gave 26.6 and 38.5 fps on the same screen in different runs. The frame test also measures a vector base map only. Aerial imagery and overlays are not in it.

### A finding that was wrong, and its correction

In run 1, screenshots taken the instant the frame test ended showed the map drawn on the left part of the screen only, with flat gray on the right. This was first read as the map failing to resize after a fold, and a resize handler was added.

Run 2 showed that reading was wrong. The same gray area appeared on the unfolded screen with no fold involved (`run2-unfolded-end-of-frame-test.png`), and it filled in by itself five seconds later with no resize (`run2-unfolded-5s-later.png`). The gray is the style's background color where tiles have not been drawn yet. On the starved emulator, tiles at zoom 15.5 took several seconds to appear after a fast camera move.

So there is no evidence of a fold bug. The resize handler stays in the test app because it is harmless. What the observation does show is that tile loading speed after fast movement is something to measure on the real phone, alongside the frame rate.

### Network state (D12)

In every airplane mode test, the app's panel showed "network online", because `navigator.onLine` stayed true. Both airplane mode screenshots show it.

## Hosting on GitHub Releases (D15)

- GitHub's documentation (`https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases`) says: "Each file included in a release must be under 2 GiB." and "There is no limit on the total size of a release, nor bandwidth usage."
- Range test on one public release file, a request for the first 100 bytes: the first answer was a 302 redirect to `release-assets.githubusercontent.com`, and the second was "206 Partial Content", "Content-Range: bytes 0-99/17842310".
- That response carried no `Access-Control-Allow-Origin` header. A web page on another site therefore cannot read release files. The Android app's native downloader is not affected.

Not tested: many range reads in a row, as an area download would make. The redirect address is short-lived, so the downloader must follow the redirect again when it expires. This is checked at the start of Step 2, before the download design is fixed.
