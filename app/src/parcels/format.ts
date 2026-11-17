// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Words and numbers for the position readout: distances and compass points.

export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const POINTS: readonly CompassPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** The nearest of the eight compass points to a bearing in degrees. Any bearing is accepted, including negative ones. */
export function compassPoint(bearingDeg: number): CompassPoint {
  const b = ((bearingDeg % 360) + 360) % 360;
  return POINTS[Math.round(b / 45) % 8] ?? 'N';
}

export interface FormattedDistance {
  /** Whole feet under 1,000 ft, then miles to one decimal, such as "330 ft" or "1.2 mi". */
  imperial: string;
  /** Whole meters under 1,000 m, then kilometers to one decimal, such as "101 m". */
  metric: string;
  /** Both together, such as "330 ft (101 m)". */
  text: string;
}

const METERS_PER_FOOT = 0.3048;
const METERS_PER_MILE = 1609.344;

export function formatDistance(meters: number): FormattedDistance {
  if (!Number.isFinite(meters) || meters < 0) return { imperial: 'unknown', metric: 'unknown', text: 'unknown' };
  const feet = Math.round(meters / METERS_PER_FOOT);
  const imperial = feet < 1000 ? `${feet} ft` : `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
  const m = Math.round(meters);
  const metric = m < 1000 ? `${m} m` : `${(meters / 1000).toFixed(1)} km`;
  return { imperial, metric, text: `${imperial} (${metric})` };
}
