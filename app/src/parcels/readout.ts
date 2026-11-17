// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The position readout (D26): from a GPS fix and the parcel query made for
// it, what the screen may honestly say about where the phone stands.
//
// The order of the checks is the safety rule:
// 1. No parcel data here: say so.
// 2. The query was made too far from this fix: treat as no data until a
//    fresh query arrives.
// 3. The fix is poor: give the best guess, marked as a guess. Inside the
//    guess the same rules apply, so even a guess never names a side the
//    accuracy cannot support. When the uncertainty reaches the search radius
//    the search has not looked far enough to support any guess: none is made.
// 4. A property line lies within the uncertainty: the phone may be on either
//    side. This wins over "inside" whenever it applies.
// 5. The phone is in no parcel outside the area the data covers: no data.
// 6. Otherwise the phone is inside a parcel, or in a gap with no parcel.
//
// The uncertainty is the fix's accuracy radius, plus how far the fix is from
// the point the query was made for (so a slightly old query can only make the
// readout more cautious), plus a fixed allowance for error in the county's
// own lines (LINE_DATA_MARGIN_M): tax maps are drawn for assessment, not
// surveyed, and can sit a few meters off the true line (D26).

import { accuracyKnown } from '../position/types';
import { LocalFrame } from './local-frame';
import { compassPoint, type CompassPoint } from './format';
import { isNamedParcel } from './parcel-record';
import type { LngLat, ParcelCoverage, ParcelDetails, PositionQuery, PropertyLine } from './parcel-source';

/**
 * A GPS fix. accuracyM is the radius in meters the platform reports (68%
 * confidence on Android). Zero, a negative or a non-finite value means the
 * accuracy is not known: Android reports 0 for a fix with no accuracy.
 */
export interface PositionFix {
  lng: number;
  lat: number;
  accuracyM: number;
}

/** Above this accuracy radius, in meters, naming a parcel would mislead. */
export const POOR_FIX_M = 50;

/** A query made further than this, in meters, from the fix is not used. */
export const STALE_QUERY_M = 30;

/**
 * A fixed allowance, in meters, for error in the county's parcel lines. It is
 * added to the GPS accuracy when deciding whether the phone may be on either
 * side of a line.
 */
export const LINE_DATA_MARGIN_M = 3;

export interface ReadoutOptions {
  /** Default POOR_FIX_M. */
  poorFixM?: number;
}

export interface LineReadout {
  distanceM: number;
  bearingDeg: number;
  compass: CompassPoint;
  /** The nearest point on the line. */
  point: LngLat;
  /** The straight piece of the line that point lies on. */
  segment: [LngLat, LngLat];
}

interface Measured {
  /** The accuracy the platform reported. */
  accuracyM: number;
  /** Accuracy, plus the distance between the fix and the queried point, plus LINE_DATA_MARGIN_M. */
  uncertaintyM: number;
  /** How far the line search looked, in meters. A null line means none within this. */
  searchRadiusM: number;
}

/** The phone is clearly inside a parcel: the nearest line is further than the uncertainty. */
export interface InsideReadout extends Measured {
  kind: 'inside';
  parcel: ParcelDetails;
  /** Other parcels that overlap this one at the phone (a defect in the county data). */
  alsoIn: ParcelDetails[];
  /** Null when no line lies within the search radius. */
  line: LineReadout | null;
  /** The parcel across the nearest line, if any. */
  neighbour: ParcelDetails | null;
  /** False when across the line there is no parcel and no parcel data: the line is the edge of what is installed. */
  acrossCovered: boolean;
}

/** A line lies within the uncertainty: the phone may be on either side of it. */
export interface NearLineReadout extends Measured {
  kind: 'near-line';
  line: LineReadout;
  /** Parcels on the side the fix falls on. Empty for a gap such as a road. */
  thisSide: ParcelDetails[];
  /** Parcels across the line. Empty for a gap. */
  otherSide: ParcelDetails[];
  /** False for a side with no parcel that lies outside the parcel data: nothing is known there. */
  thisSideCovered: boolean;
  otherSideCovered: boolean;
}

/** The phone is in no parcel, often a road, and no line is within the uncertainty. */
export interface NoParcelReadout extends Measured {
  kind: 'no-parcel';
  line: LineReadout | null;
  /** The parcel across the nearest line, if any. */
  nearest: ParcelDetails | null;
  /** False when across the line there is no parcel and no parcel data. */
  acrossCovered: boolean;
}

export type PlaceReadout = InsideReadout | NearLineReadout | NoParcelReadout;

