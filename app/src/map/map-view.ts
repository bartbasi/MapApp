// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The map itself: one MapLibre map in a container element, drawn from the
// installed archives through the mapapp:// tile protocol. No Svelte here, so
// this can be reused by any screen or platform.

import { AttributionControl, Map as MapLibreMap, ScaleControl, addProtocol, setWorkerUrl, type LngLatBoundsLike } from 'maplibre-gl';
// MapLibre GL JS 6 loads its worker from a file next to its own module. The
// bundler moves that module, so the worker is bundled as its own file and its
// address is passed in (see docs/research/engine-and-hosting-checks.md).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { InstalledLayers } from './installed';
import { PUBLIC_LAND_LAYER, readPublicLandSite, type PublicLandSite } from './public-land';
import { buildStyle, type StyleOptions } from './style/build-style';
import { PUBLIC_LAND_FILL } from './style/public-land';
import { TILE_SCHEME, createTileLoader, newTileStats, type TileStats } from './tile-protocol';
import { unionBounds, type Bounds } from './tile-math';
import type { TileResolver } from './tile-resolver';

let protocolRegistered = false;
export const tileStats: TileStats = newTileStats();

/**
 * Registers the mapapp:// tile protocol once for the page. The resolver can be
 * given new archives later (Step 2 downloads) without registering again.
 */
export function registerTileProtocol(resolver: TileResolver): void {
  if (protocolRegistered) return;
  setWorkerUrl(workerUrl);
  addProtocol(TILE_SCHEME, createTileLoader(resolver, tileStats));
  protocolRegistered = true;
}

/** The area to show first: the base map's coverage, or else all installed data. */
export function dataBounds(installed: InstalledLayers): Bounds | null {
  const base = installed.get('basemap');
  if (base) return base.bounds;
  return unionBounds([...installed.values()].map((l) => l.bounds));
}

export interface MapViewEvents {
  onPublicLandTap?: (site: PublicLandSite | null) => void;
  onBearingChange?: (bearing: number) => void;
}

export class MapView {
  readonly map: MapLibreMap;
  private options: StyleOptions;
  private lastStyleKey: string;
  private readonly resizeObserver: ResizeObserver;
  private readonly onWindowResize = () => this.map.resize();

  constructor(container: HTMLElement, options: StyleOptions, events: MapViewEvents = {}) {
    this.options = options;
    const bounds = dataBounds(options.installed);
    const style = buildStyle(options);
    this.lastStyleKey = JSON.stringify(style);
    this.map = new MapLibreMap({
      container,
      style,
      ...(bounds ? { bounds: bounds as LngLatBoundsLike, fitBoundsOptions: { padding: 24 } } : { center: [-89.2, 40], zoom: 6 }),
      maxZoom: 18,
      attributionControl: false,
      // Labels are drawn upright and readable whatever the rotation.
      pitchWithRotate: false,
    });
    this.map.addControl(new AttributionControl({ compact: false }), 'bottom-right');
    this.map.addControl(new ScaleControl({ unit: 'imperial', maxWidth: 110 }), 'bottom-left');

    // A fold or unfold, or a side panel opening, changes the container size.
    this.resizeObserver = new ResizeObserver(() => this.map.resize());
    this.resizeObserver.observe(container);
    window.addEventListener('resize', this.onWindowResize);
    window.visualViewport?.addEventListener('resize', this.onWindowResize);

    this.map.on('rotate', () => events.onBearingChange?.(this.map.getBearing()));
    this.map.on('click', (e) => {
      if (!events.onPublicLandTap) return;
      if (!this.map.getLayer(PUBLIC_LAND_FILL)) return events.onPublicLandTap(null);
      const hits = this.map.queryRenderedFeatures(e.point, { layers: [PUBLIC_LAND_FILL] });
      const hit = hits.find((f) => f.sourceLayer === PUBLIC_LAND_LAYER);
      events.onPublicLandTap(hit ? readPublicLandSite(hit.properties as Record<string, unknown>) : null);
    });
  }

  /** Applies a new base view, overlay set or selection. The camera is kept. */
  update(options: StyleOptions): void {
    this.options = options;
    const style = buildStyle(options);
    const key = JSON.stringify(style);
    if (key === this.lastStyleKey) return;
    this.lastStyleKey = key;
    this.map.setStyle(style, { diff: true });
  }

  get styleOptions(): StyleOptions {
    return this.options;
  }

  resetNorth(): void {
    this.map.easeTo({ bearing: 0, pitch: 0, duration: 300 });
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    window.visualViewport?.removeEventListener('resize', this.onWindowResize);
    this.map.remove();
  }
}
