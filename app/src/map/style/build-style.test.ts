// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection, Point } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { ArchiveEntry, ArchiveMeta } from '../../platform/archive-meta';
import { firstSentence, summarizeInstalled } from '../installed';
import { availableBaseViews, buildStyle, effectiveBaseView, type StyleOptions } from './build-style';

const CHAMPAIGN: [number, number, number, number] = [-88.47, 39.87, -87.92, 40.41];
const MACON: [number, number, number, number] = [-89.22, 39.65, -88.74, 40.06];

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
    bounds: CHAMPAIGN,
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
  entry('il-macon', 'basemap', 'vector', { bounds: MACON }),
  entry('il-champaign', 'aerial', 'raster', { minzoom: 10, maxzoom: 16 }),
  entry('il-macon', 'aerial', 'raster', { minzoom: 11, maxzoom: 15, bounds: MACON, tileSize: 256 }),
  entry('il-champaign', 'publicland', 'vector', { minzoom: 10, maxzoom: 14 }),
  entry('il-macon', 'publicland', 'vector', { minzoom: 10, maxzoom: 14, bounds: MACON }),
]);
const baseOnly = summarizeInstalled([entry('il-champaign', 'basemap', 'vector')]);

function opts(o: Partial<StyleOptions>): StyleOptions {
  return { base: 'map', overlays: { publicland: true }, installed: everything, glyphs: 'http://x/fonts/{fontstack}/{range}.pbf', ...o };
}

type Style = ReturnType<typeof buildStyle>;
const ids = (s: Style) => s.layers.map((l) => l.id);
const sourceOf = (s: Style, id: string) => {
  const l = s.layers.find((x) => x.id === id);
  return l && 'source' in l ? l.source : undefined;
};
const rasterLayers = (s: Style) => s.layers.filter((l) => l.type === 'raster');

describe('buildStyle: base views', () => {
  it('map view: vector base map, no imagery', () => {
    const s = buildStyle(opts({ base: 'map', overlays: { publicland: false } }));
    expect(Object.keys(s.sources).sort()).toEqual(['basemap']);
    expect(ids(s)).toContain('base-road-major');
    expect(ids(s)).toContain('label-place');
    expect(rasterLayers(s)).toEqual([]);
  });

  it('aerial view: imagery over a plain base map, no labels', () => {
    const s = buildStyle(opts({ base: 'aerial', overlays: { publicland: false } }));
    expect(Object.keys(s.sources).sort()).toEqual(['aerial:il-champaign', 'aerial:il-macon', 'basemap']);
    expect(ids(s).some((id) => id.startsWith('label-'))).toBe(false);
    expect(ids(s).some((id) => id.startsWith('base-'))).toBe(false);
  });

  it('hybrid view: imagery with roads, water outlines and names on top', () => {
    const s = buildStyle(opts({ base: 'hybrid', overlays: { publicland: false } }));
    const order = ids(s);
    expect(order.indexOf('imagery:aerial:il-macon')).toBeLessThan(order.indexOf('hybrid-road-major'));
    expect(order).toContain('hybrid-water-outline');
    expect(order).toContain('label-place');
    expect(order).not.toContain('base-landuse-wood');
  });
});

describe('buildStyle: the base map under the imagery', () => {
  for (const base of ['aerial', 'hybrid'] as const) {
    it(`${base} view: a plain base map is the bottom layer, under every imagery layer`, () => {
      const order = ids(buildStyle(opts({ base })));
      const plain = order.filter((id) => id.startsWith('plain-'));
      expect(plain.length).toBeGreaterThan(0);
      // Background first, then the plain base map, then the imagery.
      expect(order.slice(1, 1 + plain.length)).toEqual(plain);
      const lastPlain = order.indexOf(plain[plain.length - 1]!);
      for (const r of order.filter((id) => id.startsWith('imagery:'))) expect(order.indexOf(r)).toBeGreaterThan(lastPlain);
    });
  }

  it('the plain base map has no zoom limit, so it shows below the imagery minimum zoom', () => {
    const s = buildStyle(opts({ base: 'aerial' }));
    const basemap = s.sources['basemap'] as { minzoom: number };
    expect(basemap.minzoom).toBe(0);
    for (const l of s.layers.filter((x) => x.id.startsWith('plain-'))) {
      expect((l as { minzoom?: number }).minzoom ?? 0).toBeLessThanOrEqual(12);
    }
  });

  it('the map view has no plain base map: the full one is drawn', () => {
    expect(ids(buildStyle(opts({ base: 'map' }))).some((id) => id.startsWith('plain-'))).toBe(false);
  });
});

