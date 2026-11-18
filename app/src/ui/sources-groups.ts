// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The Sources and licenses screen, grouped by layer. One layer can be on the
// phone several times: the overview map, what came with the app, and each
// downloaded county or area. Each layer is listed once, with each source
// once. Under it, what came with the app is listed county by county, and the
// downloads of a county are one line ("Macon County, in 6 downloads"), so
// the list stays short however many areas are on the phone.

import { layerTitle } from '../map/installed';
import { archiveLabel, type ArchiveEntry, type ArchiveSource } from '../platform/archive-meta';

export interface SourcePlace {
  /** Unique within its layer. */
  key: string;
  /** Where this copy of the layer covers, and how it reached the phone. */
  where: string;
  /** The newest build date among the copies on this line. */
  buildDate: string;
  /** All the copies on this line together. */
  bytes: number;
  /** How many copies the line stands for. */
  count: number;
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
  const seenArchive = new Set<string>();
  /** The downloaded copies of each layer, by county, gathered before they become lines. */
  const downloaded = new Map<string, Map<string, ArchiveEntry[]>>();
  for (const entry of entries) {
    let g = groups.get(entry.layer);
    if (!g) {
      g = { layer: entry.layer, title: layerTitle(entry), places: [], sources: [], notes: [] };
      groups.set(entry.layer, g);
    }
    const key = archiveLabel(entry);
    if (seenArchive.has(key)) continue;
    seenArchive.add(key);
    if (entry.area !== undefined) {
      const byCounty = downloaded.get(entry.layer) ?? new Map<string, ArchiveEntry[]>();
      downloaded.set(entry.layer, byCounty);
      byCounty.set(entry.county, [...(byCounty.get(entry.county) ?? []), entry]);
    } else {
      g.places.push({ key, where: placeText(entry), buildDate: entry.meta.buildDate, bytes: entry.meta.bytes, count: 1 });
    }
    for (const s of entry.meta.sources) {
      if (!g.sources.some((t) => sameSource(s, t))) g.sources.push(s);
    }
    const note = entry.meta.notes?.trim();
    if (note && !g.notes.includes(note)) g.notes.push(note);
  }
  for (const [layer, byCounty] of downloaded) {
    const g = groups.get(layer);
    if (!g) continue;
    for (const [county, copies] of byCounty) {
      const first = copies[0];
      if (!first) continue;
      g.places.push({
        key: `${county}@downloads`,
        where: downloadsText(first, copies.length, areaNames),
        buildDate: copies.map((c) => c.meta.buildDate).sort().pop() ?? '',
        bytes: copies.reduce((s, c) => s + c.meta.bytes, 0),
        count: copies.length,
      });
    }
  }
  return [...groups.values()];
}

function sameSource(a: ArchiveSource, b: ArchiveSource): boolean {
  return a.name === b.name && a.license === b.license && a.credit === b.credit && a.dataDate === b.dataDate && a.url === b.url;
}

function countyOf(entry: ArchiveEntry): string {
  return entry.meta.countyName.replace(/, Illinois$/, '');
}

function placeText(entry: ArchiveEntry): string {
  const county = countyOf(entry);
  return entry.county === 'overview' ? `${county} of the whole region, with the app` : `${county}, with the app`;
}

/** "Macon County, in 6 downloads", or with one download its name. */
function downloadsText(first: ArchiveEntry, count: number, areaNames: ReadonlyMap<string, string>): string {
  const county = countyOf(first);
  if (count > 1) return `${county}, in ${count} downloads`;
  const name = first.area !== undefined ? areaNames.get(first.area)?.trim() : undefined;
  return name && name !== county ? `${county}, downloaded as ${name}` : `${county}, downloaded`;
}
