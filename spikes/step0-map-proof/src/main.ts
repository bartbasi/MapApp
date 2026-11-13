// Throwaway Step 0 test. Not product code.
// Question it answers: can MapLibre GL JS, inside the Android WebView that
// Capacitor hosts, draw a 2D map from a PMTiles archive stored on the device,
// with no network, at a usable frame rate?

import { Map as MapLibreMap, addProtocol, setWorkerUrl } from 'maplibre-gl';
// MapLibre GL JS 6 loads its worker from a file next to its own module. A
// bundler moves that module, so the worker is bundled as its own entry and
// its URL is passed in.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Capacitor } from '@capacitor/core';
import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';

const ARCHIVE = 'champaign_z15.pmtiles';

// Reads byte ranges of an archive in app storage through the native shell.
// The range travels in the URL, not in a Range header: Android WebView applies
// a Range header by itself to whatever stream the app returns (and sizes that
// stream with an int), so header ranges fail past the first block and past
// 2 GB. A plain request for "offset o, n bytes" has neither problem.
class DeviceFileSource implements Source {
  constructor(private readonly name: string) {}
  getKey() {
    return `device/${this.name}`;
  }
  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    const r = await fetch(`/_tiles/${this.name}?o=${offset}&n=${length}`, { signal });
    if (!r.ok) throw new Error(`archive read failed: ${r.status}`);
    return { data: await r.arrayBuffer() };
  }
}

const native = Capacitor.isNativePlatform();
// In a desktop or phone browser the same archive is read with ordinary HTTP
// range requests from the web server.
const archiveUrl = native ? `device/${ARCHIVE}` : `${location.origin}/_tiles/${ARCHIVE}`;

const panel = document.getElementById('panel')!;
const state = {
  archive: archiveUrl,
  online: navigator.onLine,
  tileRequests: 0,
  tileErrors: 0,
  lastError: '',
  loaded: false,
  fps: '' as string,
};

function render() {
  panel.textContent = [
    `archive  ${ARCHIVE} (${native ? 'device storage' : 'web server'})`,
    `network  ${navigator.onLine ? 'online' : 'OFFLINE'}`,
    `tiles    ${state.tileRequests} requested, ${state.tileErrors} failed`,
    `map      ${state.loaded ? 'loaded' : 'loading'}  zoom ${map ? map.getZoom().toFixed(1) : '-'}`,
    state.fps ? `frames   ${state.fps}` : 'frames   not measured yet',
    state.lastError ? `error    ${state.lastError}` : '',
  ].filter(Boolean).join('\n');
}

setWorkerUrl(workerUrl);
const protocol = new Protocol();
if (native) protocol.add(new PMTiles(new DeviceFileSource(ARCHIVE)));
addProtocol('pmtiles', async (params, abort) => {
  state.tileRequests++;
  try {
    return await protocol.tile(params, abort);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      state.tileErrors++;
      state.lastError = String(e);
    }
    throw e;
  } finally {
    render();
  }
});

const map = new MapLibreMap({
  container: 'map',
  center: [-88.2434, 40.1164],
  zoom: 11,
  maxZoom: 18,
  attributionControl: { compact: true },
  style: {
    version: 8,
    glyphs: `${location.origin}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${location.origin}/sprites/light`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${archiveUrl}`,
        attribution: '© OpenStreetMap',
      },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
  },
});

map.on('error', (e) => {
  state.lastError = String(e.error?.message ?? e.error ?? e);
  render();
});
map.on('load', () => {
  state.loaded = true;
  render();
  console.log('PROOF_LOADED ' + JSON.stringify(state));
});
map.on('moveend', render);
// A fold or unfold changes the viewport without always repainting the map.
window.addEventListener('resize', () => map.resize());
window.visualViewport?.addEventListener('resize', () => map.resize());
window.addEventListener('online', render);
window.addEventListener('offline', render);

// Frame test: a fixed camera tour (pan, zoom, rotate) while counting frames.
async function frameTest() {
  const stops: Array<{ center: [number, number]; zoom: number; bearing: number }> = [
    { center: [-88.2434, 40.1164], zoom: 12, bearing: 0 },
    { center: [-88.2072, 40.1106], zoom: 14.5, bearing: 40 },
    { center: [-88.3625, 40.2031], zoom: 13, bearing: -30 },
    { center: [-88.1570, 40.3090], zoom: 15, bearing: 90 },
    { center: [-88.0290, 40.0470], zoom: 11, bearing: 0 },
    { center: [-88.2434, 40.1164], zoom: 15.5, bearing: 180 },
  ];
  const times: number[] = [];
  let running = true;
  let last = performance.now();
  const tick = (t: number) => {
    times.push(t - last);
    last = t;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  for (const s of stops) {
    map.easeTo({ ...s, duration: 2500, easing: (x) => x });
    await new Promise<void>((r) => map.once('moveend', () => r()));
  }
  running = false;
  times.shift();
  const total = times.reduce((a, b) => a + b, 0);
  const sorted = [...times].sort((a, b) => a - b);
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const slow = times.filter((d) => d > 33.4).length;
  const result = {
    seconds: +(total / 1000).toFixed(1),
    frames: times.length,
    avgFps: +(1000 / (total / times.length)).toFixed(1),
    worst1pctFps: +(1000 / p99).toFixed(1),
    framesOver33ms: slow,
    tileErrors: state.tileErrors,
    online: navigator.onLine,
  };
  state.fps = `avg ${result.avgFps} fps, worst 1% ${result.worst1pctFps} fps, ${slow}/${times.length} frames over 33 ms`;
  render();
  console.log('PROOF_RESULT ' + JSON.stringify(result));
  return result;
}

document.getElementById('run')!.addEventListener('click', () => void frameTest());
(window as unknown as Record<string, unknown>).frameTest = frameTest;
render();
