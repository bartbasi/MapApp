// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// One parcel's whole outline, put together from the tiles it lies in, for
// highlighting the parcel the phone is in.
//
// It is assembled, not merged into one polygon. The fill is one piece per
// tile, each cut to its own tile square, so the pieces meet edge to edge and
// never overlap: drawn together they look like one shape. The lines are the
// parcel's real property lines: tile clip edges and seams between features
// of the same parcel are removed by the same two rules as the readout (see
// parcel-scene.ts). Lines are joined into runs within each tile piece, but
// not across tile edges. A true polygon union was not worth its cost here.

import type { MultiLineString, MultiPolygon, Position } from 'geojson';
import { LocalFrame } from './local-frame';
import type { ParcelRecord } from './parcel-record';
import type { LngLat } from './parcel-source';
import { parcelKey, type DecodedParcelTile, type TileParcel } from './parcel-tile';
import { clipRing, clipSegment, insideRings, signedArea, type Box } from './planar';
import { PARCEL_ZOOM, tileAt, tileKey, tileUnitsToLngLat, type TileId } from './tile-coords';

export interface OutlineOptions {
  /** The most tiles to read. Default 25, about 2.3 km square at 40 degrees north. */
  maxTiles?: number;
  /** The zoom of the tiles `load` is asked for. Default 16. */
  zoom?: number;
}

export interface ParcelOutline {
  record: ParcelRecord;
  /** The parcel's area, one polygon per tile piece (and per part), cut to tile squares. */
  fill: MultiPolygon;
  /** The parcel's property lines, without tile clip edges or seams. */
  lines: MultiLineString;
  tilesRead: number;
  /** False when the parcel reaches past the tile limit, so part of it is missing. */
  complete: boolean;
}

const SIDE_PROBE_M = 0.02;

interface Found {
  tile: DecodedParcelTile;
  parcel: TileParcel;
  local: number[][];
  /** The piece's tile square in local meters: the only place the piece answers for (see parcel-scene.ts). */
  square: Box;
}

/**
 * Collects a parcel's pieces from the tile under `around` outward, following
 * the pieces across tile edges, then builds its fill and lines.
 * `load` returns every installed archive's copy of a tile.
 */
