// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import type { ArchiveEntry, ArchiveMeta } from '../../platform/archive-meta';
import { firstSentence, summarizeInstalled } from '../installed';
import { availableBaseViews, buildStyle, effectiveBaseView, type StyleOptions } from './build-style';

function entry(county: string, layer: string, kind: 'vector' | 'raster', extra: Partial<ArchiveMeta> = {}): ArchiveEntry {
  const meta: ArchiveMeta = {
    schema: 1,
    layer,
    county,
    countyName: county,
    kind,
    title: layer,
    minzoom: 0,
    maxzoom: 15,
    bounds: [-88.47, 39.87, -87.92, 40.41],
    bytes: 1,
    buildDate: '2026-11-12',
    sources: [{ name: 'S', license: 'L', credit: `credit for ${layer}`, url: 'https://example.org', dataDate: '2026-01-01' }],
    notes: '',
    ...extra,
  };
  return { county, layer, meta };
}

const everything = summarizeInstalled([
  entry('il-champaign', 'basemap', 'vector'),
  entry('il-macon', 'basemap', 'vector', { bounds: [-89.22, 39.65, -88.74, 40.06] }),
  entry('il-champaign', 'aerial', 'raster', { minzoom: 8, maxzoom: 16 }),
  entry('il-champaign', 'publicland', 'vector', { minzoom: 6, maxzoom: 14 }),
]);
const baseOnly = summarizeInstalled([entry('il-champaign', 'basemap', 'vector')]);

function opts(o: Partial<StyleOptions>): StyleOptions {
  return { base: 'map', overlays: { publicland: true }, installed: everything, glyphs: 'http://x/fonts/{fontstack}/{range}.pbf', ...o };
}

const ids = (s: ReturnType<typeof buildStyle>) => s.layers.map((l) => l.id);
const sourceOf = (s: ReturnType<typeof buildStyle>, id: string) => {
  const l = s.layers.find((x) => x.id === id);
  return l && 'source' in l ? l.source : undefined;
};

