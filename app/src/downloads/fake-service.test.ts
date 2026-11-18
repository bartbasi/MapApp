// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The stand-in the download screens are shown with must behave as the
// contract says, or the screenshots would show states the app never reaches.

import { describe, expect, it } from 'vitest';
import type { AreaRequest } from './contract';
import { FakeDownloadService, fakeOptionsFrom } from './fake-service';

const MB = 1024 * 1024;
const box: AreaRequest = { where: { bounds: [-89.1, 39.85, -88.9827, 39.9404] }, layers: ['basemap', 'aerial'], aerialMaxzoom: 16 };

describe('FakeDownloadService', () => {
  it('sizes a 10 km box as D33 measured it', async () => {
    const s = new FakeDownloadService({ tickMs: 0, estimateMs: 0 });
    const e = await s.estimate(box);
    const by = (l: string) => e.layers.filter((x) => x.layer === l).reduce((a, x) => a + x.bytes, 0) / MB;
    expect(by('basemap')).toBeCloseTo(1.7, 0);
    expect(by('aerial')).toBeCloseTo(22.7, 0);
    const low = await s.estimate({ ...box, aerialMaxzoom: 14 });
    expect(low.bytes).toBeLessThan(e.bytes);
    s.destroy();
  });

  it('finds nothing outside the counties', async () => {
    const s = new FakeDownloadService({ tickMs: 0, estimateMs: 0 });
    const e = await s.estimate({ ...box, where: { bounds: [-91, 41, -90.9, 41.1] } });
    expect(e.bytes).toBe(0);
    expect(e.missing).toEqual(['basemap', 'aerial']);
    await expect(s.start({ ...box, where: { bounds: [-91, 41, -90.9, 41.1] } }, 'x')).rejects.toMatchObject({ code: 'nothing' });
  });

  it('downloads one area at a time, waits offline, and goes on online', async () => {
    const s = new FakeDownloadService({ tickMs: 0, speed: 10 * MB });
    const a = await s.start(box, 'A');
    const b = await s.start(box, 'B');
    const status = (id: string) => s.areas().find((v) => v.record.id === id)?.status;
    expect(status(a)).toBe('downloading');
    expect(status(b)).toBe('queued');
    s.setNetwork({ online: false, metered: false });
    expect(status(a)).toBe('waiting');
    s.tick(1);
    expect(s.areas().find((v) => v.record.id === a)?.bytesDone).toBe(0);
    s.setNetwork({ online: true, metered: false });
    s.tick(10);
    expect(status(a)).toBe('complete');
    expect(status(b)).toBe('downloading');
    expect(s.areas()[0]!.record.name).toBe('B');
  });

  it('pauses, resumes, fails and deletes as the contract says', async () => {
    const s = new FakeDownloadService({ tickMs: 0, speed: 1 * MB });
    let archives = 0;
    s.onArchivesChanged(() => archives++);
    s.failNext('server', 0.1);
    const id = await s.start(box, 'A');
    s.tick(10);
    expect(s.areas()[0]).toMatchObject({ status: 'failed', error: 'server' });
    await s.resume(id);
    expect(s.areas()[0]!.status).toBe('downloading');
    await s.pause(id);
    expect(s.areas()[0]!.status).toBe('paused');
    s.complete(id);
    expect(archives).toBe(1);
    await s.remove(id);
    expect(s.areas()).toHaveLength(0);
    expect(archives).toBe(2);
  });

  it('refuses a download with no room, and fails one that fills the phone', async () => {
    const s = new FakeDownloadService({ tickMs: 0, speed: 100 * MB, freeBytes: 10 * MB });
    await expect(s.start(box, 'A')).rejects.toMatchObject({ code: 'no-space' });
    s.setFree(80 * MB);
    const id = await s.start(box, 'A');
    s.setFree(5 * MB);
    s.tick(1);
    expect(s.areas()[0]).toMatchObject({ status: 'failed', error: 'no-space' });
    s.setNetwork({ online: false, metered: false });
    await expect(s.resume(id)).rejects.toMatchObject({ code: 'offline' });
  });

  it('seeds one download in each status and each error', () => {
    const s = new FakeDownloadService({ tickMs: 0, scenario: 'states' });
    const statuses = new Set(s.areas().map((a) => a.status));
    expect([...statuses].sort()).toEqual(['complete', 'downloading', 'failed', 'paused', 'queued', 'waiting']);
    const errors = new Set(s.areas().map((a) => a.error).filter(Boolean));
    expect(errors.size).toBe(5);
    expect(s.areas().some((a) => a.record.name === '' && a.record.layers.length === 0)).toBe(true);
  });

  it('reads its options from the page address', () => {
    expect(fakeOptionsFrom('?maskOwners')).toBeNull();
    expect(fakeOptionsFrom('?fakeDownloads=states&fakeNet=metered&fakeFree=20')).toMatchObject({
      scenario: 'states',
      network: { online: true, metered: true },
      freeBytes: 20 * MB,
    });
  });
});
