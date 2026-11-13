# Spikes

Throwaway tests. Nothing here is product code, and nothing in the product may import from here.

## step0-map-proof

The Step 0 test of the map engine choice. It is a Capacitor 8 Android app whose only screen is a MapLibre GL JS 6 map. The map reads a PMTiles archive of OpenStreetMap data for the Champaign County area from app storage, with no network.

What it proved, and what it found, is written in `docs/research/engine-and-hosting-checks.md`, `docs/DECISIONS.md` (D2, D5, D12, D20) and `docs/reports/step-0.md`.

It uses a stock Protomaps style and stock fonts and icons. The product's style is written from scratch. The fonts and icons are not in git. To fetch them, download the Noto Sans Regular, Medium and Italic glyph ranges 0-255, 256-511 and 8192-8447 from `https://protomaps.github.io/basemaps-assets/fonts/<font name>/<range>.pbf` into `public/fonts/<font name>/`, and the four `light` sprite files from `https://protomaps.github.io/basemaps-assets/sprites/v4/` into `public/sprites/`.

To rebuild it:

```
cd spikes/step0-map-proof
npm install
npm run build
npx cap sync android
cd android
set JAVA_HOME to .tools/jdk-21.0.13+9, then: gradlew assembleDebug
```

The test archive is not in git. Recreate it with:

```
.tools/pmtiles/pmtiles.exe extract https://build.protomaps.com/<build date>.pmtiles data/spike/champaign_z15.pmtiles --bbox=-88.4640,39.8790,-87.9280,40.4010 --maxzoom=15
```

and copy it to `spikes/step0-map-proof/android/app/src/main/assets/`.

This folder is removed in Step 1, when the real app replaces it.
