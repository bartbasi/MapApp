// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A flat frame in meters around one point: x to the east, y to the north.
//
// It scales degrees by the WGS84 ellipsoid's radii of curvature at the
// origin's latitude (an equirectangular projection fitted at that point).
// Within a few hundred meters of the origin the error is a few millimeters:
// the east scale changes by tan(lat) times the change in latitude, which is
// about 2 parts in 100,000 over 150 m at 40 degrees north. That is far finer
// than the parcel data (0.11 m tile units, and lines drawn for tax assessment).

const A = 6378137; // WGS84 semi-major axis, meters
const F = 1 / 298.257223563; // WGS84 flattening
const E2 = F * (2 - F);
const DEG = Math.PI / 180;

export class LocalFrame {
  /** Meters per degree of longitude at the origin. */
  readonly kx: number;
  /** Meters per degree of latitude at the origin. */
  readonly ky: number;

  constructor(
    readonly lng0: number,
    readonly lat0: number,
  ) {
    const phi = lat0 * DEG;
    const s = Math.sin(phi);
    const w = 1 - E2 * s * s;
    const n = A / Math.sqrt(w); // prime vertical radius
    const m = (A * (1 - E2)) / (w * Math.sqrt(w)); // meridional radius
    this.kx = n * Math.cos(phi) * DEG;
    this.ky = m * DEG;
  }

  /** East and north of the origin, in meters. */
  toLocal(lng: number, lat: number): [number, number] {
    return [(lng - this.lng0) * this.kx, (lat - this.lat0) * this.ky];
  }

  toLngLat(east: number, north: number): [number, number] {
    return [this.lng0 + east / this.kx, this.lat0 + north / this.ky];
  }
}

/** Compass bearing in degrees (0 north, 90 east, 0 up to but not including 360) of an offset. */
export function bearingOf(east: number, north: number): number {
  if (east === 0 && north === 0) return 0;
  return (Math.atan2(east, north) / DEG + 360) % 360;
}
