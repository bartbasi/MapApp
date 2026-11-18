// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { AreaError, AreaStatus } from '../../downloads/contract';
import { contentsLine, formatSize, isDamagedRecord, listLayers, percentDone, progressLine, spanText, startErrorText, statusText } from './text';

const MB = 1024 * 1024;

describe('formatSize', () => {
  it('gives MB with one decimal under 100 MB', () => {
    expect(formatSize(1.7 * MB)).toBe('1.7 MB');
    expect(formatSize(22.7 * MB)).toBe('22.7 MB');
  });
  it('gives whole MB from 100 MB, and GB from 1000 MB', () => {
    expect(formatSize(140565035)).toBe('134 MB');
    expect(formatSize(225572890)).toBe('215 MB');
    expect(formatSize(1000 * MB)).toBe('0.98 GB');
    expect(formatSize(9.6 * 1024 * MB)).toBe('9.60 GB');
    expect(formatSize(12.5 * 1024 * MB)).toBe('12.5 GB');
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
    expect(progressLine(0.01 * MB, 2 * MB)).toBe('less than 0.1 MB of 2.0 MB');
    expect(progressLine(600 * MB, 1200 * MB)).toBe('600 MB of 1.17 GB');
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
