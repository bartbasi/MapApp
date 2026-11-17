// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection, Point } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { ArchiveEntry, ArchiveMeta } from '../../platform/archive-meta';
import { firstSentence, summarizeInstalled } from '../installed';
import { PARCEL_LAYER } from '../../parcels/stored-parcel-source';
import { LIVE_SOURCES, PARCELS_LAYER, availableBaseViews, buildStyle, effectiveBaseView, type StyleOptions } from './build-style';
import { PARCEL_RELATION_LAYER_IDS, PARCEL_RELATION_SOURCE, PARCEL_SELECTED_SOURCE } from './parcels';
import { POSITION_LAYER_IDS, POSITION_SOURCE } from './position';

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
/** Both counties' base layers, and parcels for Macon County only. */
const withParcels = summarizeInstalled([
  entry('il-champaign', 'basemap', 'vector'),
  entry('il-macon', 'basemap', 'vector', { bounds: MACON }),
  entry('il-champaign', 'aerial', 'raster', { minzoom: 10, maxzoom: 16 }),
  entry('il-macon', 'aerial', 'raster', { bounds: MACON }),
  entry('il-champaign', 'publicland', 'vector', { minzoom: 10, maxzoom: 14 }),
  entry('il-macon', 'publicland', 'vector', { minzoom: 10, maxzoom: 14, bounds: MACON }),
  entry('il-macon', 'parcels', 'vector', { minzoom: 13, maxzoom: 16, bounds: MACON }),
]);

function opts(o: Partial<StyleOptions>): StyleOptions {
  return { base: 'map', overlays: { publicland: true }, installed: everything, glyphs: 'http://x/fonts/{fontstack}/{range}.pbf', ...o };
}

type Style = ReturnType<typeof buildStyle>;
/** Every layer, the position marker's included. */
const allIds = (s: Style) => s.layers.map((l) => l.id);
/** The map's own layers: the position marker is always there and is tested on its own below. */
const ids = (s: Style) => allIds(s).filter((id) => !id.startsWith('position-'));
/** The map data sources, leaving out the ones the map fills in place (the marker, the tapped parcel, the relation). */
const dataSources = (s: Style) => Object.keys(s.sources).filter((k) => !(LIVE_SOURCES as readonly string[]).includes(k));
const sourceOf = (s: Style, id: string) => {
  const l = s.layers.find((x) => x.id === id);
  return l && 'source' in l ? l.source : undefined;
};
const rasterLayers = (s: Style) => s.layers.filter((l) => l.type === 'raster');