/**
 * The fix is too poor to name a parcel. `guess` is what would be said
 * otherwise, or null when the uncertainty reaches the search radius, so the
 * search has not looked far enough to support any guess.
 */
export interface PoorFixReadout extends Measured {
  kind: 'poor-fix';
  guess: PlaceReadout | null;
}

export interface NoDataReadout {
  kind: 'no-data';
  /** Why: the coverage the query reported, or 'stale' when the query was made too far from this fix. */
  reason: Exclude<ParcelCoverage, 'ok'> | 'stale';
}

export type Readout = NoDataReadout | PoorFixReadout | PlaceReadout;

function lineReadout(l: PropertyLine): LineReadout {
  return { distanceM: l.distanceM, bearingDeg: l.bearingDeg, compass: compassPoint(l.bearingDeg), point: l.point, segment: l.segment };
}

const same = (a: ParcelDetails, b: ParcelDetails) => a.county === b.county && a.pid === b.pid;

/**
 * The parcel to name across a line from `here`: one that is across it and not
 * on this side if there is one, else one that is across it and is not `here`.
 * Where one parcel lies inside another and the line is the inner one's edge,
 * the outer parcel is on both sides, and it is what lies across.
 */
function across(thisSide: readonly ParcelDetails[], otherSide: readonly ParcelDetails[], here: ParcelDetails | undefined): ParcelDetails | null {
  return otherSide.find((p) => !thisSide.some((t) => same(t, p))) ?? otherSide.find((p) => !here || !same(p, here)) ?? null;
}

function place(q: PositionQuery, m: Measured): PlaceReadout | NoDataReadout {
  const nl = q.nearestLine;
  // Records with no parcel ID (right of way strips) are never named: a point
  // in one alone is in no parcel. Their edges still count as lines.
  const thisSide = nl?.thisSide.filter(isNamedParcel) ?? [];
  const otherSide = nl?.otherSide.filter(isNamedParcel) ?? [];
  const otherSideCovered = nl ? nl.otherSideCovered : true;
  if (nl && nl.distanceM <= m.uncertaintyM) {
    // The phone may be on either side. Outside the data, the fix's own side
    // has no data, whatever the side test found 2 cm from the line.
    const thisSideCovered = q.coverage === 'outside' && thisSide.length === 0 ? false : nl.thisSideCovered;
    return { kind: 'near-line', ...m, line: lineReadout(nl), thisSide, otherSide, thisSideCovered, otherSideCovered };
  }
  if (q.coverage === 'outside') return { kind: 'no-data', reason: 'outside' };
  const line = nl ? lineReadout(nl) : null;
  const inside = q.inside?.filter(isNamedParcel) ?? [];
  if (inside[0]) {
    const neighbour = nl ? across(thisSide, otherSide, inside[0]) : null;
    return { kind: 'inside', ...m, parcel: inside[0], alsoIn: inside.slice(1), line, neighbour, acrossCovered: neighbour !== null || otherSideCovered };
  }
  const nearest = nl ? across(thisSide, otherSide, undefined) : null;
  return { kind: 'no-parcel', ...m, line, nearest, acrossCovered: nearest !== null || otherSideCovered };
}

/** What the readout says for a fix, given the parcel query made for (about) that fix. */
export function positionReadout(fix: PositionFix, query: PositionQuery, options: ReadoutOptions = {}): Readout {
  if (query.coverage !== 'ok' && query.coverage !== 'outside') return { kind: 'no-data', reason: query.coverage };
  const offset = Math.hypot(...new LocalFrame(query.at.lng, query.at.lat).toLocal(fix.lng, fix.lat));
  if (!(offset <= STALE_QUERY_M)) return { kind: 'no-data', reason: 'stale' };
  const accuracyM = accuracyKnown(fix.accuracyM) ? fix.accuracyM : Infinity;
  const m: Measured = { accuracyM, uncertaintyM: accuracyM + offset + LINE_DATA_MARGIN_M, searchRadiusM: query.searchRadiusM };
  const poorFixM = Math.min(options.poorFixM ?? POOR_FIX_M, query.searchRadiusM);
  // The search looked this far for lines. An uncertainty that reaches it
  // could hide a line the search never saw: then not even a guess is made.
  const searched = m.uncertaintyM < query.searchRadiusM;
  if (accuracyM <= poorFixM && searched) return place(query, m);
  const guess = searched ? place(query, m) : null;
  // A poor fix outside the data with no line near it: there is nothing to guess from.
  if (guess?.kind === 'no-data') return guess;
  return { kind: 'poor-fix', ...m, guess };
}