describe('buildStyle: raster layers get one source per archive', () => {
  it('one source and one layer per installed aerial archive, each with its own bounds, zooms and tile size', () => {
    const s = buildStyle(opts({ base: 'aerial' }));
    expect(s.sources['aerial:il-champaign']).toEqual({
      type: 'raster',
      tiles: ['mapapp://aerial@il-champaign/{z}/{x}/{y}'],
      tileSize: 512,
      minzoom: 10,
      maxzoom: 16,
      bounds: CHAMPAIGN,
      attribution: 'credit for aerial',
    });
    expect(s.sources['aerial:il-macon']).toMatchObject({ tiles: ['mapapp://aerial@il-macon/{z}/{x}/{y}'], tileSize: 256, minzoom: 11, maxzoom: 15, bounds: MACON });
    expect(rasterLayers(s).map((l) => (l as { source: string }).source)).toEqual(['aerial:il-champaign', 'aerial:il-macon']);
  });

  it('the raster tile size defaults to the contract value of 512', () => {
    const s = buildStyle(opts({ base: 'aerial' }));
    expect((s.sources['aerial:il-champaign'] as { tileSize: number }).tileSize).toBe(512);
  });

  it('vector layers stay one source for all counties, and never name a county', () => {
    const s = buildStyle(opts({ base: 'hybrid' }));
    const base = s.sources['basemap'] as { tiles: string[]; bounds: number[] };
    expect(base.tiles).toEqual(['mapapp://basemap/{z}/{x}/{y}']);
    expect(base.bounds).toEqual([-89.22, 39.65, -87.92, 40.41]);
    for (const [id, src] of Object.entries(s.sources)) {
      if (src.type === 'vector') expect(JSON.stringify(src), id).not.toMatch(/il-/);
    }
  });
});

describe('buildStyle: zoom ranges come from the metadata', () => {
  it('a late-starting layer keeps its own minimum zoom', () => {
    const s = buildStyle(opts({ base: 'hybrid' }));
    expect(s.sources['publicland']).toMatchObject({ minzoom: 10, maxzoom: 14 });
    expect(s.sources['aerial:il-champaign']).toMatchObject({ minzoom: 10 });
    expect(s.sources['basemap']).toMatchObject({ minzoom: 0, maxzoom: 15 });
  });

  it('a layer whose counties differ in zoom range covers the widest range', () => {
    const mixed = summarizeInstalled([
      entry('il-champaign', 'publicland', 'vector', { minzoom: 10, maxzoom: 14 }),
      entry('il-macon', 'publicland', 'vector', { minzoom: 9, maxzoom: 13, bounds: MACON }),
      entry('il-champaign', 'basemap', 'vector'),
    ]);
    expect(buildStyle(opts({ installed: mixed })).sources['publicland']).toMatchObject({ minzoom: 9, maxzoom: 14 });
  });
});

