// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The area a county's parcel data covers: the county outline from the
// archive's metadata (`coverage`, pipeline/README.md). It lets the readout
// tell a place with no parcel inside the county (a road, a lake) from a place
// outside it, where the archive holds nothing because nobody drew it.
//
// A place counts as covered only well inside the outline. The outline is the
// Census county line, and the county's own parcels do not stop exactly on it.
// Measured on the Macon County data (2026-11-17, every 25 m along the line):
// the nearest parcel is a median 8.4 m inside the Census line, 22.7 m at the
// 99th percentile, mostly the half of a road that runs on the county line.
// Within that band a place with no parcel may be that road or may be the
// next county, and the data cannot say which.

import type { CoverageGeometry } from '../platform/archive-meta';
import { LocalFrame } from './local-frame';
import { insideRings, nearestT, type Box } from './planar';

/**
 * A place with no parcel counts as covered by the data only when it lies at
 * least this far inside the coverage outline, in meters. See above.
 */
export const COVERAGE_EDGE_M = 25;

export class CoverageArea {
  /** Rings as flat [lng, lat, ...] lists, not closed. */
  private readonly rings: number[][];
  readonly bbox: Box;

  constructor(geometry: CoverageGeometry) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    this.rings = [];
    let w = Infinity;
    let s = Infinity;
    let e = -Infinity;
    let n = -Infinity;
    for (const poly of polygons) {
      for (const ring of poly) {
        const flat: number[] = [];
        ring.forEach(([lng, lat], i) => {
          const first = ring[0]!;
          if (i === ring.length - 1 && i > 0 && lng === first[0] && lat === first[1]) return;
          flat.push(lng, lat);
          w = Math.min(w, lng);
          e = Math.max(e, lng);
          s = Math.min(s, lat);
          n = Math.max(n, lat);
        });
        if (flat.length >= 6) this.rings.push(flat);
      }
    }
    this.bbox = [w, s, e, n];
  }

  /** True when the point is inside the outline (even-odd rule over every ring). */
  contains(lng: number, lat: number): boolean {
    const b = this.bbox;
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) return false;
    return insideRings(this.rings, lng, lat);
  }

  /** Meters from the point to the nearest edge of the outline, inside or out. */
  edgeDistanceM(lng: number, lat: number): number {
    const f = new LocalFrame(lng, lat);
    let best = Infinity;
    for (const r of this.rings) {
      const n = r.length >> 1;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ax = (r[2 * j]! - lng) * f.kx;
        const ay = (r[2 * j + 1]! - lat) * f.ky;
        const bx = (r[2 * i]! - lng) * f.kx;
        const by = (r[2 * i + 1]! - lat) * f.ky;
        const t = nearestT(ax, ay, bx, by, 0, 0);
        best = Math.min(best, Math.hypot(ax + (bx - ax) * t, ay + (by - ay) * t));
      }
    }
    return best;
  }

  /** True when the point is inside the outline by at least marginM meters. */
  covers(lng: number, lat: number, marginM = COVERAGE_EDGE_M): boolean {
    return this.contains(lng, lat) && this.edgeDistanceM(lng, lat) >= marginM;
  }
}
