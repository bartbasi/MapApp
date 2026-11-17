// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The parcel source for stored data: the installed parcel archives, one per
// county (D25, D27). It reads the zoom 16 tile under a point straight from the
// archives, whatever the map is showing, plus the neighbouring tiles the
// search circle reaches, and answers from those.
//
// Where an archive's metadata gives its coverage area (the county outline),
// a point in no parcel is judged by it: well inside, it is a gap such as a
// road or a lake, even where the tile under it is missing; outside or near
// the edge, the data cannot say what is there ('outside'). A point inside a
// parcel is answered as such wherever it is: the parcel is better evidence
// than the Census line. Without a coverage area, the archive's bounding box
// and the tile under the point decide, as before.

import type { OpenArchive } from '../map/archives';
import { boundsOverlap, tileBounds } from '../map/tile-math';
import type { TileArchive } from '../map/tile-resolver';
import { CoverageArea } from './coverage-area';
import { bearingOf } from './local-frame';
import { LruCache } from './lru-cache';
import { assembleParcelOutline, type OutlineOptions, type ParcelOutline } from './parcel-outline';
import { ParcelScene } from './parcel-scene';
import {
  DEFAULT_SEARCH_RADIUS_M,
  type LngLat,
  type ParcelCoverage,
  type ParcelDetails,
  type ParcelLookup,
  type ParcelSource,
  type PositionQuery,
  type PositionQueryOptions,
} from './parcel-source';
import { decodeParcelTile, decompressTile, type DecodedParcelTile } from './parcel-tile';
import { PARCEL_ZOOM, tileAt, tileKey, type TileId } from './tile-coords';

/** The archive layer id of parcel archives (D27). */
export const PARCEL_LAYER = 'parcels';

/** One county's parcel archive, with what the screens say about its data. */
export interface ParcelArchive extends TileArchive {
  readonly countyName: string;
  /** The county data's date, or empty if the metadata gives none. */
  readonly dataDate: string;
  /** The area the data covers, or null when the metadata does not give it. */
  readonly coverage: CoverageArea | null;
}

/** The parcel archives among the open archives of a data session. */
export function parcelArchivesFrom(archives: readonly OpenArchive[]): ParcelArchive[] {
  return archives
    .filter((a) => a.layer === PARCEL_LAYER)
    .map((a) => ({
      id: a.id,
      layer: a.layer,
      county: a.county,
      minzoom: a.minzoom,
      maxzoom: a.maxzoom,
      bounds: a.bounds,
      getTile: (z: number, x: number, y: number, signal?: AbortSignal) => a.getTile(z, x, y, signal),
      countyName: a.entry.meta.countyName,
      dataDate: a.entry.meta.sources.map((s) => s.dataDate).find((d) => d) ?? '',
      coverage: a.entry.meta.coverage ? new CoverageArea(a.entry.meta.coverage) : null,
    }));
}

/**
 * Tiles are read for a little more than the search radius, so that the side
 * test just past a line at the edge of the radius still sees the parcels there.
 */
const REACH_MARGIN_M = 1;

/** The reach for a tap: the tile under the point, and a neighbour only if the point is within a meter of its edge. */
const TAP_REACH_M = 1;

/**
 * How far past its bounding box, in degrees, an archive with a coverage area
 * is still read (about 1 km). Some parcels reach past the county outline,
 * and near the county line a line within reach must still be found.
 */
const COVERAGE_BOUNDS_MARGIN_DEG = 0.01;

/**
 * What the coverage areas say about a point:
 * - covered: well inside an archive's coverage area;
 * - uncovered: outside every coverage area or near its edge, and no archive
 *   without a coverage area holds the point in its bounding box;
 * - unknown: an archive without a coverage area holds the point in its box.
 */
type CoverageAt = 'covered' | 'uncovered' | 'unknown';

export interface StoredParcelSourceOptions {
  /** How many decoded tiles to keep. Default 12. */
  cacheTiles?: number;
  /**
   * The zoom read. Default PARCEL_ZOOM (16), the only zoom with every parcel
   * at full detail. Another zoom is for cross-checks in tests only.
   */
  zoom?: number;
}

interface Loaded {
  coverage: ParcelCoverage;
  tiles: DecodedParcelTile[];
}

function inBox(b: readonly number[], lng: number, lat: number, margin = 0): boolean {
  return lng >= b[0]! - margin && lng <= b[2]! + margin && lat >= b[1]! - margin && lat <= b[3]! + margin;
}

