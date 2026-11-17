// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Optional check against the real Macon County parcel archive, which is built
// on the development machine and never committed (D25). Skipped when the
// file is not there. It prints counts, parcel IDs and distances only, never
// an owner name.

import { PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import { parseArchiveMeta } from '../platform/archive-meta';
import { CoverageArea } from './coverage-area';
import { decodeParcelTile, decompressTile } from './parcel-tile';
import { PARCEL_RECORD_FIELDS } from './parcel-record';
import { insideRings, signedArea } from './planar';
import { positionReadout } from './readout';
import { StoredParcelSource, type ParcelArchive } from './stored-parcel-source';
import { PARCEL_ZOOM, lngLatToTileUnits, tileAt, tileUnitsToLngLat } from './tile-coords';

interface Fs {
  existsSync(p: URL): boolean;
  readFileSync(p: URL): Uint8Array;
  readFileSync(p: URL, encoding: 'utf8'): string;
}

// The app's type settings carry no Node types, so the file system is reached
// through the one Node call needed, typed by hand.
const fs = (globalThis as { process?: { getBuiltinModule?(id: string): unknown } }).process?.getBuiltinModule?.('node:fs') as Fs | undefined;
const file = new URL('../../../data/build/il-macon/parcels.pmtiles', import.meta.url);
const metaFile = new URL('../../../data/build/il-macon/parcels.meta.json', import.meta.url);
const present = !!fs && fs.existsSync(file);

/** The county outline from the metadata on disk, or null if the file or its coverage is not there. */
function coverageFromMeta(): CoverageArea | null {
  if (!fs?.existsSync(metaFile)) return null;
  const meta = parseArchiveMeta(JSON.parse(fs.readFileSync(metaFile, 'utf8')));
  return meta.coverage ? new CoverageArea(meta.coverage) : null;
}

function archive(coverage: CoverageArea | null = null): ParcelArchive {
  // Copied into a plain Uint8Array: a Node Buffer's slice is a view, not a copy.
  const bytes = new Uint8Array(fs!.readFileSync(file));
  const source: Source = {
    getKey: () => 'il-macon/parcels',
    getBytes: async (offset: number, length: number): Promise<RangeResponse> => ({ data: bytes.slice(offset, offset + length).buffer as ArrayBuffer }),
  };
  const pm = new PMTiles(source);
  return {
    id: 'il-macon/parcels',
    layer: 'parcels',
    county: 'il-macon',
    countyName: 'Macon County, Illinois',
    dataDate: '',
    minzoom: 13,
    maxzoom: 16,
    bounds: [-89.2179, 39.6526, -88.745, 40.0554],
    coverage,
    getTile: async (z, x, y) => (await pm.getZxy(z, x, y))?.data,
  };
}

describe.skipIf(!present)('real Macon County parcel archive', () => {
  it('reads tiles, finds parcels and lines, and keeps only the allowed fields', async () => {
    const a = archive();
    const src = new StoredParcelSource([a]);
    const centre = { lng: -88.959045, lat: 39.903416 };

    // One tile, decoded directly: how many parcels, which fields, what coordinate range.
    const t = tileAt(centre.lng, centre.lat, PARCEL_ZOOM);
    const raw = await a.getTile(t.z, t.x, t.y);
    expect(raw).toBeDefined();
    const d = decodeParcelTile(await decompressTile(raw!), t, 'il-macon');
    const xs = d.parcels.flatMap((p) => [p.bbox[0], p.bbox[2]]);
    console.log(
      `tile ${t.z}/${t.x}/${t.y}: extent ${d.extent}, ${d.parcels.length} features, ${new Set(d.parcels.map((p) => p.key)).size} parcel IDs, x from ${Math.min(...xs)} to ${Math.max(...xs)}`,
    );
    for (const p of d.parcels) expect(Object.keys(p.record)).toEqual([...PARCEL_RECORD_FIELDS]);

    // A grid of points across that tile, near its edges as well as inside.
    let inside = 0;
    let gaps = 0;
    let noLine = 0;
    let near5 = 0;
    const lines: number[] = [];
    const samples: string[] = [];
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const [lng, lat] = tileUnitsToLngLat(t, 1, 0.02 + 0.096 * i, 0.02 + 0.096 * j);
        const q = await src.positionQuery({ lng, lat });
        expect(q.coverage).toBe('ok');
        if (q.inside) inside++;
        else gaps++;
        if (!q.nearestLine) noLine++;
        else {
          lines.push(q.nearestLine.distanceM);
          if (q.nearestLine.distanceM < 5) near5++;
          const sides = (l: { pid: string }[]) => l.map((p) => p.pid).join('+') || 'none';
          if (samples.length < 6 && (i + j) % 7 === 0) {
            samples.push(`${q.inside ? sides(q.inside) : 'no parcel'}: line ${q.nearestLine.distanceM.toFixed(1)} m at ${q.nearestLine.bearingDeg.toFixed(0)} deg, ${sides(q.nearestLine.thisSide)} | ${sides(q.nearestLine.otherSide)}`);
          }
          // A line is reported only where the parcels on its two sides differ.
          expect(sides(q.nearestLine.thisSide)).not.toBe(sides(q.nearestLine.otherSide));
        }
      }
    }
    lines.sort((x, y) => x - y);
    console.log(`121 points: ${inside} in a parcel, ${gaps} in a gap, ${noLine} with no line within 150 m, ${near5} within 5 m of a line`);
    console.log(`nearest line distance: min ${lines[0]?.toFixed(1)} m, median ${lines[lines.length >> 1]?.toFixed(1)} m, max ${lines[lines.length - 1]?.toFixed(1)} m`);
    for (const s of samples) console.log(s);

    // A tap and an outline at the first parcel found.
    const tap = await src.parcelsAt(centre);
    console.log(`tap at the archive centre: ${tap.coverage}, parcel IDs ${tap.parcels.map((p) => p.pid).join(', ') || 'none'}`);
    const first = tap.parcels[0];
    if (first) {
      const o = await src.outline(first.pid, first.county, centre);
      console.log(`outline of ${first.pid}: ${o?.tilesRead} tiles, complete ${o?.complete}, ${o?.fill.coordinates.length} fill pieces, ${o?.lines.coordinates.length} line runs`);
      const rings = d.parcels.filter((p) => p.record.pid === first.pid).map((p) => p.rings.map((r) => Math.round(signedArea(r))));
      console.log(`its features in the centre tile, signed ring areas in tile units: ${JSON.stringify(rings)}`);
      const f = d.parcels.find((p) => p.record.pid === first.pid);
      if (f && f.rings.length > 1) {
        const r1 = f.rings[1]!;
        console.log(`second ring's first corner inside the first ring: ${insideRings([f.rings[0]!], r1[0]!, r1[1]!)}`);
      }
      expect(o).not.toBeNull();
    }

    // Clip edge cross-check. This tile's west and north edges lie inside a
    // zoom 15 tile, where there is no cut at all. Points just either side of
    // those edges must get the same answer from zoom 16 (with its clip edges
    // removed by the rules) as from zoom 15 (which never had them there).
    // Zoom 15 is simplified slightly, so distances may differ by a fraction
    // of a meter.
    expect(t.x % 2).toBe(1);
    expect(t.y % 2).toBe(1);
    const z15 = new StoredParcelSource([a], { zoom: 15 });
    let compared = 0;
    let maxDiff = 0;
    let sideMismatch = 0;
    let insideMismatch = 0;
    const pidsOf = (l: { pid: string }[] | null | undefined) => (l ?? []).map((p) => p.pid).join('+');
    for (const off of [-0.01, -0.002, 0.002, 0.01]) {
      for (let k = 0; k < 15; k++) {
        const along = 0.03 + k * 0.066;
        for (const [ux, uy] of [
          [off, along],
          [along, off],
        ] as const) {
          const [lng, lat] = tileUnitsToLngLat(t, 1, ux, uy);
          const q16 = await src.positionQuery({ lng, lat });
          const q15 = await z15.positionQuery({ lng, lat });
          if (pidsOf(q16.inside) !== pidsOf(q15.inside)) insideMismatch++;
          if (!q16.nearestLine || !q15.nearestLine) continue;
          compared++;
          maxDiff = Math.max(maxDiff, Math.abs(q16.nearestLine.distanceM - q15.nearestLine.distanceM));
          const s16 = [pidsOf(q16.nearestLine.thisSide), pidsOf(q16.nearestLine.otherSide)].sort().join('|');
          const s15 = [pidsOf(q15.nearestLine.thisSide), pidsOf(q15.nearestLine.otherSide)].sort().join('|');
          if (s16 !== s15) sideMismatch++;
          const diff = Math.abs(q16.nearestLine.distanceM - q15.nearestLine.distanceM);
          if (s16 !== s15 || diff > 0.3) {
            const [px, py] = lngLatToTileUnits(t, 4096, q16.nearestLine.point.lng, q16.nearestLine.point.lat);
            console.log(
              `  at (${ux.toFixed(3)}, ${uy.toFixed(3)}): z16 ${q16.nearestLine.distanceM.toFixed(2)} m ${q16.nearestLine.bearingDeg.toFixed(0)} deg [${s16}] line point in tile units (${px.toFixed(1)}, ${py.toFixed(1)}); z15 ${q15.nearestLine.distanceM.toFixed(2)} m ${q15.nearestLine.bearingDeg.toFixed(0)} deg [${s15}]`,
            );
          }
        }
      }
    }
    console.log(`clip edge cross-check, zoom 16 against zoom 15 at ${compared} points beside two tile edges: largest distance difference ${maxDiff.toFixed(2)} m, ${sideMismatch} with different parcels at the line, ${insideMismatch} with a different containing parcel`);
    expect(maxDiff).toBeLessThan(0.5);
    expect(insideMismatch).toBe(0);
    // sideMismatch is 1 on the 2026-10-28 data and stays a logged number: at
    // that point two lines lie within 0.05 m of the same distance, and the
    // slightly simplified zoom 15 picks the other one.

    // Timing: a fix a second must be cheap once the tiles are in the cache.
    const start = performance.now();
    for (let k = 0; k < 20; k++) await src.positionQuery({ lng: centre.lng + k * 1e-5, lat: centre.lat });
    console.log(`20 cached queries: ${((performance.now() - start) / 20).toFixed(1)} ms each`);
  }, 60000);

  const coverage = present ? coverageFromMeta() : null;

  it.skipIf(!coverage)('tells land outside the county from a gap inside it, with the county outline from the metadata', async () => {
    const src = new StoredParcelSource([archive(coverage)]);
    const read = async (lng: number, lat: number, accuracyM = 5) => {
      const q = await src.positionQuery({ lng, lat });
      return { q, r: positionReadout({ lng, lat, accuracyM }, q) };
    };
    // 394 m outside the county, where a tile that straddles the county line
    // exists: this read "Not in a parcel" before the outline was used.
    const outside = await read(-89.14271, 39.6529);
    expect(outside.q.coverage).toBe('outside');
    expect(outside.r.kind).not.toBe('no-parcel');
    expect(outside.r).toEqual({ kind: 'no-data', reason: 'outside' });
    // Lake Decatur, inside the county, where there is no tile at all: this
    // read "No property lines for this place yet" before.
    const lake = await read(-88.939, 39.819);
    expect(lake.q.coverage).toBe('ok');
    expect(lake.r.kind).not.toBe('no-data');
    expect(lake.r.kind).toBe('no-parcel');
    const tap = await src.parcelsAt({ lng: -89.14271, lat: 39.6529 });
    expect(tap.coverage).toBe('outside');
    console.log(`outside the county: ${outside.r.kind}; the lake: ${lake.r.kind}, ${lake.q.nearestLine ? `line ${lake.q.nearestLine.distanceM.toFixed(0)} m` : 'no line within 150 m'}`);
  }, 60000);

  it('names the outer parcel across the edge of a parcel lying inside it', async () => {
    const src = new StoredParcelSource([archive()]);
    const at = { lng: -88.96018, lat: 39.91608 };
    const q = await src.positionQuery(at);
    const r = positionReadout({ ...at, accuracyM: 4 }, q);
    expect(r.kind).toBe('inside');
    if (r.kind !== 'inside') return;
    expect(r.parcel.pid).toBe('07-07-22-226-008');
    expect(r.alsoIn.map((p) => p.pid)).toEqual(['07-07-22-226-006']);
    expect(r.neighbour?.pid).toBe('07-07-22-226-006');
  }, 60000);
});
