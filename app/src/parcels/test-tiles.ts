// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Test support, not used by the app: synthetic parcel tiles encoded by hand
// with pbf, and fake parcel archives that serve them.
//
// Parcels are laid out in meters east and north of an origin and turned into
// degrees with the published lengths of a degree at 40 degrees north
// (111,035 m of latitude, 85,394 m of longitude), not with the code under
// test. The tests then compare the code's distances with the distances the
// layout was drawn with.

import { PbfWriter } from 'pbf';
import { tileBounds } from '../map/tile-math';
import { clipRing } from './planar';
import { PARCEL_ZOOM, lngLatToTileUnits, tileAt, tileKey, tileUnitsToLngLat, type TileId } from './tile-coords';
import type { LngLat } from './parcel-source';
import type { ParcelArchive } from './stored-parcel-source';

export const M_PER_DEG_LAT = 111035;
export const M_PER_DEG_LNG = 85394;

type Value = string | number | boolean;

export interface EncodedFeature {
  properties: Record<string, Value>;
  /** Rings in tile units, not closed. */
  rings: [number, number][][];
  type?: 1 | 2 | 3;
}

export interface EncodedLayer {
  name: string;
  extent?: number;
  features: EncodedFeature[];
}

const zigzag = (n: number) => (n << 1) ^ (n >> 31);
const command = (id: number, count: number) => (id & 7) | (count << 3);

function writeValue(v: Value, pbf: PbfWriter): void {
  if (typeof v === 'string') pbf.writeStringField(1, v);
  else if (typeof v === 'boolean') pbf.writeBooleanField(7, v);
  else if (Number.isInteger(v)) {
    if (v >= 0) pbf.writeVarintField(5, v);
    else pbf.writeSVarintField(6, v);
  } else pbf.writeDoubleField(3, v);
}

/** Encodes a vector tile (spec version 2). */
export function encodeTile(layers: readonly EncodedLayer[]): Uint8Array {
  const pbf = new PbfWriter();
  for (const layer of layers) {
    pbf.writeMessage(
      3,
      (l: EncodedLayer, p: PbfWriter) => {
        p.writeVarintField(15, 2);
        p.writeStringField(1, l.name);
        const keys: string[] = [];
        const values: Value[] = [];
        const keyIndex = new Map<string, number>();
        const valueIndex = new Map<string, number>();
        for (const f of l.features) {
          const tags: number[] = [];
          for (const [k, v] of Object.entries(f.properties)) {
            if (!keyIndex.has(k)) {
              keyIndex.set(k, keys.length);
              keys.push(k);
            }
            const vk = `${typeof v}:${String(v)}`;
            if (!valueIndex.has(vk)) {
              valueIndex.set(vk, values.length);
              values.push(v);
            }
            tags.push(keyIndex.get(k)!, valueIndex.get(vk)!);
          }
          const geom: number[] = [];
          let cx = 0;
          let cy = 0;
          for (const ring of f.rings) {
            ring.forEach(([x, y], i) => {
              if (i === 0) geom.push(command(1, 1));
              if (i === 1) geom.push(command(2, ring.length - 1));
              geom.push(zigzag(x - cx), zigzag(y - cy));
              cx = x;
              cy = y;
            });
            if ((f.type ?? 3) === 3) geom.push(command(7, 1));
          }
          p.writeMessage(
            2,
            (_: null, fp: PbfWriter) => {
              fp.writePackedVarint(2, tags);
              fp.writeVarintField(3, f.type ?? 3);
              fp.writePackedVarint(4, geom);
            },
            null,
          );
        }
        for (const k of keys) p.writeStringField(3, k);
        for (const v of values) p.writeMessage(4, writeValue, v);
        p.writeVarintField(5, l.extent ?? 4096);
      },
      layer,
    );
  }
  return pbf.finish();
}

/** A parcel laid out in meters east and north of the world's origin. */
export interface MeterParcel {
  properties: Record<string, Value>;
  rings: [number, number][][];
}

/** An axis-aligned rectangle ring in meters, counterclockwise with north up. */
export function rect(west: number, south: number, east: number, north: number): [number, number][] {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ];
}

export interface TileOptions {
  extent?: number;
  /** Clip buffer in tile units around the tile square. tippecanoe's default is 80 at extent 4096. */
  buffer?: number;
}

export interface FakeArchive extends ParcelArchive {
  /** How many times a tile was asked for. */
  reads: number;
}

