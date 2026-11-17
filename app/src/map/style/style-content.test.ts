// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Checks on what the style draws (colors, patterns, images, which features
// show), as opposed to build-style.test.ts, which checks its mechanics.

import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import type { ArchiveEntry, ArchiveMeta } from '../../platform/archive-meta';
import { summarizeInstalled } from '../installed';
import { PUBLIC_LAND_CATEGORIES } from '../public-land';
import { buildStyle, type BaseView, type StyleOptions } from './build-style';
import { STYLE_IMAGE_IDS, styleImage } from './images';
import { basePalette, imageryPalette, parcelPalette, positionPalette, publicLandDash, publicLandPalette, publicLandStyle, publicLandTextPalette, relationPalette, selectionPalette } from './palette';

function entry(layer: string, kind: 'vector' | 'raster'): ArchiveEntry {
  const meta: ArchiveMeta = {
    schema: 1,
    layer,
    county: 'il-champaign',
    countyName: 'Champaign County, Illinois',
    kind,
    title: layer,
    minzoom: kind === 'raster' ? 10 : 0,
    maxzoom: 15,
    bounds: [-88.47, 39.87, -87.92, 40.41],
    bytes: 1,
    buildDate: '2026-11-12',
    sources: [{ name: 'S', license: 'L', credit: 'C', url: 'https://example.org', dataDate: '2026-01-01' }],
    notes: '',
  };
  return { county: 'il-champaign', layer, meta };
}

const installed = summarizeInstalled([entry('basemap', 'vector'), entry('aerial', 'raster'), entry('publicland', 'vector')]);

function style(base: BaseView, extra: Partial<StyleOptions> = {}) {
  return buildStyle({ base, overlays: { publicland: true }, installed, glyphs: 'http://x/{fontstack}/{range}.pbf', ...extra });
}

const layer = (layers: LayerSpecification[], id: string) => layers.find((l) => l.id === id) as (LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown>; filter?: unknown }) | undefined;

/** Every image name a style asks for, from icon-image and fill-pattern. */
function imagesUsed(layers: LayerSpecification[]): Set<string> {
  const names = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string' && /^(pl-|shield-)/.test(v)) names.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
  };
  for (const l of layers) {
    walk((l as { layout?: Record<string, unknown> }).layout?.['icon-image']);
    walk((l as { paint?: Record<string, unknown> }).paint?.['fill-pattern']);
  }
  return names;
}

describe('style content: public land', () => {
  it('colors every category from the palette, which the legend also reads', () => {
    const fill = layer(style('map').layers, 'publicland-fill')!;
    const json = JSON.stringify(fill.paint?.['fill-color']);
    for (const c of PUBLIC_LAND_CATEGORIES) expect(json).toContain(publicLandPalette[c]);
    expect(fill.paint?.['fill-opacity']).toBe(publicLandStyle.fillOpacity);
  });

  it('gives each dashed category its own outline layer with the palette dash, and solid ones none', () => {
    const layers = style('map').layers;
    for (const c of PUBLIC_LAND_CATEGORIES) {
      const dashed = layer(layers, `publicland-outline-${c}`);
      if (publicLandDash[c].length) expect(dashed?.paint?.['line-dasharray']).toEqual([...publicLandDash[c]]);
      else expect(dashed).toBeUndefined();
    }
  });

  it('the categories that come closest under color blindness differ in outline', () => {
    // From the palette check: land trust and other, state and federal.
    expect(publicLandDash.ngo).not.toEqual(publicLandDash.other);
    expect(publicLandDash.state).not.toEqual(publicLandDash.federal);
  });

  it('hatches closed and restricted land, and names a closed site as closed', () => {
    const layers = style('map').layers;
    const hatch = layer(layers, 'publicland-hatch')!;
    expect(JSON.stringify(hatch.filter)).toContain('closed');
    expect(JSON.stringify(hatch.paint?.['fill-pattern'])).toContain('pl-hatch-closed');
    expect(JSON.stringify(layer(layers, 'publicland-label')!.layout?.['text-field'])).toContain('Closed to the public');
  });

  it('puts a white casing under the outlines over imagery only', () => {
    expect(layer(style('map').layers, 'publicland-casing')).toBeUndefined();
    expect(layer(style('hybrid').layers, 'publicland-casing')?.paint?.['line-color']).toBe(publicLandStyle.casingOnImagery);
  });

  it('draws the tapped site in the selection colors', () => {
    const layers = style('map', { selection: { name: 'A', manager: 'B' } }).layers;
    expect(layer(layers, 'publicland-selected')?.paint?.['line-color']).toBe(selectionPalette.core);
    expect(layer(layers, 'publicland-selected-casing')?.paint?.['line-color']).toBe(selectionPalette.casing);
  });
});