describe('buildStyle: base views', () => {
  it('map view: vector base map, no imagery', () => {
    const s = buildStyle(opts({ base: 'map', overlays: { publicland: false } }));
    expect(dataSources(s).sort()).toEqual(['basemap']);
    expect(ids(s)).toContain('base-road-major');
    expect(ids(s)).toContain('label-place');
    expect(rasterLayers(s)).toEqual([]);
  });

  it('aerial view: imagery over a plain base map, no labels', () => {
    const s = buildStyle(opts({ base: 'aerial', overlays: { publicland: false } }));
    expect(dataSources(s).sort()).toEqual(['aerial:il-champaign', 'aerial:il-macon', 'basemap']);
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
    // The less detailed imagery (Macon, to zoom 15) is drawn first, under the sharper.
    expect(rasterLayers(s).map((l) => (l as { source: string }).source)).toEqual(['aerial:il-macon', 'aerial:il-champaign']);
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

describe('buildStyle: property lines', () => {
  const on = (o: Partial<StyleOptions> = {}) => opts({ installed: withParcels, overlays: { publicland: true, parcels: true }, ...o });

  it('the archive layer ID matches the parcel source module', () => {
    expect(PARCELS_LAYER).toBe(PARCEL_LAYER);
  });

  it('one source per county archive, addressed to that archive, with its own zooms and bounds', () => {
    const s = buildStyle(on());
    expect(s.sources['parcels:il-macon']).toEqual({ type: 'vector', tiles: ['mapapp://parcels@il-macon/{z}/{x}/{y}'], minzoom: 13, maxzoom: 16, bounds: MACON });
    expect(dataSources(s).filter((k) => k.startsWith('parcels'))).toEqual(['parcels:il-macon']);
    const two = summarizeInstalled([
      entry('il-champaign', 'basemap', 'vector'),
      entry('il-champaign', 'parcels', 'vector', { minzoom: 13, maxzoom: 16 }),
      entry('il-macon', 'parcels', 'vector', { minzoom: 13, maxzoom: 16, bounds: MACON }),
    ]);
    const s2 = buildStyle(on({ installed: two }));
    expect(dataSources(s2).filter((k) => k.startsWith('parcels')).sort()).toEqual(['parcels:il-champaign', 'parcels:il-macon']);
    expect(ids(s2).filter((id) => id.startsWith('parcels-line:'))).toEqual(['parcels-line:parcels:il-champaign', 'parcels-line:parcels:il-macon']);
  });

  for (const base of ['map', 'aerial', 'hybrid'] as const) {
    it(`${base} view: above public land and the base view, below labels; relation above labels, below the marker`, () => {
      const order = allIds(buildStyle(on({ base })));
      const casing = order.indexOf('parcels-casing:parcels:il-macon');
      const line = order.indexOf('parcels-line:parcels:il-macon');
      expect(casing).toBeGreaterThan(0);
      expect(casing).toBeLessThan(line);
      for (const id of order.filter((x) => x.startsWith('publicland-') && x !== 'publicland-label')) expect(order.indexOf(id), id).toBeLessThan(casing);
      for (const id of order.filter((x) => x.startsWith('imagery:') || x.startsWith('hybrid-') || x.startsWith('base-'))) expect(order.indexOf(id), id).toBeLessThan(casing);
      const labels = order.filter((x) => x.startsWith('label-') || x === 'publicland-label');
      if (base !== 'aerial') expect(labels.length).toBeGreaterThan(0);
      for (const id of labels) expect(order.indexOf(id), id).toBeGreaterThan(order.indexOf('parcel-selected'));
      // The relation layers sit just under the marker, the marker stays last.
      const tail = order.slice(-(PARCEL_RELATION_LAYER_IDS.length + POSITION_LAYER_IDS.length));
      expect(tail).toEqual([...PARCEL_RELATION_LAYER_IDS, ...POSITION_LAYER_IDS]);
      // The glow on the parcel the phone is in sits just under the lines, above public land.
      expect(order.indexOf('parcel-here')).toBe(casing - 1);
    });
  }

  it('starts at the archive minimum zoom', () => {
    const s = buildStyle(on());
    const l = s.layers.find((x) => x.id === 'parcels-line:parcels:il-macon') as { minzoom?: number };
    expect(l.minzoom).toBe(13);
  });

  it('off: no parcel source or layer, but the in-place sources stay so a switch keeps their data', () => {
    const s = buildStyle(on({ overlays: { publicland: true, parcels: false } }));
    expect(Object.keys(s.sources).some((k) => k.startsWith('parcels:'))).toBe(false);
    expect(allIds(s).some((id) => id.startsWith('parcel'))).toBe(false);
    expect(s.sources[PARCEL_SELECTED_SOURCE]).toBeDefined();
    expect(s.sources[PARCEL_RELATION_SOURCE]).toBeDefined();
  });

  it('not installed: no parcel layers even when switched on', () => {
    expect(allIds(buildStyle(opts({ overlays: { publicland: true, parcels: true } }))).some((id) => id.startsWith('parcel'))).toBe(false);
  });

  it('carries the tapped outline and the relation data into a new style', () => {
    const fc: FeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { part: 'connector' }, geometry: { type: 'LineString', coordinates: [[-89, 39.8], [-89.001, 39.8]] } }] };
    const s = buildStyle(on({ base: 'aerial', parcelSelected: fc, parcelRelation: fc }));
    expect(s.sources[PARCEL_SELECTED_SOURCE]).toEqual({ type: 'geojson', data: fc });
    expect(s.sources[PARCEL_RELATION_SOURCE]).toEqual({ type: 'geojson', data: fc });
    expect(validateStyleMin(s)).toEqual([]);
  });

  it('passes the style validator in every base view', () => {
    for (const base of ['map', 'aerial', 'hybrid'] as const) expect(validateStyleMin(buildStyle(on({ base }))).map((e) => e.message), base).toEqual([]);
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
    expect(dataSources(s)).toEqual(['basemap']);
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
    expect(dataSources(s)).toEqual([]);
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
          expect(new Set(allIds(s)).size).toBe(s.layers.length);
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

describe('buildStyle: the position marker', () => {
  const marker: FeatureCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-88.2, 40.1] }, properties: { part: 'dot', stale: false } }],
  };

  it('is drawn last, above every other layer and label, in every base view', () => {
    for (const base of ['map', 'aerial', 'hybrid'] as const) {
      for (const publicland of [true, false]) {
        const order = allIds(buildStyle(opts({ base, overlays: { publicland } })));
        expect(order.slice(-POSITION_LAYER_IDS.length), `${base}`).toEqual([...POSITION_LAYER_IDS]);
      }
    }
  });

  it('is in the style even with position off, so a base view change never drops it', () => {
    const s = buildStyle(opts({}));
    expect(s.sources[POSITION_SOURCE]).toEqual({ type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    expect(buildStyle(opts({ base: 'aerial', position: marker })).sources[POSITION_SOURCE]).toEqual({ type: 'geojson', data: marker });
  });

  it('is drawn with nothing installed', () => {
    expect(allIds(buildStyle(opts({ installed: summarizeInstalled([]) }))).slice(1)).toEqual([...POSITION_LAYER_IDS]);
  });

  it('passes the style spec validator with a marker in it', () => {
    expect(validateStyleMin(buildStyle(opts({ base: 'hybrid', position: marker })))).toEqual([]);
  });
});
