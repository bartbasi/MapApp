// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Copies built archives (data/build/<county-id>/<layer>.pmtiles with its
// <layer>.meta.json) into the Android assets folder, so the next Gradle build
// puts them inside the APK.
//
// From Step 3 the app downloads the base map, imagery and public land of each
// county (D33), so by default only two kinds of archive are bundled:
//   - the overview map (overview/basemap), which the app shows before anything
//     is downloaded;
//   - every parcel archive (<county>/parcels). Parcel data is never hosted, so
//     it reaches a phone only inside a build the owner installs himself (D25).
//
// With --all every archive is bundled, as before Step 3, for a build that
// must work with no server at all.
//
// The target folder is emptied first, so it always matches the choice. It is
// ignored by git (android/.gitignore): county data never goes in the repository.
//
// Usage: npm run stage-archives [-- [--all] [<source folder>]]

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const all = args.includes('--all');
const unknown = args.filter((a) => a.startsWith('--') && a !== '--all');
if (unknown.length > 0) {
  console.error(`Unknown option ${unknown.join(' ')}. Usage: stage-archives [--all] [<source folder>]`);
  process.exit(1);
}
const source = resolve(args.find((a) => !a.startsWith('--')) ?? join(here, '../../data/build'));
const target = resolve(here, '../android/app/src/main/assets/archives');
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** True for the archives a build carries when downloads provide the rest. */
function bundledByDefault(county, layer) {
  return (county === 'overview' && layer === 'basemap') || layer === 'parcels';
}

if (!existsSync(source)) {
  console.error(`No archives folder at ${source}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

let count = 0;
let bytes = 0;
const left = [];
for (const county of readdirSync(source).sort()) {
  const dir = join(source, county);
  if (!ID.test(county) || !statSync(dir).isDirectory()) continue;
  for (const file of readdirSync(dir).sort()) {
    const m = /^(.+)\.pmtiles$/.exec(file);
    if (!m || !ID.test(m[1])) continue;
    if (!all && !bundledByDefault(county, m[1])) {
      left.push(`${county}/${m[1]}`);
      continue;
    }
    const meta = `${m[1]}.meta.json`;
    if (!existsSync(join(dir, meta))) {
      console.warn(`skipped ${county}/${file}: no ${meta} beside it`);
      continue;
    }
    mkdirSync(join(target, county), { recursive: true });
    for (const f of [file, meta]) {
      copyFileSync(join(dir, f), join(target, county, f));
      bytes += statSync(join(dir, f)).size;
    }
    console.log(`staged ${county}/${m[1]}`);
    count++;
  }
}
if (left.length > 0) console.log(`not bundled (downloaded by the app; --all bundles them): ${left.join(', ')}`);
console.log(`${count} archives, ${(bytes / 1024 / 1024).toFixed(1)} MB, in ${target}`);