describe('buildStyle: public land', () => {
  it('drawn above the ground and below the labels', () => {
    const order = ids(buildStyle(opts({ base: 'map' })));
    expect(order.indexOf('base-road-motorway')).toBeLessThan(order.indexOf('publicland-fill'));
    expect(order.indexOf('publicland-fill')).toBeLessThan(order.indexOf('label-place'));
    expect(order).not.toContain('publicland-selected');
  });

  it('drawn above the imagery in the aerial view', () => {
    const order = ids(buildStyle(opts({ base: 'aerial' })));
    expect(order.indexOf('imagery:aerial:il-macon')).toBeLessThan(order.indexOf('publicland-fill'));
  });

  it('names come from the one-point-per-site source, not from the polygons', () => {
    const labels: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { name: 'A', category: 'state' }, geometry: { type: 'Point', coordinates: [-88.2, 40.1] } }],
    };
    const s = buildStyle(opts({ publicLandLabels: labels }));
    expect(sourceOf(s, 'publicland-label')).toBe('publicland-labels');
    expect(s.sources['publicland-labels']).toEqual({ type: 'geojson', data: labels });
    expect(sourceOf(s, 'publicland-fill')).toBe('publicland');
  });

  it('off: no public land source or layers', () => {
    const s = buildStyle(opts({ overlays: { publicland: false } }));
    expect(s.sources['publicland']).toBeUndefined();
    expect(s.sources['publicland-labels']).toBeUndefined();
    expect(ids(s).some((id) => id.startsWith('publicland'))).toBe(false);
  });

  it('outlines the selected site', () => {
    expect(ids(buildStyle(opts({ selection: { name: 'Lake of the Woods', manager: 'Someone' } })))).toContain('publicland-selected');
  });
});

describe('buildStyle: credits', () => {
  it('on-map credit from the metadata, once per distinct credit, for base view layers only', () => {
    const s = buildStyle(opts({ base: 'hybrid' }));
    expect((s.sources['basemap'] as { attribution: string }).attribution.match(/credit for basemap/g)).toHaveLength(1);
    expect((s.sources['aerial:il-macon'] as { attribution: string }).attribution).toBe('credit for aerial');
    expect((s.sources['publicland'] as { attribution?: string }).attribution).toBeUndefined();
  });

  it('shortens a credit to its first sentence, without cutting initials', () => {
    expect(firstSentence('© OpenStreetMap contributors. The tile files are offered under ODbL 1.0.')).toBe('© OpenStreetMap contributors');
    expect(firstSentence('U.S. Geological Survey, 2024, PAD-US 4.1')).toBe('U.S. Geological Survey, 2024, PAD-US 4.1');
    expect(firstSentence('USDA NAIP 2025.')).toBe('USDA NAIP 2025.');
  });
});

describe('buildStyle: missing layers', () => {
  it('missing aerial: only the map view is offered and an aerial request falls back to it', () => {
    expect(availableBaseViews(baseOnly)).toEqual(['map']);
    expect(effectiveBaseView('hybrid', baseOnly)).toBe('map');
    const s = buildStyle(opts({ base: 'aerial', installed: baseOnly }));
    expect(Object.keys(s.sources)).toEqual(['basemap']);
    expect(rasterLayers(s)).toEqual([]);
    expect(ids(s)).toContain('base-road-major');
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

  it('aerial without a base map: aerial only, imagery on a plain background', () => {
    const aerialOnly = summarizeInstalled([entry('il-champaign', 'aerial', 'raster')]);
    expect(availableBaseViews(aerialOnly)).toEqual(['aerial']);
    expect(effectiveBaseView('map', aerialOnly)).toBe('aerial');
    expect(ids(buildStyle(opts({ installed: aerialOnly })))).toEqual(['background', 'imagery:aerial:il-champaign']);
  });
});

describe('buildStyle: validity', () => {
  const sets = [everything, baseOnly, summarizeInstalled([entry('il-champaign', 'aerial', 'raster')])];

  it('every layer refers to a source that exists, and layer IDs are unique', () => {
    for (const installed of sets) {
      for (const base of ['map', 'aerial', 'hybrid'] as const) {
        for (const publicland of [true, false]) {
          const s = buildStyle(opts({ base, installed, overlays: { publicland } }));
          for (const l of s.layers) {
            if ('source' in l && typeof l.source === 'string') expect(s.sources[l.source], `${base}/${l.id}`).toBeDefined();
          }
          expect(new Set(ids(s)).size).toBe(s.layers.length);
        }
      }
    }
  });

  it('every combination passes the MapLibre style validator', () => {
    for (const installed of sets) {
      for (const base of ['map', 'aerial', 'hybrid'] as const) {
        for (const publicland of [true, false]) {
          const s = buildStyle(opts({ base, installed, overlays: { publicland }, selection: { name: 'a', manager: 'b' } }));
          expect(validateStyleMin(s).map((e) => e.message), `${base}, public land ${publicland}`).toEqual([]);
        }
      }
    }
  });
});
