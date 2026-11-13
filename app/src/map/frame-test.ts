// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The frame test: a fixed 15 second camera tour (pan, zoom, rotate) inside the
// installed data's bounds, while every frame's time is recorded. Afterwards it
// measures how long the map takes to finish drawing tiles once the camera
// stops. Run from the diagnostics screen on the phone.

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { InstalledLayers } from './installed';
import type { Bounds } from './tile-math';

/**
 * Where the tour runs: inside one archive's own bounds (the first base map
 * archive, else the first archive of any layer), from its metadata. Not the
 * box around all counties together: counties need not touch, and the gap
 * between them has no tiles.
 */
export function tourArea(installed: InstalledLayers): { bounds: Bounds; minzoom: number; maxzoom: number } | null {
  const layer = installed.get('basemap') ?? [...installed.values()][0];
  const first = layer?.archives[0];
  if (!first) return null;
  return { bounds: first.meta.bounds, minzoom: first.meta.minzoom, maxzoom: first.meta.maxzoom };
}

export interface TourStop {
  center: [number, number];
  zoom: number;
  bearing: number;
}

export const TOUR_LEG_MS = 2500;

/**
 * A starting point and six legs of 2.5 seconds each, 15 seconds in all. The
 * stops are fixed fractions of the bounds, so the same data always gives the
 * same tour.
 */
export function buildTour(bounds: Bounds, minzoom: number, maxzoom: number): TourStop[] {
  const [w, s, e, n] = bounds;
  const at = (fx: number, fy: number): [number, number] => [w + (e - w) * fx, s + (n - s) * fy];
  const zLow = Math.max(minzoom, 10);
  const zHigh = Math.max(zLow, Math.min(maxzoom + 0.5, 15.5));
  const z = (f: number) => +(zLow + (zHigh - zLow) * f).toFixed(2);
  return [
    { center: at(0.5, 0.5), zoom: z(0.3), bearing: 0 },
    { center: at(0.45, 0.55), zoom: z(0.6), bearing: 0 },
    { center: at(0.55, 0.45), zoom: z(0.8), bearing: 40 },
    { center: at(0.3, 0.7), zoom: z(0.5), bearing: -30 },
    { center: at(0.65, 0.8), zoom: z(1), bearing: 90 },
    { center: at(0.8, 0.25), zoom: z(0), bearing: 0 },
    { center: at(0.5, 0.5), zoom: z(1), bearing: 180 },
  ];
}

export interface FrameTestResult {
  seconds: number;
  frames: number;
  avgFps: number;
  worst1pctFps: number;
  framesOver33ms: number;
  /** Milliseconds from the end of the tour until every tile was drawn. Null if it took over 60 s. */
  settleMs: number | null;
}

/** Turns frame durations (milliseconds) into the reported numbers. */
export function summarizeFrames(durations: readonly number[], settleMs: number | null): FrameTestResult {
  const total = durations.reduce((a, b) => a + b, 0);
  const sorted = [...durations].sort((a, b) => a - b);
  const p99 = sorted.length ? (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 0) : 0;
  return {
    seconds: +(total / 1000).toFixed(1),
    frames: durations.length,
    avgFps: durations.length && total > 0 ? +(1000 / (total / durations.length)).toFixed(1) : 0,
    worst1pctFps: p99 > 0 ? +(1000 / p99).toFixed(1) : 0,
    framesOver33ms: durations.filter((d) => d > 33.4).length,
    settleMs: settleMs === null ? null : Math.round(settleMs),
  };
}

function waitForIdle(map: MapLibreMap, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      map.off('idle', onIdle);
      resolve(false);
    }, timeoutMs);
    const onIdle = () => {
      clearTimeout(timer);
      resolve(true);
    };
    map.once('idle', onIdle);
    // If nothing is pending, MapLibre may not fire idle again without a repaint.
    map.triggerRepaint();
  });
}

export async function runFrameTest(map: MapLibreMap, tour: readonly TourStop[]): Promise<FrameTestResult> {
  const first = tour[0];
  if (first) {
    map.jumpTo(first);
    await waitForIdle(map, 30_000);
  }

  const durations: number[] = [];
  let running = true;
  let last = performance.now();
  const tick = (t: number) => {
    durations.push(t - last);
    last = t;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(tick);
  });

  for (const stop of tour.slice(1)) {
    const moved = new Promise<void>((r) => map.once('moveend', () => r()));
    map.easeTo({ ...stop, duration: TOUR_LEG_MS, easing: (x) => x });
    await moved;
  }
  running = false;

  const stopped = performance.now();
  const settled = await waitForIdle(map, 60_000);
  return summarizeFrames(durations, settled ? performance.now() - stopped : null);
}