describe('style content: images', () => {
  it('every image the style asks for can be drawn', () => {
    for (const base of ['map', 'aerial', 'hybrid'] as const) {
      for (const name of imagesUsed(style(base).layers)) {
        expect(STYLE_IMAGE_IDS as readonly string[]).toContain(name);
      }
    }
  });

  it('draws each image at the pixel ratio asked for, with stretch areas for shields', () => {
    for (const id of STYLE_IMAGE_IDS) {
      const one = styleImage(id, 1)!;
      const two = styleImage(id, 2)!;
      expect(two.data.width).toBe(one.data.width * 2);
      expect(two.data.data.length).toBe(two.data.width * two.data.height * 4);
      expect(two.options.pixelRatio).toBe(2);
      if (id.startsWith('shield-')) expect(two.options.stretchX).toBeDefined();
    }
    expect(styleImage('nope')).toBeNull();
  });

  it('the hatch is see-through between its lines', () => {
    const img = styleImage('pl-hatch-closed', 2)!.data;
    const alphas = new Set<number>();
    for (let i = 3; i < img.data.length; i += 4) alphas.add(img.data[i]!);
    expect(alphas.has(0)).toBe(true);
    expect(Math.max(...alphas)).toBeGreaterThan(100);
  });
});

describe('style content: base map', () => {
  it('leaves out town points of interest: only cemeteries are named from the points layer', () => {
    const poiLayers = style('map').layers.filter((l) => (l as { 'source-layer'?: string })['source-layer'] === 'pois');
    expect(poiLayers.map((l) => l.id)).toEqual(['label-cemetery']);
  });

  it('draws field lanes, creeks, ditches and the county line', () => {
    const ids = style('map').layers.map((l) => l.id);
    for (const id of ['base-track', 'base-water-line', 'base-boundary-county', 'base-boundary-county-band', 'label-shield-route']) expect(ids).toContain(id);
    expect(JSON.stringify(layer(style('map').layers, 'base-water-line')!.paint?.['line-width'])).toContain('ditch');
  });

  it('draws the county line and route numbers over imagery in the hybrid view', () => {
    const ids = style('hybrid').layers.map((l) => l.id);
    expect(ids).toContain('hybrid-boundary-county');
    expect(ids).toContain('hybrid-road-minor-casing');
    expect(ids).toContain('label-shield-route');
  });

  it('starts the aerial and hybrid views on the plain land color, not the map view one', () => {
    const bg = (b: BaseView) => (style(b).layers[0] as unknown as { paint: Record<string, string> }).paint['background-color'];
    expect(bg('aerial')).toBe(bg('hybrid'));
    expect(bg('aerial')).not.toBe(bg('map'));
  });
});

describe('style content: property lines', () => {
  const withParcels = summarizeInstalled([entry('basemap', 'vector'), entry('aerial', 'raster'), entry('publicland', 'vector'), entry('parcels', 'vector')]);
  const parcelStyle = (base: BaseView) => style(base, { installed: withParcels, overlays: { publicland: true, parcels: true } });

  it('a cased line in every base view: dark casing under a bright core, no fill', () => {
    for (const base of ['map', 'aerial', 'hybrid'] as const) {
      const layers = parcelStyle(base).layers;
      const parcelLayers = layers.filter((l) => (l as { source?: string }).source === 'parcels:il-champaign');
      expect(parcelLayers.map((l) => l.type)).toEqual(['line', 'line']);
      expect(layer(layers, 'parcels-casing:parcels:il-champaign')?.paint?.['line-color']).toBe(parcelPalette.casing);
      expect(layer(layers, 'parcels-line:parcels:il-champaign')?.paint?.['line-color']).toBe(parcelPalette.core);
    }
  });

  it('the core color is not used by public land, roads, water, the marker or the selection', () => {
    const taken = new Set<string>(
      [
        ...Object.values(publicLandPalette),
        ...Object.values(publicLandTextPalette),
        selectionPalette.core,
        ...Object.values(basePalette),
        ...Object.values(imageryPalette),
        ...Object.values(positionPalette).filter((v) => typeof v === 'string'),
      ].map((c) => String(c).toLowerCase()),
    );
    expect(taken.has(parcelPalette.core.toLowerCase())).toBe(false);
  });

  it('thin at zoom 13, clear at 15 and heavy at 20', () => {
    const w = new Map(parcelPalette.coreWidth.map(([z, v]) => [z, v]));
    expect(w.get(13)!).toBeLessThan(1);
    expect(w.get(15)!).toBeGreaterThan(w.get(13)!);
    expect(w.get(20)!).toBeGreaterThanOrEqual(3);
  });

  it('the tapped parcel uses the selection colors; the parcel the phone is in uses the marker blue, not the selection', () => {
    const layers = parcelStyle('map').layers;
    expect(layer(layers, 'parcel-selected')?.paint?.['line-color']).toBe(selectionPalette.core);
    expect(layer(layers, 'parcel-here')?.paint?.['line-color']).toBe(relationPalette.hereGlow);
    expect(relationPalette.hereGlow).not.toBe(selectionPalette.core);
  });

  it('the connector and tick show from zoom 15; the tick image can be drawn', () => {
    const layers = parcelStyle('hybrid').layers;
    expect((layer(layers, 'parcel-connector') as { minzoom?: number }).minzoom).toBe(15);
    expect((layer(layers, 'parcel-tick') as { minzoom?: number }).minzoom).toBe(15);
    expect(layer(layers, 'parcel-tick')?.layout?.['icon-image']).toBe('parcel-tick');
    expect(STYLE_IMAGE_IDS as readonly string[]).toContain('parcel-tick');
  });

  it('no layer draws parcels when they are not installed', () => {
    for (const base of ['map', 'aerial', 'hybrid'] as const) expect(style(base).layers.some((l) => l.id.includes('parcel'))).toBe(false);
  });
});
