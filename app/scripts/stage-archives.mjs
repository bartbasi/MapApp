// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Copies the built archives (data/build/<county-id>/<layer>.pmtiles with its
// <layer>.meta.json) into the Android assets folder, so the next Gradle build
// puts them inside the APK. Step 1 only: from Step 2 the app downloads them.
//
// The target folder is emptied first, so it always matches data/build. It is
// ignored by git (android/.gitignore): county data never goes in the repository.
//
// Usage: npm run stage-archives [-- <source folder>]

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(process.argv[2] ?? join(here, '../../data/build'));
const target = resolve(here, '../android/app/src/main/assets/archives');
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

if (!existsSync(source)) {
  console.error(`No archives folder at ${source}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

let count = 0;
let bytes = 0;
for (const county of readdirSync(source).sort()) {
  const dir = join(source, county);
  if (!ID.test(county) || !statSync(dir).isDirectory()) continue;
  for (const file of readdirSync(dir).sort()) {
    const m = /^(.+)\.pmtiles$/.exec(file);
    if (!m || !ID.test(m[1])) continue;
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
console.log(`${count} archives, ${(bytes / 1024 / 1024).toFixed(1)} MB, in ${target}`);
