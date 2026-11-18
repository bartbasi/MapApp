// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Which layers a download holds. A downloaded area includes every layer the
// user has turned on (the brief, feature 2). The map itself is always
// included. Aerial imagery is the one large layer, so it can be left out even
// when it is in use; other layers that are off can be added.

import type { AreaView, CountyOffer } from '../../downloads/contract';
import { listLayers } from './text';

export const BASE_LAYER = 'basemap';
export const IMAGERY_LAYER = 'aerial';

export type LayerRule =
  /** The map itself: always in. */
  | 'always'
  /** On in the Layers panel or the base view, so always in. */
  | 'on'
  /** May be left in or out. */
  | 'optional';

export interface LayerChoice {
  layer: string;
  rule: LayerRule;
  /** Whether the layer starts out chosen. */
  chosen: boolean;
}

/**
 * The rule for each layer a county offers, in the order shown: the map
 * first, imagery last. `layersOn` is what the user has on now: overlays that
 * are switched on, and 'aerial' when the base view uses imagery.
 */
export function layerChoices(offered: readonly string[], layersOn: readonly string[]): LayerChoice[] {
  const on = new Set(layersOn);
  const order = (l: string) => (l === BASE_LAYER ? 0 : l === IMAGERY_LAYER ? 2 : 1);
  return [...new Set(offered)]
    .sort((a, b) => order(a) - order(b))
    .map((layer) => {
      if (layer === BASE_LAYER) return { layer, rule: 'always', chosen: true };
      if (layer === IMAGERY_LAYER) return { layer, rule: 'optional', chosen: on.has(layer) };
      return on.has(layer) ? { layer, rule: 'on', chosen: true } : { layer, rule: 'optional', chosen: false };
    });
}

/** The layers asked for: the chosen ones, in the order shown. */
export function chosenLayers(choices: readonly LayerChoice[], picked: ReadonlySet<string>): string[] {
  return choices.filter((c) => c.rule !== 'optional' || picked.has(c.layer)).map((c) => c.layer);
}

/** Every layer offered for any county, once each. */
export function offeredLayers(offers: readonly CountyOffer[]): string[] {
  return [...new Set(offers.flatMap((o) => o.layers.map((l) => l.layer)))];
}

/** Total size of the chosen layers of a county, from the whole files listed in the offer. */
export function countyBytes(offer: CountyOffer, layers: readonly string[]): number {
  const want = new Set(layers);
  return offer.layers.filter((l) => want.has(l.layer)).reduce((sum, l) => sum + l.bytes, 0);
}

/** The highest imagery detail a county offers, for a whole county download. */
export function countyImageryMaxzoom(offer: CountyOffer): number {
  return offer.layers.find((l) => l.layer === IMAGERY_LAYER)?.maxzoom ?? 16;
}

/** Where a layer of a county stands: on the phone, or in a download not finished yet. */
export type Holding = 'on-phone' | 'coming';

/**
 * Each layer of a whole county that the phone already has, or will have once
 * a download goes on: from every whole-county download of it, whatever else
 * that download holds. A stopped download counts as nothing, since it may
 * never finish. Picked areas do not count: they hold a part of the county.
 */
export function countyHoldings(areas: readonly AreaView[], county: string): Map<string, Holding> {
  const out = new Map<string, Holding>();
  for (const a of areas) {
    if (a.record.county !== county || a.status === 'failed') continue;
    for (const layer of a.record.layers) {
      if (a.status === 'complete') out.set(layer, 'on-phone');
      else if (!out.has(layer)) out.set(layer, 'coming');
    }
  }
  return out;
}

/** The layers asked for that the phone neither has nor is getting: all a new download should fetch. */
export function missingLayers(layers: readonly string[], holdings: ReadonlyMap<string, Holding>): string[] {
  return layers.filter((l) => !holdings.has(l));
}

/**
 * The name of a new whole-county download: the county's name, or with what
 * it adds when the county already has a download, so the two read apart in
 * the list ("Macon County, aerial imagery").
 */
export function countyDownloadName(countyName: string, adding: readonly string[], holdings: ReadonlyMap<string, Holding>): string {
  return holdings.size === 0 ? countyName : `${countyName}, ${listLayers(adding).toLowerCase()}`;
}
