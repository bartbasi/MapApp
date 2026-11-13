// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Picks the hand-written hunting note for a public land site (DECISIONS D16).
// The notes live in hunting-notes.json, written by the lead. Rules, as that
// file states them: the first matching note wins, so site notes come before
// manager notes; matching is case-insensitive and tests whether the field
// contains the text. Every condition in a note's "match" must hold.

import notesFile from './hunting-notes.json';

export type HuntingStatus = 'no' | 'limited' | 'unknown';

export interface HuntingNote {
  hunting: HuntingStatus;
  text: string;
  sourceName: string;
  sourceUrl: string;
}

export interface NoteMatch {
  nameIncludes?: string;
  managerIncludes?: string;
  category?: string;
}

export interface HuntingNotes {
  asOf: string;
  notes: Array<HuntingNote & { match: NoteMatch }>;
  default: HuntingNote;
}

export interface SiteForNote {
  name: string;
  manager: string;
  category: string;
}

function contains(field: string, text: string): boolean {
  return field.toLowerCase().includes(text.toLowerCase());
}

function matches(m: NoteMatch, site: SiteForNote): boolean {
  if (m.nameIncludes !== undefined && !contains(site.name, m.nameIncludes)) return false;
  if (m.managerIncludes !== undefined && !contains(site.manager, m.managerIncludes)) return false;
  if (m.category !== undefined && site.category.toLowerCase() !== m.category.toLowerCase()) return false;
  return true;
}

/** The first note whose conditions all hold, or the default note. */
export function findHuntingNote(file: HuntingNotes, site: SiteForNote): HuntingNote {
  for (const n of file.notes) {
    // A note with no conditions would match every site; treat it as a mistake.
    if (Object.keys(n.match).length === 0) continue;
    if (matches(n.match, site)) {
      return { hunting: n.hunting, text: n.text, sourceName: n.sourceName, sourceUrl: n.sourceUrl };
    }
  }
  return file.default;
}

/** The notes bundled with the app. */
export const huntingNotes: HuntingNotes = notesFile as HuntingNotes;

/** Plain words for the hunting status. "Public" and "huntable" are different things (D16). */
export function huntingStatusText(h: HuntingStatus): string {
  switch (h) {
    case 'no':
      return 'Hunting is not allowed';
    case 'limited':
      return 'Hunting only in limited cases';
    default:
      return 'Hunting not confirmed';
  }
}
