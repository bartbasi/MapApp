// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The Sources and licenses screen, grouped by layer. One layer can be on the
// phone several times: the overview map, what came with the app, and each
// downloaded county or area. Each layer is listed once, with every place it
// covers, and each of its sources once.

import { layerTitle } from '../map/installed';
import { archiveLabel, type ArchiveEntry, type ArchiveSource } from '../platform/archive-meta';

export interface SourcePlace {
  /** Unique among all places (archiveLabel). */
  key: string;
  /** Where this copy of the layer covers, and how it reached the phone. */
  where: string;
  buildDate: string;
  bytes: number;
}

export interface SourceGroup {
  layer: string;
  title: string;
  places: SourcePlace[];
  sources: ArchiveSource[];
  notes: string[];
}

/**
 * Groups the installed archives by layer, in the order they come. Sources
 * and notes that repeat across copies of a layer are listed once.
 * `areaNames` gives the name of each downloaded area by its ID.
 */
export function groupSources(entries: readonly ArchiveEntry[], areaNames: ReadonlyMap<string, string> = new Map()): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  const seenPlace = new Set<string>();
  for (const entry of entries) {
    let g = groups.get(entry.layer);
    if (!g) {
      g = { layer: entry.layer, title: layerTitle(entry), places: [], sources: [], notes: [] };
      groups.set(entry.layer, g);
    }
    const key = archiveLabel(entry);
    if (seenPlace.has(key)) continue;
    seenPlace.add(key);
    g.places.push({ key, where: placeText(entry, areaNames), buildDate: entry.meta.buildDate, bytes: entry.meta.bytes });
    for (const s of entry.meta.sources) {
      if (!g.sources.some((t) => sameSource(s, t))) g.sources.push(s);
    }
    const note = entry.meta.notes?.trim();
    if (note && !g.notes.includes(note)) g.notes.push(note);
  }
  return [...groups.values()];
}

function sameSource(a: ArchiveSource, b: ArchiveSource): boolean {
  return a.name === b.name && a.license === b.license && a.credit === b.credit && a.dataDate === b.dataDate && a.url === b.url;
}

function placeText(entry: ArchiveEntry, areaNames: ReadonlyMap<string, string>): string {
  const county = entry.meta.countyName.replace(/, Illinois$/, '');
  if (entry.area !== undefined) {
    const name = areaNames.get(entry.area)?.trim();
    if (name && name !== county) return `${county}, downloaded as ${name}`;
    return `${county}, downloaded`;
  }
  return entry.county === 'overview' ? `${county} of the whole region, with the app` : `${county}, with the app`;
}
