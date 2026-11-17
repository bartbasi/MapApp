// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Optional checks against the real archives built on the development
// machine (never committed). Each layer's test is skipped when its archive is
// not there. The parcel archive is never read here: it holds owner names.
//
// For each area the extract is planned, assembled into a file in the OS
// temporary folder, and checked tile by tile against the source. When the
// PMTiles command line tool is present, it verifies the extract and cuts the
// same area for comparison.

import { describe, expect, it } from 'vitest';
import type { Bounds } from '../map/tile-math';
import { assembleTo } from './assemble';
import { rangeReport } from './download-plan';
import { checkExtract } from './extract-check';
import { planExtract, type ExtractRequest } from './extract-planner';
import { diskSource, fileWriter, fs, joinPath, localPath, makeTempDir, run } from './test-node';

const COUNTIES = ['il-macon', 'il-champaign'];
/** Never 'parcels'. */
const LAYERS = ['basemap', 'publicland', 'aerial'] as const;

const tool = localPath('../../../.tools/pmtiles/pmtiles.exe');
const haveTool = !!tool && !!fs?.existsSync(tool) && !!childProcessReady();

function childProcessReady(): boolean {
  try {
    return run(tool!, ['version']).status === 0;
  } catch {
    return false;
  }
}

/** A square of `km` kilometres around a point. */
function box(lng: number, lat: number, km: number): Bounds {
  const dLat = km / 2 / 111.32;
  const dLng = km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return [r(lng - dLng), r(lat - dLat), r(lng + dLng), r(lat + dLat)];
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

function addressedCount(showOutput: string): number {
  const m = /addressed tiles count: (\d+)/.exec(showOutput);
  if (!m) throw new Error(`no tile count in: ${showOutput}`);
  return Number(m[1]);
}

for (const county of COUNTIES) {
  for (const layer of LAYERS) {
    expect(layer).not.toBe('parcels');
    const file = localPath(`../../../data/build/${county}/${layer}.pmtiles`);
    const metaFile = localPath(`../../../data/build/${county}/${layer}.meta.json`);
    const present = !!file && !!metaFile && !!fs?.existsSync(file) && fs.existsSync(metaFile);

    describe.skipIf(!present)(`extracts of the real ${county} ${layer} archive`, () => {
      const meta = present ? (JSON.parse(fs!.readFileSync(metaFile!, 'utf8')) as { bounds: Bounds; minzoom: number; maxzoom: number }) : null;
      const [w, s, e, n] = meta?.bounds ?? [0, 0, 0, 0];
      const cx = (w + e) / 2;
      const cy = (s + n) / 2;
      const areas: { name: string; request: ExtractRequest }[] = [
        { name: '2 km box', request: { bounds: box(cx, cy, 2) } },
        { name: '10 km box', request: { bounds: box(cx, cy, 10) } },
        { name: '10 km box, two zooms less', request: { bounds: box(cx, cy, 10), maxzoom: (meta?.maxzoom ?? 2) - 2 } },
        { name: 'whole county bounds', request: { bounds: [w, s, e, n] } },
      ];

      for (const area of areas) {
        it(`${area.name}: every tile matches the source`, async () => {
          const source = diskSource(file!);
          const dir = makeTempDir();
          try {
            const plan = await planExtract(source, area.request);
            const planReads = source.reads;
            expect(plan.sourceReads).toBe(planReads);
            const joined = await planExtract(source, area.request, { leafReadGap: 65536 });
            expect(joined.head).toEqual(plan.head);

            const out = joinPath(dir, 'extract.pmtiles');
            const writer = fileWriter(out);
            try {
              expect(await assembleTo(plan, source, (c) => writer.write(c))).toBe(plan.bytes);
            } finally {
              writer.close();
            }
            const extract = diskSource(out);
            let checked;
            try {
              checked = await checkExtract(source, extract, plan, area.request);
            } finally {
              extract.close();
            }

            const report = rangeReport(plan);
            const trade = report.tradeoff.map((t) => `${kb(t.gap)} gap: ${t.requests} (+${kb(t.extraBytes)})`).join(', ');
            const lines = [
              `${county} ${layer}, ${area.name}, zoom ${plan.minzoom}-${plan.maxzoom}: final ${plan.bytes} bytes (${mb(plan.bytes)}), head ${plan.head.length} bytes, ` +
                `${report.requests} ranges (smallest ${report.smallestRange}, median ${report.medianRange}, largest ${report.largestRange} bytes), ` +
                `${plan.sourceReads} directory reads (${joined.sourceReads} with a 64 KB leaf read gap), ` +
                `${plan.addressedTiles} tiles (${checked.wantedTiles} in the area), ${plan.tileContents} contents, ${plan.leafDirectories} leaves, clustered ${plan.clustered}`,
              `  merging nearby ranges: ${trade}`,
            ];

            if (haveTool) {
              const verify = run(tool!, ['verify', out]);
              expect(verify.status, verify.out).toBe(0);
              const show = run(tool!, ['show', out]);
              expect(show.status, show.out).toBe(0);
              expect(addressedCount(show.out)).toBe(plan.addressedTiles);
              const ref = joinPath(dir, 'reference.pmtiles');
              const b = area.request.bounds;
              const args = ['extract', file!, ref, `--bbox=${b.join(',')}`, '--quiet'];
              if (area.request.maxzoom !== undefined) args.push(`--maxzoom=${area.request.maxzoom}`);
              const cut = run(tool!, args);
              expect(cut.status, cut.out).toBe(0);
              const refCount = addressedCount(run(tool!, ['show', ref]).out);
              const refFile = diskSource(ref);
              refFile.close();
              lines.push(`  pmtiles verify: passed; pmtiles extract of the same box: ${refCount} tiles, ${refFile.size} bytes`);
              expect(refCount).toBe(plan.addressedTiles);
            }
            console.log(lines.join('\n'));
          } finally {
            source.close();
            fs!.rmSync(dir, { recursive: true, force: true });
          }
        }, 600000);
      }
    });
  }
}
