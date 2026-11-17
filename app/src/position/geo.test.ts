// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { bearingDeg, destination, distanceM, groundCircle, normalizeDeg, turnDeg } from './geo';

// Meters per degree at latitude 40 on the WGS 84 ellipsoid (from the standard
// series formulas), an independent yardstick for the sphere used in geo.ts.
const M_PER_DEG_LAT_40 = 111_034.6;
const M_PER_DEG_LNG_40 = 85_394.3;

describe('groundCircle', () => {
  const lng = -88.2;
  const lat = 40.1;

  it('is closed, with the requested number of points', () => {
    const ring = groundCircle(lng, lat, 25, 64).coordinates[0]!;
    expect(ring).toHaveLength(65);
    expect(ring[64]).toEqual(ring[0]);
  });

  it('has its radius in true ground meters at latitude 40, within 1 percent', () => {
    for (const r of [3, 10, 50, 400]) {
      const ring = groundCircle(lng, lat, r, 72).coordinates[0]!;
      for (const [x, y] of ring) {
        expect(Math.abs(distanceM(lng, lat, x!, y!) - r) / r).toBeLessThan(0.01);
      }
      // North-south and east-west extents against the ellipsoid's degree lengths.
      const lats = ring.map((p) => p[1]!);
      const lngs = ring.map((p) => p[0]!);
      const nsM = ((Math.max(...lats) - Math.min(...lats)) / 2) * M_PER_DEG_LAT_40;
      const ewM = ((Math.max(...lngs) - Math.min(...lngs)) / 2) * M_PER_DEG_LNG_40;
      expect(Math.abs(nsM - r) / r).toBeLessThan(0.01);
      expect(Math.abs(ewM - r) / r).toBeLessThan(0.01);
    }
  });

  it('is wider in degrees of longitude than of latitude, as the meridians close in', () => {
    const ring = groundCircle(lng, lat, 100).coordinates[0]!;
    const dLng = Math.max(...ring.map((p) => p[0]!)) - Math.min(...ring.map((p) => p[0]!));
    const dLat = Math.max(...ring.map((p) => p[1]!)) - Math.min(...ring.map((p) => p[1]!));
    expect(dLng / dLat).toBeCloseTo(1 / Math.cos((lat * Math.PI) / 180), 2);
  });
});

describe('distances and directions', () => {
  it('destination and distance agree', () => {
    const [x, y] = destination(-88.2, 40.1, 1234, 57);
    expect(distanceM(-88.2, 40.1, x, y)).toBeCloseTo(1234, 6);
    expect(bearingDeg(-88.2, 40.1, x, y)).toBeCloseTo(57, 3);
  });

  it('gives compass directions', () => {
    expect(bearingDeg(0, 40, 0, 40.01)).toBeCloseTo(0, 6);
    expect(bearingDeg(0, 40, 0.01, 40)).toBeCloseTo(90, 1);
    expect(bearingDeg(0, 40, 0, 39.99)).toBeCloseTo(180, 6);
    expect(bearingDeg(0, 40, -0.01, 40)).toBeCloseTo(270, 1);
  });

  it('folds angles and finds the short turn', () => {
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(725)).toBe(5);
    expect(turnDeg(350, 10)).toBe(20);
    expect(turnDeg(10, 350)).toBe(-20);
    expect(turnDeg(0, 180)).toBe(180);
  });
});
