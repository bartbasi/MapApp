// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { AreaError, AreaStatus } from '../../downloads/contract';
import { ACTION_LABELS, CATALOG_UNSUPPORTED_TEXT, METERED_ASK_FIRST, METERED_NOTE, METERED_NOTE_TITLE, SPACE_MARGIN_BYTES, contentsLine, meteredQuestion, formatSize, hasRoom, isDamagedRecord, notEnoughSpaceText, propertyLinesNote, spaceNeeded, listLayers, percentDone, progressLine, spanText, startErrorText, statusText } from './text';

const MB = 1_000_000;

describe('formatSize', () => {
  it('gives MB with one decimal under 100 MB', () => {
    expect(formatSize(1.7 * MB)).toBe('1.7 MB');
    expect(formatSize(22.7 * MB)).toBe('22.7 MB');
  });
  it('gives whole MB from 100 MB, and GB from 1000 MB', () => {
    expect(formatSize(140565035)).toBe('141 MB');
    expect(formatSize(225572890)).toBe('226 MB');
    expect(formatSize(1000 * MB)).toBe('1.00 GB');
    expect(formatSize(9.6e9)).toBe('9.60 GB');
    expect(formatSize(12.5e9)).toBe('12.5 GB');
  });

  it('counts in decimal MB, as Android shows storage: 12,035,805 bytes is 12.0 MB', () => {
    expect(formatSize(12035805)).toBe('12.0 MB');
    expect(formatSize(4271625)).toBe('4.3 MB');
  });
  it('never shows bytes or KB', () => {
    expect(formatSize(99815)).toBe('0.1 MB');
    expect(formatSize(30000)).toBe('less than 0.1 MB');
    expect(formatSize(0)).toBe('0 MB');
    expect(formatSize(Number.NaN)).toBe('0 MB');
  });
});

describe('percentDone and progressLine', () => {
  it('does not say 100 before the end', () => {
    expect(percentDone(999, 1000)).toBe(99);
    expect(percentDone(1000, 1000)).toBe(100);
    expect(percentDone(5, 0)).toBe(0);
  });
  it('names the unit once when both sides share it', () => {
    expect(progressLine(11 * MB, 24.4 * MB)).toBe('11.0 of 24.4 MB');
    expect(progressLine(0.05 * MB, 2 * MB)).toBe('0.1 of 2.0 MB');
    expect(progressLine(0.01 * MB, 2 * MB)).toBe('0 of 2.0 MB');
    expect(progressLine(0, 3.4 * MB)).toBe('0 of 3.4 MB');
    expect(progressLine(600 * MB, 1200 * MB)).toBe('600 MB of 1.20 GB');
  });
});

describe('statusText', () => {
  const view = (status: AreaStatus, error?: AreaError) => ({ status, ...(error ? { error } : {}), bytesDone: 11 * MB, bytesTotal: 24.4 * MB });

  it('has words, an icon and a tone for every status', () => {
    const statuses: AreaStatus[] = ['queued', 'downloading', 'paused', 'waiting', 'failed', 'complete'];
    const titles = new Set<string>();
    for (const s of statuses) {
      const t = statusText(view(s));
      expect(t.title.length).toBeGreaterThan(0);
      titles.add(t.title);
    }
    expect(titles.size).toBe(statuses.length);
    expect(statusText(view('downloading')).title).toBe('Downloading, 45%');
    expect(statusText(view('paused')).action).toBe('resume');
    expect(statusText(view('complete')).progress).toBe(false);
  });

  it('says what to do about every error', () => {
    const errors: AreaError[] = ['changed', 'no-space', 'server', 'corrupt', 'other'];
    for (const e of errors) {
      const t = statusText(view('failed', e));
      expect(t.tone).toBe('problem');
      expect(t.detail).toMatch(/\.$/);
      expect(t.action === 'retry' || t.action === 'again').toBe(true);
    }
    expect(statusText(view('failed', 'no-space')).detail).toContain('13.4 MB');
    expect(statusText(view('failed', 'changed')).action).toBe('again');
    expect(statusText(view('failed', 'corrupt')).action).toBe('again');
    expect(statusText(view('failed')).title).toBe('Stopped by an error');
  });

  it('uses none of the words kept out of the screens', () => {
    const banned = /\b(tiles?|archives?|zoom|extracts?)\b|—/i;
    const statuses: AreaStatus[] = ['queued', 'downloading', 'paused', 'waiting', 'complete'];
    const errors: AreaError[] = ['changed', 'no-space', 'server', 'corrupt', 'other'];
    const all = [...statuses.map((s) => statusText(view(s))), ...errors.map((e) => statusText(view('failed', e)))];
    for (const t of all) expect(`${t.title} ${t.detail}`).not.toMatch(banned);
    for (const c of ['offline', 'no-space', 'nothing', 'catalog-unavailable', undefined]) expect(startErrorText(c)).not.toMatch(banned);
  });
});

describe('layer words', () => {
  it('lists layers in a sentence', () => {
    expect(listLayers(['basemap'])).toBe('Map');
    expect(listLayers(['basemap', 'publicland', 'aerial'])).toBe('Map, public land and aerial imagery');
    expect(contentsLine(['aerial', 'basemap'], 15)).toBe('Map and aerial imagery (medium detail).');
    expect(contentsLine(['basemap', 'publicland'], 16)).toBe('Map and public land.');
  });
});

