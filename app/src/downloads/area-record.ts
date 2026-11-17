// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A downloaded area's ID and its stored record (contract.ts AreaRecord).

import { ARCHIVE_ID_PATTERN } from '../platform/archive-meta';
import type { Bounds } from '../map/tile-math';
import type { AreaRecord } from './contract';

/** Width of the time part of an area ID: milliseconds in base 36, enough until the year 5188. */
const TIME_DIGITS = 9;
const RANDOM_DIGITS = 8;

/**
 * A new area ID: "a", the start time in base 36, a hyphen and a random part,
 * all lower case letters and digits (ARCHIVE_ID_PATTERN). IDs made later sort
 * after earlier ones as plain text, which is how the map puts the newest area
 * first without reading any record.
 */
export function makeAreaId(now: number = Date.now(), random: () => number = Math.random): string {
  const time = Math.max(0, Math.floor(now)).toString(36).padStart(TIME_DIGITS, '0');
  let rand = '';
  while (rand.length < RANDOM_DIGITS) rand += Math.floor(random() * 36).toString(36);
  const id = `a${time}-${rand}`;
  if (!ARCHIVE_ID_PATTERN.test(id)) throw new Error(`made a bad area ID ${id}`);
  return id;
}

/** Orders area IDs newest first. IDs not made by makeAreaId sort after those that were. */
export function compareAreaIdsNewestFirst(a: string, b: string): number {
  const made = /^a[0-9a-z]{9}-/;
  const am = made.test(a);
  const bm = made.test(b);
  if (am !== bm) return am ? -1 : 1;
  return a < b ? 1 : a > b ? -1 : 0;
}

function isBounds(v: unknown): v is Bounds {
  return Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
}

/**
 * The record of an area as the downloader handed it back. A record that does
 * not parse still gives a view, so the area can be seen and removed: its name
 * is empty and its bounds are null-island zeros, which the screens should not
 * draw (`bytes` is 0 and `layers` empty as well).
 */
export function parseAreaRecord(text: string, id: string): { record: AreaRecord; valid: boolean } {
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    if (typeof o !== 'object' || o === null) throw new Error('not an object');
    if (typeof o['name'] !== 'string' || !isBounds(o['bounds']) || !Array.isArray(o['layers']) || typeof o['created'] !== 'string') {
      throw new Error('missing fields');
    }
    const record: AreaRecord = {
      id,
      name: o['name'],
      bounds: o['bounds'],
      layers: (o['layers'] as unknown[]).filter((l): l is string => typeof l === 'string'),
      aerialMaxzoom: typeof o['aerialMaxzoom'] === 'number' ? o['aerialMaxzoom'] : 0,
      created: o['created'],
      release: typeof o['release'] === 'string' ? o['release'] : '',
      dataDate: typeof o['dataDate'] === 'string' ? o['dataDate'] : '',
      bytes: typeof o['bytes'] === 'number' ? o['bytes'] : 0,
    };
    if (typeof o['county'] === 'string') record.county = o['county'];
    return { record, valid: true };
  } catch {
    return {
      record: { id, name: '', bounds: [0, 0, 0, 0], layers: [], aerialMaxzoom: 0, created: '', release: '', dataDate: '', bytes: 0 },
      valid: false,
    };
  }
}