export async function assembleParcelOutline(
  load: (t: TileId) => Promise<DecodedParcelTile[]>,
  pid: string,
  county: string,
  around: LngLat,
  options: OutlineOptions = {},
): Promise<ParcelOutline | null> {
  const key = parcelKey(county, pid);
  const maxTiles = options.maxTiles ?? 25;
  const frame = new LocalFrame(around.lng, around.lat);
  const start = tileAt(around.lng, around.lat, options.zoom ?? PARCEL_ZOOM);
  const queue: TileId[] = [start];
  const seen = new Set([tileKey(start)]);
  const found: Found[] = [];
  let tilesRead = 0;
  let complete = true;
  while (queue.length > 0) {
    const t = queue.shift() as TileId;
    if (tilesRead >= maxTiles) {
      complete = false;
      break;
    }
    tilesRead++;
    for (const tile of await load(t)) {
      const e = tile.extent;
      for (const parcel of tile.parcels) {
        if (parcel.key !== key) continue;
        const local = parcel.rings.map((r) => {
          const out: number[] = [];
          for (let i = 0; i < r.length; i += 2) {
            const [lng, lat] = tileUnitsToLngLat(tile.tile, e, r[i]!, r[i + 1]!);
            out.push(...frame.toLocal(lng, lat));
          }
          return out;
        });
        const [west, north] = frame.toLocal(...tileUnitsToLngLat(tile.tile, e, 0, 0));
        const [east, south] = frame.toLocal(...tileUnitsToLngLat(tile.tile, e, e, e));
        found.push({ tile, parcel, local, square: [west, south, east, north] });
        // Follow the piece into each neighbouring tile it reaches.
        const xs = [0, ...(parcel.bbox[0] <= 0 ? [-1] : []), ...(parcel.bbox[2] >= e ? [1] : [])];
        const ys = [0, ...(parcel.bbox[1] <= 0 ? [-1] : []), ...(parcel.bbox[3] >= e ? [1] : [])];
        for (const dx of xs) {
          for (const dy of ys) {
            const next = { z: t.z, x: t.x + dx, y: t.y + dy };
            if (seen.has(tileKey(next))) continue;
            seen.add(tileKey(next));
            queue.push(next);
          }
        }
      }
    }
    if (tilesRead === 1 && found.length === 0) return null;
  }
  const first = found[0];
  if (!first) return null;

  const inParcel = (x: number, y: number) =>
    found.some((f) => x >= f.square[0] && x <= f.square[2] && y >= f.square[1] && y <= f.square[3] && insideRings(f.local, x, y));
  const toPos = (tile: DecodedParcelTile, tx: number, ty: number): Position => tileUnitsToLngLat(tile.tile, tile.extent, tx, ty);

  // Fill: each piece cut to its tile square. In a tile the first ring of a
  // polygon is an outer ring; rings of the opposite turn that follow are its holes.
  const polygons: Position[][][] = [];
  for (const { tile, parcel } of found) {
    const square: Box = [0, 0, tile.extent, tile.extent];
    let outerSign = 0;
    for (const r of parcel.rings) {
      const sign = Math.sign(signedArea(r));
      if (outerSign === 0) outerSign = sign;
      const clipped = clipRing(r, square);
      if (clipped.length < 6 || Math.abs(signedArea(clipped)) < 1e-9) continue;
      const ring: Position[] = [];
      for (let i = 0; i < clipped.length; i += 2) ring.push(toPos(tile, clipped[i]!, clipped[i + 1]!));
      ring.push(ring[0] as Position);
      const current = polygons[polygons.length - 1];
      if (sign === outerSign || !current) polygons.push([ring]);
      else current.push(ring);
    }
  }

  // Lines: each edge cut to its tile square, kept only where the parcel lies
  // on exactly one side of it, joined into runs.
  const lines: Position[][] = [];
  for (const { tile, parcel, local } of found) {
    const square: Box = [0, 0, tile.extent, tile.extent];
    parcel.rings.forEach((r, ri) => {
      const lr = local[ri]!;
      const n = r.length >> 1;
      const runs: Position[][] = [];
      let open: Position[] | null = null; // the run the next edge may continue
      let firstStartsAtCorner = false;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const clip = clipSegment(r[2 * i]!, r[2 * i + 1]!, r[2 * j]!, r[2 * j + 1]!, square);
        if (!clip || clip[1] <= clip[0]) {
          open = null;
          continue;
        }
        const [t0, t1] = clip;
        // The side test, at the middle of the kept part, in local meters.
        const ax = lr[2 * i]!;
        const ay = lr[2 * i + 1]!;
        const bx = lr[2 * j]!;
        const by = lr[2 * j + 1]!;
        const len = Math.hypot(bx - ax, by - ay);
        const tm = (t0 + t1) / 2;
        const mx = ax + (bx - ax) * tm;
        const my = ay + (by - ay) * tm;
        const nx = len === 0 ? 0 : (-(by - ay) / len) * SIDE_PROBE_M;
        const ny = len === 0 ? 0 : ((bx - ax) / len) * SIDE_PROBE_M;
        if (len === 0 || inParcel(mx + nx, my + ny) === inParcel(mx - nx, my - ny)) {
          open = null;
          continue;
        }
        const tx = (t: number) => r[2 * i]! + (r[2 * j]! - r[2 * i]!) * t;
        const ty = (t: number) => r[2 * i + 1]! + (r[2 * j + 1]! - r[2 * i + 1]!) * t;
        const b = toPos(tile, tx(t1), ty(t1));
        if (open && t0 === 0) {
          open.push(b);
        } else {
          open = [toPos(tile, tx(t0), ty(t0)), b];
          runs.push(open);
          if (i === 0 && t0 === 0) firstStartsAtCorner = true;
        }
        if (t1 !== 1) open = null;
      }
      // A run still open after the last edge ends at the first corner: if
      // another run starts there, they are one line.
      const head = runs[0];
      if (open && head && open !== head && firstStartsAtCorner) {
        open.push(...head.slice(1));
        runs.shift();
      }
      lines.push(...runs);
    });
  }

  return {
    record: first.parcel.record,
    fill: { type: 'MultiPolygon', coordinates: polygons },
    lines: { type: 'MultiLineString', coordinates: lines },
    tilesRead,
    complete,
  };
}