/** A flat test world around an origin, with the zoom 16 tile under it. */
export class SynthWorld {
  readonly origin: LngLat;
  readonly center: TileId;

  /** The world is centred on the middle of the zoom 16 tile holding `near`. */
  constructor(near: LngLat = { lng: -88.95, lat: 40.0 }) {
    const t = tileAt(near.lng, near.lat, PARCEL_ZOOM);
    const [lng, lat] = tileUnitsToLngLat(t, 1, 0.5, 0.5);
    this.origin = { lng, lat };
    this.center = t;
  }

  at(east: number, north: number): LngLat {
    return { lng: this.origin.lng + east / M_PER_DEG_LNG, lat: this.origin.lat + north / M_PER_DEG_LAT };
  }

  /** The centre tile's edges in meters from the origin. */
  edges(): { west: number; south: number; east: number; north: number } {
    const [w, s, e, n] = tileBounds(this.center.z, this.center.x, this.center.y);
    return {
      west: (w - this.origin.lng) * M_PER_DEG_LNG,
      east: (e - this.origin.lng) * M_PER_DEG_LNG,
      south: (s - this.origin.lat) * M_PER_DEG_LAT,
      north: (n - this.origin.lat) * M_PER_DEG_LAT,
    };
  }

  neighbour(dx: number, dy: number): TileId {
    return { z: this.center.z, x: this.center.x + dx, y: this.center.y + dy };
  }

  /** The parcels as one tile would hold them: rounded to tile units and clipped to the square plus buffer. Null if nothing is left. */
  encode(tile: TileId, parcels: readonly MeterParcel[], options: TileOptions = {}): Uint8Array | null {
    const extent = options.extent ?? 4096;
    const b = options.buffer ?? 80;
    const features: EncodedFeature[] = [];
    for (const p of parcels) {
      const rings: [number, number][][] = [];
      for (const ring of p.rings) {
        const flat: number[] = [];
        for (const [e, n] of ring) {
          const ll = this.at(e, n);
          const [tx, ty] = lngLatToTileUnits(tile, extent, ll.lng, ll.lat);
          flat.push(Math.round(tx), Math.round(ty));
        }
        const clipped = clipRing(flat, [-b, -b, extent + b, extent + b]);
        if (clipped.length < 6) continue;
        const out: [number, number][] = [];
        for (let i = 0; i < clipped.length; i += 2) {
          const pt: [number, number] = [Math.round(clipped[i]!), Math.round(clipped[i + 1]!)];
          const last = out[out.length - 1];
          if (!last || last[0] !== pt[0] || last[1] !== pt[1]) out.push(pt);
        }
        if (out.length >= 3) rings.push(out);
      }
      if (rings.length > 0) features.push({ properties: p.properties, rings });
    }
    if (features.length === 0) return null;
    return encodeTile([{ name: 'parcels', extent, features }]);
  }

  /** A fake archive holding the given parcels in the centre tile and its eight neighbours. */
  archive(parcels: readonly MeterParcel[], options: TileOptions & { county?: string; tiles?: TileId[] } = {}): FakeArchive {
    const county = options.county ?? 'il-test';
    const tiles = options.tiles ?? [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => this.neighbour(dx, dy)));
    const store = new Map<string, Uint8Array>();
    for (const t of tiles) {
      const bytes = this.encode(t, parcels, options);
      if (bytes) store.set(tileKey(t), bytes);
    }
    return fakeArchive(county, store, this.boundsOf(tiles));
  }

  boundsOf(tiles: readonly TileId[]): [number, number, number, number] {
    const all = tiles.map((t) => tileBounds(t.z, t.x, t.y));
    return [Math.min(...all.map((b) => b[0])), Math.min(...all.map((b) => b[1])), Math.max(...all.map((b) => b[2])), Math.max(...all.map((b) => b[3]))];
  }
}

/** An archive answering from a map of "z/x/y" to tile bytes. */
export function fakeArchive(county: string, store: ReadonlyMap<string, Uint8Array>, bounds: [number, number, number, number]): FakeArchive {
  const a: FakeArchive = {
    id: `${county}/parcels`,
    layer: 'parcels',
    county,
    countyName: `Test County ${county}`,
    dataDate: '2026-10-28',
    minzoom: 13,
    maxzoom: 16,
    bounds,
    reads: 0,
    async getTile(z, x, y) {
      a.reads++;
      const b = store.get(`${z}/${x}/${y}`);
      return b ? (b.slice().buffer as ArrayBuffer) : undefined;
    },
  };
  return a;
}
