// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The one way the app gets parcel information (D8, D25). It names no archive,
// tile or file, so a county can be served by stored data (the only kind now)
// or by a live lookup later, with nothing else changing.

import type { ParcelRecord } from './parcel-record';

export interface LngLat {
  lng: number;
  lat: number;
}

/** A parcel as the screens may show it: the record plus where the data came from. */
export interface ParcelDetails extends ParcelRecord {
  /** The county's name for display, such as "Macon County, Illinois". */
  countyName: string;
  /** The date of the county data, as the archive states it (YYYY-MM-DD), or empty. */
  dataDate: string;
}

/**
 * Whether parcel data could be read at a point.
 * - ok: data covers the point and was read.
 * - no-archive: no installed parcel data covers the point.
 * - no-tile: data covers the area but holds nothing at the point.
 * - read-error: a tile needed for the answer could not be read.
 */
export type ParcelCoverage = 'ok' | 'no-archive' | 'no-tile' | 'read-error';

/** The answer to "what parcel is here", for a tap. */
export interface ParcelLookup {
  at: LngLat;
  coverage: ParcelCoverage;
  /** The parcels holding the point, smallest area first. Empty in a gap or without coverage. */
  parcels: ParcelDetails[];
}

/** The nearest property line to a point. Reported once even where two parcels both carry it. */
export interface PropertyLine {
  /** Meters from the point to the line. */
  distanceM: number;
  /** The nearest point on the line. */
  point: LngLat;
  /** Compass bearing from the point to `point`, degrees from true north, 0 up to 360. */
  bearingDeg: number;
  /** Parcels just on the point's side of the line, smallest first. Empty for a gap. */
  thisSide: ParcelDetails[];
  /** Parcels just across the line, smallest first. Empty for a gap such as a road. */
  otherSide: ParcelDetails[];
  /**
   * The straight piece of the line that `point` lies on, end to end, for
   * drawing it. Cut at tile edges, so a long line may be given in parts.
   */
  segment: [LngLat, LngLat];
}

/** Everything the position readout needs about one point. */
export interface PositionQuery {
  at: LngLat;
  coverage: ParcelCoverage;
  /** How far the line search looked, in meters. */
  searchRadiusM: number;
  /** The parcels holding the point, smallest area first, or null when it is in no parcel (or not covered). */
  inside: ParcelDetails[] | null;
  /** The nearest property line, or null when none lies within the search radius (or not covered). */
  nearestLine: PropertyLine | null;
}

export interface PositionQueryOptions {
  /** How far to look for the nearest line, in meters. Default 150. */
  radiusM?: number;
}

export const DEFAULT_SEARCH_RADIUS_M = 150;

export interface ParcelSource {
  /** The parcel or parcels at a point, for a tap. */
  parcelsAt(at: LngLat, signal?: AbortSignal): Promise<ParcelLookup>;
  /** The containing parcel and the nearest property line, for the position readout. */
  positionQuery(at: LngLat, options?: PositionQueryOptions, signal?: AbortSignal): Promise<PositionQuery>;
}
