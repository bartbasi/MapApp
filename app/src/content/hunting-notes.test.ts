// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { findHuntingNote, huntingNotes, type HuntingNotes } from './hunting-notes';

const notes: HuntingNotes = {
  asOf: '2026-11-12',
  notes: [
    { match: { nameIncludes: 'Gifford', category: 'state' }, hunting: 'limited', text: 'site', sourceName: 'a', sourceUrl: 'https://a' },
    { match: { managerIncludes: 'Forest Preserve' }, hunting: 'no', text: 'manager', sourceName: 'b', sourceUrl: 'https://b' },
    { match: { category: 'state' }, hunting: 'unknown', text: 'state', sourceName: 'c', sourceUrl: 'https://c' },
  ],
  default: { hunting: 'unknown', text: 'default', sourceName: '', sourceUrl: '' },
};

describe('findHuntingNote', () => {
  it('first match wins: a site note beats a broader one that also matches', () => {
    expect(findHuntingNote(notes, { name: 'Gifford Pheasant Habitat Area', manager: 'IDNR', category: 'state' }).text).toBe('site');
  });

  it('all conditions of a note must hold', () => {
    // Name matches the first note but the category does not, so the next match applies.
    expect(findHuntingNote(notes, { name: 'Gifford Park', manager: 'Village of Gifford', category: 'local' }).text).toBe('default');
    expect(findHuntingNote(notes, { name: 'Other State Site', manager: 'IDNR', category: 'state' }).text).toBe('state');
  });

  it('falls back to the default when nothing matches', () => {
    expect(findHuntingNote(notes, { name: 'Somewhere', manager: 'City of Somewhere', category: 'local' })).toEqual(notes.default);
  });

  it('matching is case-insensitive', () => {
    expect(findHuntingNote(notes, { name: 'GIFFORD PHA', manager: '', category: 'STATE' }).text).toBe('site');
    expect(findHuntingNote(notes, { name: 'Lake', manager: 'champaign county forest preserve district', category: 'county_district' }).text).toBe('manager');
  });

  it('matches text contained anywhere in the field', () => {
    expect(findHuntingNote(notes, { name: 'x', manager: 'The Forest Preserve District of Somewhere', category: 'other' }).text).toBe('manager');
  });

  it('ignores a note with no conditions rather than matching every site', () => {
    const withEmpty: HuntingNotes = { ...notes, notes: [{ match: {}, hunting: 'no', text: 'empty', sourceName: '', sourceUrl: '' }, ...notes.notes] };
    expect(findHuntingNote(withEmpty, { name: 'x', manager: 'y', category: 'local' }).text).toBe('default');
  });
});

describe('the bundled hunting-notes.json', () => {
  it('gives Champaign County Forest Preserve land the "no hunting" note', () => {
    const n = findHuntingNote(huntingNotes, { name: 'Lake of the Woods', manager: 'Champaign County Forest Preserve District', category: 'county_district' });
    expect(n.hunting).toBe('no');
    expect(n.sourceUrl).toMatch(/^https:\/\//);
  });

  it('gives an unlisted manager the default note', () => {
    const n = findHuntingNote(huntingNotes, { name: 'Hessel Park', manager: 'Champaign Park District', category: 'local' });
    expect(n).toEqual(huntingNotes.default);
  });

  it('has a date', () => {
    expect(huntingNotes.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