describe('space on the phone', () => {
  it('asks for the download and the room the service keeps spare, as start() does', () => {
    expect(spaceNeeded(10 * MB)).toBe(10 * MB + SPACE_MARGIN_BYTES);
    expect(hasRoom(10 * MB, 10 * MB + SPACE_MARGIN_BYTES)).toBe(true);
    expect(hasRoom(10 * MB, 10 * MB + SPACE_MARGIN_BYTES - 1)).toBe(false);
    expect(hasRoom(10 * MB, undefined)).toBe(true);
    expect(notEnoughSpaceText(1.9 * MB, 20 * MB, false)).toBe(
      `It needs ${formatSize(1.9 * MB + SPACE_MARGIN_BYTES)} free (the download and some room to spare) and the phone has 20.0 MB. Delete a download, choose less imagery detail, or pick a smaller area.`,
    );
  });
});

describe('propertyLinesNote', () => {
  it('says property lines come with the app, never in a download', () => {
    expect(propertyLinesNote(['Macon County'], 'Macon County')).toBe('Property lines are not part of the download: they come with the app for Macon County and work offline.');
    expect(propertyLinesNote(['Macon County'], 'Champaign County, Illinois')).toBe('Property lines are not part of the download, and none are offered for Champaign County yet.');
    expect(propertyLinesNote(['Macon County'])).toBe('Property lines are not part of the download: they come with the app for Macon County and work offline there.');
    expect(propertyLinesNote([])).toBe('Property lines are not part of the download, and none are on this phone yet.');
  });
});

describe('isDamagedRecord', () => {
  it('knows the record the service gives for one it could not read', () => {
    expect(isDamagedRecord({ name: '', bounds: [0, 0, 0, 0], layers: [] })).toBe(true);
    expect(isDamagedRecord({ name: 'A', bounds: [-89, 39, -88, 40], layers: ['basemap'] })).toBe(false);
  });
});

describe('spanText', () => {
  it('gives miles first, then km', () => {
    expect(spanText(10, 6.4)).toBe('6.2 by 4.0 miles (10 by 6.4 km)');
    expect(spanText(40, 45)).toBe('25 by 28 miles (40 by 45 km)');
  });
});

describe('startErrorText', () => {
  it('gives the sizes when the phone is full', () => {
    expect(startErrorText('no-space', { neededBytes: 80 * MB, freeBytes: 20 * MB })).toBe(
      'There is not enough space on the phone. It needs 80.0 MB free (the download and some room to spare) and has 20.0 MB. Delete a download or choose less.',
    );
    expect(startErrorText('no-space')).toBe('There is not enough space on the phone. Delete a download or choose less.');
  });
});

describe('mobile data words (S1)', () => {
  const waiting = (waitingFor?: 'connection' | 'unmetered') => ({ status: 'waiting' as const, ...(waitingFor ? { waitingFor } : {}), bytesDone: 11 * MB, bytesTotal: 24.4 * MB });

  it('a download waiting for Wi-Fi says so, in one sentence, with a button to use mobile data', () => {
    const t = statusText(waiting('unmetered'));
    expect(t.title).toBe('Waiting for Wi-Fi');
    expect(t.detail).toBe('11.0 of 24.4 MB. Goes on by itself on Wi-Fi.');
    expect(t.action).toBe('use-mobile-data');
    expect(ACTION_LABELS['use-mobile-data']).toBe('Use mobile data');
  });

  it('is told apart from one waiting for a connection', () => {
    const t = statusText(waiting('connection'));
    expect(t.title).toBe('Waiting for a connection');
    expect(t.action).toBe('pause');
    expect(statusText(waiting()).title).toBe('Waiting for a connection');
    expect(t.icon).not.toBe(statusText(waiting('unmetered')).icon);
  });

  it('never says a download uses the data plan by itself', () => {
    const words = [METERED_NOTE_TITLE, METERED_NOTE, METERED_ASK_FIRST, meteredQuestion(5 * MB).title, meteredQuestion(5 * MB).detail, statusText(waiting('unmetered')).detail];
    for (const w of words) {
      expect(w).not.toMatch(/\b(tiles?|archives?|zoom|extracts?)\b|\u2014/i);
      // The two sentences that were not true: a download used the data plan whatever the user said.
      expect(w).not.toContain('This download uses your data plan.');
      expect(w).not.toContain('Downloads use your data plan.');
    }
    expect(METERED_NOTE).toContain('wait for Wi-Fi');
    expect(METERED_ASK_FIRST).toContain('asked before');
    expect(meteredQuestion(5 * MB).title).toBe('Use 5.0 MB of mobile data?');
  });

  it('says to update the app when the list of maps cannot be read', () => {
    expect(startErrorText('catalog-unsupported')).toBe('This version of the app cannot read the list of maps. Update the app.');
    expect(CATALOG_UNSUPPORTED_TEXT).toBe(startErrorText('catalog-unsupported'));
    expect(startErrorText('catalog-unsupported')).not.toBe(startErrorText('catalog-unavailable'));
  });
});
