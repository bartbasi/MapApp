# MapApp

MapApp (a working title) is a free, open source GPS mapping app for hunters, published by Play, Inc. Phase 1 is an Android app covering Champaign County and Macon County, Illinois, in 2D, using free public data.

The full brief is `MapApp-kickoff-prompt.md`. Read it before any step-level work. The state of the work is in `docs/STATUS.md`. A new session should be able to pick up from that file alone.

## Where things are

- `docs/DECISIONS.md`: every architecture and data decision, with the reason. Do not reopen a decision without new evidence. Record changes there.
- `docs/DATA_SOURCES.md`: each data source, its license, whether it is approved for use, and the required credit. `docs/research/` holds the detailed evidence.
- `docs/STEP_PLAN.md`: the steps of Phase 1 and their checks.
- `docs/reports/`: the report sent to the owner at the end of each step.
- `.claude/agents/`: the subagent team (data-engineer, app-developer, ux-designer, qa-tester, step-reviewer).
- `app/`: the web app (TypeScript, Svelte, MapLibre) and, in `app/android/`, the Capacitor Android project.

## Rules that are never broken

1. **County parcel data.** The owner says both counties allow a stored copy (DECISIONS D25). Parcel archives are built by the pipeline on this machine and live under `data/`. Never commit them, and never put them on GitHub or any public host until the owner says so in plain words. Keep only the outline, parcel ID, acreage and owner name. Never request, show or store mailing addresses, site addresses or phone numbers. Do not write owner names into docs, commits, logs or reports. Refer to a parcel by its ID.
2. **No data files in git.** Downloads and build outputs live under `data/`, which is ignored. Never push any county data file.
3. **Privacy.** No accounts, ads, analytics or crash reporting. User data stays on the device.
4. **Originality.** Code, map styles, icons and text are written here. Do not copy another mapping product's name, branding, layer names, styling or data, and do not call another product's servers.
5. **Licenses.** Use only sources marked approved in `docs/DATA_SOURCES.md`. Do not accept a data license, sign up for a service or spend money. Those need the owner.
6. **Ask the owner first** before: the first push to a public repository, any app store publishing, deleting or changing files outside this folder, turning on a Windows feature that needs a restart, or downloading more than 50 GB in one step.

## Source file header

Every source file starts with these two lines, in the file's comment syntax:

```
MapApp. Copyright 2026 Play, Inc.
Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
```

## The machine (Cabin-Laptop)

Windows 11, 12 GB of RAM, usually under 2 GB free. Memory is the constraint that causes failures.

- Never run two of these at once: the Android emulator, a Gradle build, a heavy data job.
- Stop the Gradle daemon after a build: `gradlew --stop`.
- Shut the emulator down when a test session ends: `adb emu kill`.

Tools:

- Node 24, npm, git, Python 3.14, Docker and the GitHub CLI are on the PATH.
- JDK 21 (needed by Capacitor 8) is at `.tools/jdk-21.0.13+9`. Set `JAVA_HOME` to it for Gradle. The system `JAVA_HOME` is JDK 17, which the Android SDK command line tools use.
- Android SDK: `C:\dev\android-sdk` (`ANDROID_HOME`). Platforms 35 and 36, build tools 36, emulator, Android 36 Google APIs x86_64 system image.
- Emulator: the virtual device `mapapp_fold` (Pixel Fold profile, Android 16). Start it with `emulator -avd mapapp_fold -no-snapshot -no-boot-anim -no-audio -gpu host -memory 2048`. Fold and unfold with `adb emu fold` and `adb emu unfold`. It has two displays, so screenshots need a display ID: get the IDs from `adb shell dumpsys SurfaceFlinger --display-id` and use `adb exec-out screencap -d <id> -p`.
- PMTiles command line tool: `.tools/pmtiles/pmtiles.exe`.
- WSL2 Ubuntu 26.04 is installed with no GIS tools yet. GDAL 3.12, tippecanoe 2.53 and osmium are available from apt. Install with `wsl -d Ubuntu -u root -- apt-get install ...` (the default user needs a sudo password).
- In Git Bash, set `MSYS_NO_PATHCONV=1` before `adb shell` commands with device paths, and then give Windows paths as `C:/...`.

## Writing for the owner

The owner reads reports cold, between other work. Put the result first: what works, what does not, what is needed from him. Use plain words and full sentences, one idea per sentence, the same word for the same thing throughout. Do not use em dashes. Do not use a name invented during the work without saying what it is. Give numbers where a check asks for them.

## Definition of done

A feature that compiles but was not seen working is not done. Take screenshots of the running app, look at them, and keep them under `docs/evidence/<step>/`. Each step ends with its checks run, the results in the report, and a review by the step-reviewer agent.
