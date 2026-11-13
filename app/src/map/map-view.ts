// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The map itself: one MapLibre map in a container element, drawn from the
// installed archives through the mapapp:// tile protocol. No Svelte here, so
// this can be reused by any screen or platform.

import type { FeatureCollection, Point } from 'geojson';
import { AttributionControl, Map as MapLibreMap, ScaleControl, addProtocol, setWorkerUrl, type LngLat, type LngLatBoundsLike } from 'maplibre-gl';
// MapLibre GL JS 6 loads its worker from a file next to its own module. The
// bundler moves that module, so the worker is bundled as its own file and its
// address is passed in (see docs/research/engine-and-hosting-checks.md).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { InstalledLayers } from './installed';
import { PUBLIC_LAND_LAYER, readPublicLandSite, type PublicLandSite } from './public-land';
import { publicLandLabelPoints, type LabelSource } from './public-land-labels';
import { revealOffset } from './reveal';
import { buildStyle, type StyleOptions } from './style/build-style';
import { PUBLIC_LAND_FILL, PUBLIC_LAND_LABEL_MINZOOM } from './style/public-land';
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
  /** A tap on the map: the public land site there (or null), and where the tap was. */
  onPublicLandTap?: (site: PublicLandSite | null, at: LngLat) => void;
  onBearingChange?: (bearing: number) => void;
}

export class MapView {
  readonly map: MapLibreMap;
  private options: StyleOptions;
  private lastStyleKey: string;
  private labels: FeatureCollection<Point> | null = null;
  private labelsKey = '';
  private readonly resizeObserver: ResizeObserver;
  private readonly onWindowResize = () => this.map.resize();

  constructor(container: HTMLElement, options: StyleOptions, events: MapViewEvents = {}) {
    this.options = options;
    const bounds = dataBounds(options.installed);
    const style = buildStyle(this.withLabels(options));
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
      if (!this.map.getLayer(PUBLIC_LAND_FILL)) return events.onPublicLandTap(null, e.lngLat);
      const hits = this.map.queryRenderedFeatures(e.point, { layers: [PUBLIC_LAND_FILL] });
      const hit = hits.find((f) => f.sourceLayer === PUBLIC_LAND_LAYER);
      events.onPublicLandTap(hit ? readPublicLandSite(hit.properties as Record<string, unknown>) : null, e.lngLat);
    });

    // Once tiles have loaded and the map is still, place one name per site.
    this.map.on('idle', () => this.refreshPublicLandLabels());
  }

  private withLabels(options: StyleOptions): StyleOptions {
    return { ...options, publicLandLabels: this.labels };
  }

  /** Recomputes the public land label points from the loaded tiles. */
  private refreshPublicLandLabels(): void {
    if (!this.map.getSource(PUBLIC_LAND_LAYER) || this.map.getZoom() < PUBLIC_LAND_LABEL_MINZOOM) return;
    const features = this.map.querySourceFeatures(PUBLIC_LAND_LAYER, { sourceLayer: PUBLIC_LAND_LAYER }) as unknown as LabelSource[];
    const labels = publicLandLabelPoints(features);
    const key = JSON.stringify(labels);
    if (key === this.labelsKey) return;
    this.labelsKey = key;
    this.labels = labels;
    this.update(this.options);
  }

  /** Moves the map, if needed, so a point hidden under a bottom sheet of this height shows above it. */
  reveal(at: LngLat, coveredBottom: number): void {
    const p = this.map.project(at);
    const dy = revealOffset(p.y, this.map.getContainer().clientHeight, coveredBottom);
    if (dy !== 0) this.map.panBy([0, dy], { duration: 300 });
  }

  /** Applies a new base view, overlay set or selection. The camera is kept. */
  update(options: StyleOptions): void {
    this.options = options;
    const style = buildStyle(this.withLabels(options));
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
