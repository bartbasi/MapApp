// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The parcels around one point, laid out in a flat frame in meters with the
// point at the origin, and the two questions the readout asks of them: which
// parcels hold the point, and where is the nearest property line.
//
// HOW TILE CLIP EDGES ARE KEPT OUT OF THE ANSWER
//
// A vector tile holds each parcel cut to the tile square plus a buffer. The
// cut makes edges that run along the cut rectangle. They are not property
// lines. Two rules, applied in order, keep them out:
//
// 1. Each tile speaks only for its own square. Every outline segment is cut
//    to the square 0..extent in both directions, and only the part inside
//    (edges included) is a candidate. The buffer is never read for lines:
//    whatever lies there is taken from the neighbouring tile, which is always
//    loaded when the search circle reaches it. Clip edges made by a buffer of
//    any size lie wholly outside the square, so this removes them without
//    knowing the buffer size.
//
// 2. A line is a property line only if the parcels on its two sides differ.
//    A candidate is tested by looking a hand's breadth (2 cm) to each side of
//    it, near the point closest to the phone. If the same parcels lie on both
//    sides, the segment is dropped and the next nearest is tried. This
//    removes what rule 1 cannot: clip edges of a tile built with no buffer,
//    which lie exactly on the square's edge, and the seam between two
//    features that carry the same parcel ID. A real line that happens to lie
//    exactly on a tile edge is kept, because different parcels lie on its
//    two sides.
//
// Both rules, and the test of which parcel holds the phone, answer every
// place from the tile that owns it: a piece counts only inside its own tile
// square. Buffer copies are never used. This matters: where the tiler cuts a
// slanted edge at the buffer line it rounds the new corner to a whole tile
// unit, so a neighbour's buffer copy of an edge can run several centimeters
// off the owning tile's copy. With buffer copies counted, the 2 cm side test
// found the same parcel on both sides of a real line and threw the line
// away. That was found on the real Macon County data and is tested.
//
// Rule 2 is checked at the candidate's point nearest the phone. In a clean
// parcel map (no overlaps) a segment that is a property line anywhere near
// that point is caught there, by its own copy or by the neighbour's copy of
// the same line. With overlapping parcels a candidate that is internal at its
// nearest point but a property line further along could in principle be
// passed over; its neighbour's copy of the line is still tested on its own.

import { LocalFrame } from './local-frame';
import type { DecodedParcelTile } from './parcel-tile';
import type { ParcelRecord } from './parcel-record';
import { clipRing, clipSegment, insideRings, nearestT, signedArea, type Box, type Ring } from './planar';
import { lngLatToTileUnits, tileUnitsToLngLat } from './tile-coords';

/** How far to each side of a line the parcels are looked up, in meters. */
const SIDE_PROBE_M = 0.02;
/** How far from a segment's end the side test is made, at most, in meters. */
const END_INSET_M = 0.05;

interface Piece {
  key: string;
  record: ParcelRecord;
  tile: DecodedParcelTile;
  /** Rings in tile units. */
  tileRings: readonly Ring[];
  /** The same rings in local meters. */
  rings: number[][];
  /** Where this piece may answer, in local meters: its rings' bounding box cut to its tile square. */
  bbox: Box;
}

export interface RawLine {
  distanceM: number;
  /** The nearest point on the line, in local meters. */
  x: number;
  y: number;
  /** Parcel keys on the phone's side and on the far side, smallest area first. */
  thisSide: string[];
  otherSide: string[];
}

interface Candidate {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  t: number;
  d: number;
}

export class ParcelScene {
  readonly frame: LocalFrame;
  private readonly pieces: Piece[] = [];
  private readonly areas = new Map<string, number>();