describe('buildStyle', () => {
  it('map view: vector base map, no imagery', () => {
    const s = buildStyle(opts({ base: 'map', overlays: { publicland: false } }));
    expect(Object.keys(s.sources).sort()).toEqual(['basemap']);
    expect(ids(s)).toContain('base-road-major');
    expect(ids(s)).toContain('label-place');
    expect(ids(s)).not.toContain('aerial-imagery');
  });

  it('aerial view: imagery only', () => {
    const s = buildStyle(opts({ base: 'aerial', overlays: { publicland: false } }));
    expect(Object.keys(s.sources)).toEqual(['aerial']);
    expect(ids(s)).toEqual(['background', 'aerial-imagery']);
    expect(s.sources['aerial']).toMatchObject({ type: 'raster', tileSize: 512, minzoom: 8, maxzoom: 16 });
  });

  it('hybrid view: imagery with roads, water outlines and names on top', () => {
    const s = buildStyle(opts({ base: 'hybrid', overlays: { publicland: false } }));
    expect(Object.keys(s.sources).sort()).toEqual(['aerial', 'basemap']);
    const order = ids(s);
    expect(order.indexOf('aerial-imagery')).toBeLessThan(order.indexOf('hybrid-road-major'));
    expect(order).toContain('hybrid-water-outline');
    expect(order).toContain('label-place');
    expect(order).not.toContain('base-landuse-wood');
  });

  it('public land on: drawn above the ground and below the labels', () => {
    const s = buildStyle(opts({ base: 'map' }));
    const order = ids(s);
    expect(order.indexOf('base-road-motorway')).toBeLessThan(order.indexOf('publicland-fill'));
    expect(order.indexOf('publicland-fill')).toBeLessThan(order.indexOf('label-place'));
    expect(sourceOf(s, 'publicland-fill')).toBe('publicland');
    expect(order).not.toContain('publicland-selected');
  });

  it('public land off: no public land source or layers', () => {
    const s = buildStyle(opts({ overlays: { publicland: false } }));
    expect(s.sources['publicland']).toBeUndefined();
    expect(ids(s).some((id) => id.startsWith('publicland'))).toBe(false);
  });

  it('outlines the selected site', () => {
    const s = buildStyle(opts({ selection: { name: 'Lake of the Woods', manager: 'Someone' } }));
    expect(ids(s)).toContain('publicland-selected');
  });

  it('one source per layer however many counties, and never a county in the style', () => {
    const s = buildStyle(opts({ base: 'hybrid' }));
    const json = JSON.stringify(s);
    expect(json).not.toContain('il-champaign');
    expect(json).not.toContain('il-macon');
    const base = s.sources['basemap'] as { tiles: string[]; bounds: number[] };
    expect(base.tiles).toEqual(['mapapp://basemap/{z}/{x}/{y}']);
    // The source covers both counties together.
    expect(base.bounds).toEqual([-89.22, 39.65, -87.92, 40.41]);
  });

  it('builds the on-map credit from the metadata, once per distinct credit, for base layers only', () => {
    const s = buildStyle(opts({ base: 'map' }));
    const attribution = (s.sources['basemap'] as { attribution: string }).attribution;
    expect(attribution.match(/credit for basemap/g)).toHaveLength(1);
    expect((s.sources['publicland'] as { attribution?: string }).attribution).toBeUndefined();
  });

  it('shortens a credit to its first sentence, without cutting initials', () => {
    expect(firstSentence('© OpenStreetMap contributors. The tile files are offered under ODbL 1.0.')).toBe('© OpenStreetMap contributors');
    expect(firstSentence('U.S. Geological Survey, 2024, PAD-US 4.1')).toBe('U.S. Geological Survey, 2024, PAD-US 4.1');
    expect(firstSentence('USDA NAIP 2025.')).toBe('USDA NAIP 2025.');
  });

  it('missing aerial: only the map view is offered and an aerial request falls back to it', () => {
    expect(availableBaseViews(baseOnly)).toEqual(['map']);
    expect(effectiveBaseView('hybrid', baseOnly)).toBe('map');
    const s = buildStyle(opts({ base: 'aerial', installed: baseOnly }));
    expect(Object.keys(s.sources)).toEqual(['basemap']);
    expect(ids(s)).not.toContain('aerial-imagery');
  });

  it('missing public land: the overlay is left out even when switched on', () => {
    const s = buildStyle(opts({ installed: baseOnly, overlays: { publicland: true } }));
    expect(s.sources['publicland']).toBeUndefined();
    expect(ids(s)).not.toContain('publicland-fill');
  });

  it('nothing installed: a plain background', () => {
    const none = summarizeInstalled([]);
    expect(availableBaseViews(none)).toEqual(['map']);
    const s = buildStyle(opts({ installed: none }));
    expect(s.sources).toEqual({});
    expect(ids(s)).toEqual(['background']);
  });

  it('aerial without a base map: aerial only, no hybrid', () => {
    const aerialOnly = summarizeInstalled([entry('il-champaign', 'aerial', 'raster')]);
    expect(availableBaseViews(aerialOnly)).toEqual(['aerial']);
    expect(effectiveBaseView('map', aerialOnly)).toBe('aerial');
  });

  it('every layer refers to a source that exists', () => {
    for (const base of ['map', 'aerial', 'hybrid'] as const) {
      for (const publicland of [true, false]) {
        const s = buildStyle(opts({ base, overlays: { publicland } }));
        for (const l of s.layers) {
          if ('source' in l && typeof l.source === 'string') expect(s.sources[l.source], `${base}/${l.id}`).toBeDefined();
        }
        expect(new Set(ids(s)).size).toBe(s.layers.length);
      }
    }
  });

  it('every combination passes the MapLibre style validator', () => {
    for (const installed of [everything, baseOnly]) {
      for (const base of ['map', 'aerial', 'hybrid'] as const) {
        for (const publicland of [true, false]) {
          const s = buildStyle(opts({ base, installed, overlays: { publicland }, selection: { name: 'a', manager: 'b' } }));
          const errors = validateStyleMin(s).map((e) => e.message);
          expect(errors, `${base}, public land ${publicland}`).toEqual([]);
        }
      }
    }
  });
});