function grow(b: readonly [number, number, number, number], d: number): [number, number, number, number] {
  return [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
}

function sameTile(a: TileId, b: TileId): boolean {
  return a.z === b.z && a.x === b.x && a.y === b.y;
}

export class StoredParcelSource implements ParcelSource {
  private readonly archives: readonly ParcelArchive[];
  private readonly cache: LruCache<string, Promise<DecodedParcelTile | null>>;
  private readonly zoom: number;

  constructor(archives: readonly ParcelArchive[], options: StoredParcelSourceOptions = {}) {
    this.zoom = options.zoom ?? PARCEL_ZOOM;
    this.archives = archives.filter((a) => this.zoom >= a.minzoom && this.zoom <= a.maxzoom);
    this.cache = new LruCache(options.cacheTiles ?? 12);
  }

  /** How far past its bounding box an archive is read. */
  private static margin(a: ParcelArchive): number {
    return a.coverage ? COVERAGE_BOUNDS_MARGIN_DEG : 0;
  }

  private covering(at: LngLat): ParcelArchive[] {
    return this.archives.filter((a) => inBox(a.bounds, at.lng, at.lat, StoredParcelSource.margin(a)));
  }

  private archivesFor(t: TileId): ParcelArchive[] {
    const tb = tileBounds(t.z, t.x, t.y);
    return this.archives.filter((a) => boundsOverlap(grow(a.bounds, StoredParcelSource.margin(a)), tb));
  }

  /** What the coverage areas say about a point (see CoverageAt). */
  private coverageAt(lng: number, lat: number): CoverageAt {
    let unknown = false;
    for (const a of this.archives) {
      if (a.coverage) {
        if (a.coverage.covers(lng, lat)) return 'covered';
      } else if (inBox(a.bounds, lng, lat)) {
        unknown = true;
      }
    }
    return unknown ? 'unknown' : 'uncovered';
  }

  /** Whether the side of a line at a probe point (scene meters) has data: it holds a parcel, or it is covered. */
  private sideCovered(scene: ParcelScene, keys: readonly string[], probe: [number, number]): boolean {
    if (keys.length > 0) return true;
    const [lng, lat] = scene.frame.toLngLat(probe[0], probe[1]);
    return this.coverageAt(lng, lat) !== 'uncovered';
  }

  /** The coverage of a point that is in no parcel. */
  private gapCoverage(at: LngLat): ParcelCoverage {
    return this.coverageAt(at.lng, at.lat) === 'uncovered' ? 'outside' : 'ok';
  }

  /** One archive's copy of a tile, decoded, or null if the archive does not hold it. Cached. */
  private readTile(a: ParcelArchive, t: TileId): Promise<DecodedParcelTile | null> {
    const key = `${a.id}|${tileKey(t)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    // Reads are not given the caller's abort signal: a read is shared through
    // the cache, and one caller giving up must not fail it for another.
    const p = (async () => {
      const data = await a.getTile(t.z, t.x, t.y);
      if (!data || data.byteLength === 0) return null;
      return decodeParcelTile(await decompressTile(data), t, a.county);
    })();
    this.cache.set(key, p);
    p.catch(() => {
      if (this.cache.peek(key) === p) this.cache.delete(key);
    });
    return p;
  }

  /** Every archive's copy of a tile. Throws if any archive fails to read it. */
  private async readAll(t: TileId): Promise<DecodedParcelTile[]> {
    const got = await Promise.all(this.archivesFor(t).map((a) => this.readTile(a, t)));
    return got.filter((d): d is DecodedParcelTile => d !== null);
  }

  /** The tiles covering a square of half-width reachM around a point. */
  private async loadAround(at: LngLat, reachM: number, signal?: AbortSignal): Promise<Loaded> {
    signal?.throwIfAborted();
    if (!Number.isFinite(at.lng) || !Number.isFinite(at.lat) || Math.abs(at.lat) > 85) return { coverage: 'no-archive', tiles: [] };
    if (this.covering(at).length === 0) return { coverage: 'no-archive', tiles: [] };
    // A degree of latitude is at least 110 km; this box is a little larger
    // than the reach in every direction, which is all that is needed.
    const dLat = reachM / 110000;
    const dLng = reachM / (110000 * Math.cos((at.lat * Math.PI) / 180));
    const nw = tileAt(at.lng - dLng, at.lat + dLat, this.zoom);
    const se = tileAt(at.lng + dLng, at.lat - dLat, this.zoom);
    const center = tileAt(at.lng, at.lat, this.zoom);
    const reads: Promise<DecodedParcelTile[]>[] = [];
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) reads.push(this.readAll({ z: this.zoom, x, y }));
    }
    const settled = await Promise.allSettled(reads);
    signal?.throwIfAborted();
    const tiles: DecodedParcelTile[] = [];
    for (const s of settled) {
      if (s.status === 'rejected') {
        console.warn('a parcel tile could not be read:', s.reason);
        return { coverage: 'read-error', tiles: [] };
      }
      tiles.push(...s.value);
    }
    // No tile under the point: with a coverage area that decides; without
    // one, nothing can be said here.
    if (!tiles.some((t) => sameTile(t.tile, center)) && this.coverageAt(at.lng, at.lat) === 'unknown') return { coverage: 'no-tile', tiles: [] };
    return { coverage: 'ok', tiles };
  }

  private details(scene: ParcelScene, key: string): ParcelDetails {
    const record = scene.record(key);
    if (!record) throw new Error('parcel key not in scene');
    const archive = this.archives.find((a) => a.county === scene.archiveCounty(key));
    return { ...record, countyName: archive?.countyName ?? '', dataDate: archive?.dataDate ?? '' };
  }

  async parcelsAt(at: LngLat, signal?: AbortSignal): Promise<ParcelLookup> {
    const loaded = await this.loadAround(at, TAP_REACH_M, signal);
    if (loaded.coverage !== 'ok') return { at, coverage: loaded.coverage, parcels: [] };
    const scene = new ParcelScene(loaded.tiles, at, TAP_REACH_M);
    const keys = scene.containing(0, 0);
    if (keys.length === 0) return { at, coverage: this.gapCoverage(at), parcels: [] };
    return { at, coverage: 'ok', parcels: keys.map((k) => this.details(scene, k)) };
  }

  async positionQuery(at: LngLat, options: PositionQueryOptions = {}, signal?: AbortSignal): Promise<PositionQuery> {
    const radiusM = options.radiusM ?? DEFAULT_SEARCH_RADIUS_M;
    const reach = radiusM + REACH_MARGIN_M;
    const loaded = await this.loadAround(at, reach, signal);
    const base = { at, coverage: loaded.coverage, searchRadiusM: radiusM, inside: null, nearestLine: null };
    if (loaded.coverage !== 'ok') return base;
    const scene = new ParcelScene(loaded.tiles, at, reach);
    const insideKeys = scene.containing(0, 0);
    const raw = scene.nearestLine(radiusM);
    let nearestLine: PositionQuery['nearestLine'] = null;
    if (raw) {
      const [lng, lat] = scene.frame.toLngLat(raw.x, raw.y);
      const [aLng, aLat] = scene.frame.toLngLat(raw.segment[0], raw.segment[1]);
      const [bLng, bLat] = scene.frame.toLngLat(raw.segment[2], raw.segment[3]);
      nearestLine = {
        segment: [
          { lng: aLng, lat: aLat },
          { lng: bLng, lat: bLat },
        ],
        distanceM: raw.distanceM,
        point: { lng, lat },
        bearingDeg: bearingOf(raw.x, raw.y),
        thisSide: raw.thisSide.map((k) => this.details(scene, k)),
        otherSide: raw.otherSide.map((k) => this.details(scene, k)),
        thisSideCovered: this.sideCovered(scene, raw.thisSide, raw.thisProbe),
        otherSideCovered: this.sideCovered(scene, raw.otherSide, raw.otherProbe),
      };
    }
    if (insideKeys.length === 0) return { ...base, coverage: this.gapCoverage(at), nearestLine };
    return { ...base, inside: insideKeys.map((k) => this.details(scene, k)), nearestLine };
  }

  /**
   * The outline of one parcel, for highlighting it, assembled from the tile
   * under `around` and the tiles next to it that the parcel reaches into.
   * Null if the parcel is not in the tile under `around`.
   */
  outline(pid: string, county: string, around: LngLat, options?: OutlineOptions): Promise<ParcelOutline | null> {
    return assembleParcelOutline((t) => this.readAll(t), pid, county, around, { zoom: this.zoom, ...options });
  }
}
