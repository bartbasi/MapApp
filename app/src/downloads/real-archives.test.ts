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

import { tileIdToZxy, zxyToTileId } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import { tileBounds, type Bounds } from '../map/tile-math';
import { parseArchiveMeta } from '../platform/archive-meta';
import { assembleTo } from './assemble';
import { rangeReport } from './download-plan';
import { checkExtract } from './extract-check';
import { planExtract, type ExtractRequest } from './extract-planner';
import { extractMeta } from './request-plan';
import { allTileEntries } from './test-archive';
import { tileRect } from './tile-cover';
import { diskSource, fileWriter, fs, joinPath, localPath, makeTempDir, pmtilesTool, run } from './test-node';

const COUNTIES = ['il-macon', 'il-champaign'];
/** Never 'parcels'. */
const LAYERS = ['basemap', 'publicland', 'aerial'] as const;

const tool = pmtilesTool;
const haveTool = tool !== undefined;

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
              `${county} ${layer}, ${area.name}, tiles at zoom ${plan.minzoom}-${plan.maxzoom}: final ${plan.bytes} bytes (${mb(plan.bytes)}), head ${plan.head.length} bytes, ` +
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

// Public land is sparse: a small box away from any public land can hold tiles
// at middle zooms only. These boxes are found from the archive itself: a box
// of 200 m in the middle of a tile the archive does not have, whose parent it
// does have. The extract's header must then end at the parent's zoom.
for (const county of COUNTIES) {
  const file = localPath(`../../../data/build/${county}/publicland.pmtiles`);
  const present = !!file && !!fs?.existsSync(file);

  describe.skipIf(!present)(`sparse extracts of the real ${county} public land archive`, () => {
    for (const parentZoom of [13, 12, 11]) {
      it(`a box where the archive's tiles stop at zoom ${parentZoom} or below`, async () => {
        const source = diskSource(file!);
        const dir = makeTempDir();
        try {
          const all = await allTileEntries(source);
          const held = new Set<number>();
          for (const e of all.entries) for (let id = e.tileId; id < e.tileId + e.runLength; id++) held.add(id);
          // The first held tile at the parent zoom with a child the archive lacks.
          let child: [number, number, number] | null = null;
          for (const id of [...held].sort((a, b) => a - b)) {
            const [z, x, y] = tileIdToZxy(id);
            if (z !== parentZoom) continue;
            for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
              if (!held.has(zxyToTileId(z + 1, 2 * x + dx, 2 * y + dy))) child ??= [z + 1, 2 * x + dx, 2 * y + dy];
            }
            if (child) break;
          }
          expect(child).not.toBeNull();
          const [cz, cx, cy] = child!;
          const tb = tileBounds(cz, cx, cy);
          const request: ExtractRequest = { bounds: box((tb[0] + tb[2]) / 2, (tb[1] + tb[3]) / 2, 0.2) };
          // The highest zoom of any held tile the box overlaps: what the header must say.
          let expectedMax = -1;
          for (let z = all.header.minZoom; z <= all.header.maxZoom; z++) {
            const r = tileRect(request.bounds, z);
            for (let x = r.minX; x <= r.maxX; x++) for (let y = r.minY; y <= r.maxY; y++) if (held.has(zxyToTileId(z, x, y))) expectedMax = z;
          }
          expect(expectedMax).toBeLessThan(all.header.maxZoom);

          const plan = await planExtract(source, request);
          expect(plan.addressedTiles).toBeGreaterThan(0);
          expect(plan.maxzoom).toBe(expectedMax);
          const out = joinPath(dir, 'extract.pmtiles');
          const writer = fileWriter(out);
          try {
            await assembleTo(plan, source, (c) => writer.write(c));
          } finally {
            writer.close();
          }
          const extract = diskSource(out);
          try {
            await checkExtract(source, extract, plan, request);
          } finally {
            extract.close();
          }
          // The metadata the download manager writes agrees with the archive and still validates.
          const sourceMeta = parseArchiveMeta(JSON.parse(fs!.readFileSync(localPath(`../../../data/build/${county}/publicland.meta.json`)!, 'utf8')));
          const meta = parseArchiveMeta(extractMeta(sourceMeta, plan));
          expect([meta.minzoom, meta.maxzoom]).toEqual([plan.minzoom, plan.maxzoom]);
          let verified = 'tool not present';
          if (haveTool) {
            const verify = run(tool!, ['verify', out]);
            expect(verify.status, verify.out).toBe(0);
            verified = 'passed';
          }
          console.log(
            `${county} public land, 200 m box in missing tile ${cz}/${cx}/${cy}: tiles at zoom ${plan.minzoom}-${plan.maxzoom} ` +
              `(archive ${all.header.minZoom}-${all.header.maxZoom}), ${plan.addressedTiles} tiles, ${plan.bytes} bytes; pmtiles verify: ${verified}`,
          );
        } finally {
          source.close();
          fs!.rmSync(dir, { recursive: true, force: true });
        }
      }, 120000);
    }
  });
}