  /**
   * @param tiles decoded tiles, from any number of archives
   * @param origin the point the questions are asked about
   * @param reachM pieces further than this (by bounding box) are left out
   */
  constructor(
    tiles: readonly DecodedParcelTile[],
    origin: { lng: number; lat: number },
    reachM: number,
  ) {
    this.frame = new LocalFrame(origin.lng, origin.lat);
    const [west, south] = this.frame.toLngLat(-reachM, -reachM);
    const [east, north] = this.frame.toLngLat(reachM, reachM);
    for (const tile of tiles) {
      const [x0, y0] = lngLatToTileUnits(tile.tile, tile.extent, west, north);
      const [x1, y1] = lngLatToTileUnits(tile.tile, tile.extent, east, south);
      // The tile square in local meters. Meridians and parallels are straight
      // axis lines in this frame, so the square is an axis-aligned box.
      const [sqWest, sqNorth] = this.toLocal(tile, 0, 0);
      const [sqEast, sqSouth] = this.toLocal(tile, tile.extent, tile.extent);
      for (const p of tile.parcels) {
        if (p.bbox[2] < x0 || p.bbox[0] > x1 || p.bbox[3] < y0 || p.bbox[1] > y1) continue;
        const rings = p.rings.map((r) => this.ringToLocal(tile, r));
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const r of rings) {
          for (let i = 0; i < r.length; i += 2) {
            minX = Math.min(minX, r[i]!);
            maxX = Math.max(maxX, r[i]!);
            minY = Math.min(minY, r[i + 1]!);
            maxY = Math.max(maxY, r[i + 1]!);
          }
        }
        const bbox: Box = [Math.max(minX, sqWest), Math.max(minY, sqSouth), Math.min(maxX, sqEast), Math.min(maxY, sqNorth)];
        this.pieces.push({ key: p.key, record: p.record, tile, tileRings: p.rings, rings, bbox });
      }
    }
  }

  private toLocal(tile: DecodedParcelTile, tx: number, ty: number): [number, number] {
    const [lng, lat] = tileUnitsToLngLat(tile.tile, tile.extent, tx, ty);
    return this.frame.toLocal(lng, lat);
  }

  private ringToLocal(tile: DecodedParcelTile, r: Ring): number[] {
    const out: number[] = new Array<number>(r.length);
    for (let i = 0; i < r.length; i += 2) {
      const [x, y] = this.toLocal(tile, r[i]!, r[i + 1]!);
      out[i] = x;
      out[i + 1] = y;
    }
    return out;
  }

  /** The record of a parcel key seen in this scene. */
  record(key: string): ParcelRecord | undefined {
    return this.pieces.find((p) => p.key === key)?.record;
  }

  /** The archive county of the tile a parcel key was read from. */
  archiveCounty(key: string): string | undefined {
    return this.pieces.find((p) => p.key === key)?.tile.county;
  }

  /**
   * A parcel's area in square meters, counting only the loaded tiles. Each
   * piece is cut to its own tile square first, so buffers are not counted
   * twice. A parcel reaching past the loaded tiles is under-counted.
   */
  areaM2(key: string): number {
    const known = this.areas.get(key);
    if (known !== undefined) return known;
    let total = 0;
    for (const p of this.pieces) {
      if (p.key !== key) continue;
      const square: Box = [0, 0, p.tile.extent, p.tile.extent];
      let s = 0;
      for (const r of p.tileRings) {
        const clipped = clipRing(r, square);
        if (clipped.length >= 6) s += signedArea(this.ringToLocal(p.tile, clipped));
      }
      total += Math.abs(s);
    }
    this.areas.set(key, total);
    return total;
  }

  /** Keys of the parcels holding a local point, smallest area first. */
  containing(x: number, y: number): string[] {
    const keys = new Set<string>();
    for (const p of this.pieces) {
      if (keys.has(p.key)) continue;
      if (x < p.bbox[0] || x > p.bbox[2] || y < p.bbox[1] || y > p.bbox[3]) continue;
      if (insideRings(p.rings, x, y)) keys.add(p.key);
    }
    return [...keys].sort((a, b) => this.areaM2(a) - this.areaM2(b) || (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * The nearest property line to the origin within a radius, or null if
   * there is none. See the clip edge rules at the top of this file.
   */
  nearestLine(radiusM: number): RawLine | null {
    const candidates: Candidate[] = [];
    for (const p of this.pieces) {
      const e = p.tile.extent;
      const square: Box = [0, 0, e, e];
      p.tileRings.forEach((tr, ri) => {
        const lr = p.rings[ri]!;
        const n = tr.length >> 1;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const tx0 = tr[2 * i]!;
          const ty0 = tr[2 * i + 1]!;
          const tx1 = tr[2 * j]!;
          const ty1 = tr[2 * j + 1]!;
          // Rule 1: only the part inside this tile's own square.
          const clip = clipSegment(tx0, ty0, tx1, ty1, square);
          if (!clip || clip[1] <= clip[0]) continue;
          const [ax, ay] = clip[0] === 0 ? [lr[2 * i]!, lr[2 * i + 1]!] : this.toLocal(p.tile, tx0 + (tx1 - tx0) * clip[0], ty0 + (ty1 - ty0) * clip[0]);
          const [bx, by] = clip[1] === 1 ? [lr[2 * j]!, lr[2 * j + 1]!] : this.toLocal(p.tile, tx0 + (tx1 - tx0) * clip[1], ty0 + (ty1 - ty0) * clip[1]);
          if (ax === bx && ay === by) continue;
          const t = nearestT(ax, ay, bx, by, 0, 0);
          const d = Math.hypot(ax + (bx - ax) * t, ay + (by - ay) * t);
          if (d <= radiusM) candidates.push({ ax, ay, bx, by, t, d });
        }
      });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const c of candidates) {
      const sides = this.sides(c);
      if (sameKeys(sides.thisSide, sides.otherSide)) continue; // Rule 2
      return { distanceM: c.d, x: c.ax + (c.bx - c.ax) * c.t, y: c.ay + (c.by - c.ay) * c.t, ...sides };
    }
    return null;
  }

  /** The parcels just to each side of a candidate, near its point closest to the origin. */
  private sides(c: Candidate): { thisSide: string[]; otherSide: string[] } {
    const dx = c.bx - c.ax;
    const dy = c.by - c.ay;
    const len = Math.hypot(dx, dy);
    const inset = Math.min(END_INSET_M, len / 2);
    const along = Math.min(Math.max(c.t * len, inset), len - inset);
    const baseX = c.ax + (dx / len) * along;
    const baseY = c.ay + (dy / len) * along;
    // Unit normal to the left of A to B, then turned toward the origin.
    let nx = -dy / len;
    let ny = dx / len;
    const cross = dx * (0 - c.ay) - dy * (0 - c.ax);
    if (cross < 0) {
      nx = -nx;
      ny = -ny;
    }
    return {
      thisSide: this.containing(baseX + nx * SIDE_PROBE_M, baseY + ny * SIDE_PROBE_M),
      otherSide: this.containing(baseX - nx * SIDE_PROBE_M, baseY - ny * SIDE_PROBE_M),
    };
  }
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((k) => s.has(k));
}
