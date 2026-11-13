// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// What is installed, summed up per layer: one entry per layer, however many
// counties it covers. The style builder and the screens work from this.

import type { ArchiveEntry } from '../platform/archive-meta';
import { unionBounds, type Bounds } from './tile-math';

export interface InstalledLayer {
  layer: string;
  kind: 'vector' | 'raster';
  title: string;
  minzoom: number;
  maxzoom: number;
  /** The area covered by all of this layer's archives together. */
  bounds: Bounds;
  /** The archives of this layer, in the order tiles are looked up. */
  archives: ArchiveEntry[];
}

export type InstalledLayers = ReadonlyMap<string, InstalledLayer>;

export function summarizeInstalled(entries: readonly ArchiveEntry[]): InstalledLayers {
  const groups = new Map<string, ArchiveEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.layer) ?? [];
    list.push(e);
    groups.set(e.layer, list);
  }
  const out = new Map<string, InstalledLayer>();
  for (const [layer, archives] of groups) {
    const first = archives[0];
    if (!first) continue;
    const sameKind = archives.filter((a) => a.meta.kind === first.meta.kind);
    if (sameKind.length !== archives.length) {
      console.warn(`layer ${layer} mixes vector and raster archives; only ${first.meta.kind} ones are used`);
    }
    out.set(layer, {
      layer,
      kind: first.meta.kind,
      title: first.meta.title,
      minzoom: Math.min(...sameKind.map((a) => a.meta.minzoom)),
      maxzoom: Math.max(...sameKind.map((a) => a.meta.maxzoom)),
      bounds: unionBounds(sameKind.map((a) => a.meta.bounds)) ?? [-180, -85, 180, 85],
      archives: sameKind,
    });
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The first sentence of a credit, for the on-map credit line where space is
 * short. A full stop counts as a sentence end only after a lower case letter,
 * a digit or a bracket, so "U.S. Geological Survey" is not cut.
 */
export function firstSentence(credit: string): string {
  const m = /^(.*?[a-z0-9)])\.\s/.exec(credit);
  return m?.[1] ?? credit;
}

/**
 * The on-map credit for some archives, built from their metadata: the first
 * sentence of each distinct credit, once. The full credits are on the sources
 * screen. MapLibre shows this as HTML, so the text is escaped.
 */
export function attributionHtml(archives: readonly ArchiveEntry[]): string {
  const seen = new Set<string>();
  for (const a of archives) {
    for (const s of a.meta.sources) {
      if (s.credit) seen.add(firstSentence(s.credit));
    }
  }
  return [...seen].map(escapeHtml).join(' | ');
}
