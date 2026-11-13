// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// One label point per public land site.
//
// MapLibre labels a polygon once in every tile the polygon touches, so a large
// site showed its name several times, at tile edges. Instead, the map view
// gathers the public land shapes from the loaded tiles, and this module picks
// one point per site (same name and manager): inside the largest piece of the
// site, near its middle. The style draws names from those points.

import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon, Position } from 'geojson';

type Ring = Position[];
type Poly = Ring[];

export interface LabelSource {
  properties: Record<string, unknown> | null;
  geometry: Polygon | MultiPolygon | { type: string };
}

/** Area of a ring in square degrees, scaled for latitude. Sign ignored. */
function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!;
    const b = ring[i]!;
    sum += (a[0]! - b[0]!) * (a[1]! + b[1]!);
  }
  const lat = ring[0]?.[1] ?? 0;
  return Math.abs(sum / 2) * Math.cos((lat * Math.PI) / 180);
}

function polyArea(p: Poly): number {
  const [outer, ...holes] = p;
  return outer ? ringArea(outer) - holes.reduce((s, h) => s + ringArea(h), 0) : 0;
}

function insideRing(pt: Position, ring: Ring): boolean {
  let inside = false;
  const [x, y] = [pt[0]!, pt[1]!];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [ring[i]![0]!, ring[i]![1]!];
    const [xj, yj] = [ring[j]![0]!, ring[j]![1]!];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function insidePoly(pt: Position, p: Poly): boolean {
  const [outer, ...holes] = p;
  return !!outer && insideRing(pt, outer) && !holes.some((h) => insideRing(pt, h));
}

/**
 * A point inside the polygon, near its middle: the middle of the widest
 * stretch of the polygon along the horizontal line through its center of
 * bounds. Falls back to a vertex if the polygon is degenerate.
 */
export function interiorPoint(p: Poly): Position {
  const outer = p[0] ?? [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of outer) {
    minY = Math.min(minY, v[1]!);
    maxY = Math.max(maxY, v[1]!);
  }
  // Try the middle line first, then lines a little above and below it.
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    const y = minY + (maxY - minY) * f;
    const xs: number[] = [];
    for (const ring of p) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = [ring[i]![0]!, ring[i]![1]!];
        const [xj, yj] = [ring[j]![0]!, ring[j]![1]!];
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }
    xs.sort((a, b) => a - b);
    let best: Position | null = null;
    let bestWidth = 0;
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1]! - xs[i]!;
      if (w > bestWidth) {
        bestWidth = w;
        best = [(xs[i]! + xs[i + 1]!) / 2, y];
      }
    }
    if (best && insidePoly(best, p)) return best;
  }
  return outer[0] ?? [0, 0];
}

function polygonsOf(g: LabelSource['geometry']): Poly[] {
  if (g.type === 'Polygon') return [(g as Polygon).coordinates];
  if (g.type === 'MultiPolygon') return (g as MultiPolygon).coordinates;
  return [];
}

/** One label point per site (same name and manager), inside its largest piece. */
export function publicLandLabelPoints(features: readonly LabelSource[]): FeatureCollection<Point> {
  const best = new Map<string, { area: number; poly: Poly; props: Record<string, unknown> }>();
  for (const f of features) {
    const props = f.properties ?? {};
    const name = typeof props['name'] === 'string' ? props['name'].trim() : '';
    if (!name) continue;
    const key = `${name}\u0000${String(props['manager'] ?? '')}`;
    for (const poly of polygonsOf(f.geometry)) {
      const area = polyArea(poly);
      const current = best.get(key);
      if (!current || area > current.area) best.set(key, { area, poly, props });
    }
  }
  const out: Feature<Point>[] = [...best.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, v]) => ({
      type: 'Feature',
      properties: {
        name: v.props['name'],
        manager: v.props['manager'] ?? '',
        category: v.props['category'] ?? 'other',
        access: v.props['access'] ?? 'unknown',
        acres: typeof v.props['acres'] === 'number' ? v.props['acres'] : 0,
      },
      geometry: { type: 'Point', coordinates: interiorPoint(v.poly).map((n) => +n.toFixed(6)) },
    }));
  return { type: 'FeatureCollection', features: out };
}
