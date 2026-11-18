// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The map itself: one MapLibre map in a container element, drawn from the
// installed archives through the mapapp:// tile protocol. No Svelte here, so
// this can be reused by any screen or platform.

import type { FeatureCollection, Point } from 'geojson';
import {
  AttributionControl,
  Map as MapLibreMap,
  ScaleControl,
  addProtocol,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLat,
  type LngLatBoundsLike,
  type RasterTileSource,
  type VectorTileSource,
} from 'maplibre-gl';
// MapLibre GL JS 6 loads its worker from a file next to its own module. The
// bundler moves that module, so the worker is bundled as its own file and its
// address is passed in (see docs/research/engine-and-hosting-checks.md).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { InstalledLayers } from './installed';
import { PUBLIC_LAND_LAYER, readPublicLandSite, type PublicLandSite } from './public-land';
import { publicLandLabelPoints, type LabelSource } from './public-land-labels';
import { revealOffset } from './reveal';
import { DOUBLE_TAP_MS, TAP_REACH_STEPS_PX, isSecondTap, type Tap } from './taps';
import { buildStyle, type LIVE_SOURCES, type StyleOptions } from './style/build-style';
import { styleImage } from './style/images';
import { DOWNLOAD_AREAS_SOURCE } from './style/download-areas';
import { PARCEL_RELATION_SOURCE, PARCEL_SELECTED_SOURCE } from './style/parcels';
import { POSITION_SOURCE } from './style/position';
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

/** A single tap on the map, known to be a single tap (not the first of a double tap). */
export interface MapTap {
  /** The public land site under the finger, or null. */
  site: PublicLandSite | null;
  at: LngLat;
  /** The map's zoom when the finger met it. */
  zoom: number;
}

export interface MapViewEvents {
  /** A single tap on the map. Parcels are looked up by the caller, through the parcel source. */
  onMapTap?: (tap: MapTap) => void;
  onBearingChange?: (bearing: number) => void;
  /** The user started moving the map by hand: a drag, pinch, rotate, wheel or key. */
  onUserMove?: () => void;
}

export const MAX_ZOOM = 20;

export type LiveSource = (typeof LIVE_SOURCES)[number];

/** How long a recenter on the phone takes. A fix comes about once a second, so the glide nearly meets the next one. */
const FOLLOW_EASE_MS = 900;
const LOCATE_EASE_MS = 1200;

export class MapView {
  readonly map: MapLibreMap;
  private options: StyleOptions;
  private lastStyleKey: string;
  private labels: FeatureCollection<Point> | null = null;
  private labelsKey = '';
  private readonly resizeObserver: ResizeObserver;
  private tapTimer: number | undefined;
  private lastTap: Tap | null = null;
  /** The data of each source updated in place (the marker, the tapped parcel, the relation), and a key to skip repeats. */
  private readonly live = new Map<LiveSource, { data: FeatureCollection; key: string }>();
  /** The zoom a locate glide is heading for, until the map gets there or the user moves it. */
  private followZoom: number | null = null;
  private readonly onWindowResize = () => this.map.resize();

  constructor(container: HTMLElement, options: StyleOptions, events: MapViewEvents = {}) {
    this.options = options;
    const bounds = dataBounds(options.installed);
    const style = buildStyle(this.withLabels(options));
    this.lastStyleKey = this.styleKey(options);
    this.map = new MapLibreMap({
      container,
      style,
      ...(bounds ? { bounds: bounds as LngLatBoundsLike, fitBoundsOptions: { padding: 24 } } : { center: [-89.2, 40], zoom: 6 }),
      // A few meters fill the screen at zoom 20 (D27). Layers whose data stops
      // sooner are drawn larger from their last zoom (overzoom).
      maxZoom: MAX_ZOOM,
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
    // A move the user makes carries the input event that caused it; a move
    // the app makes (follow, reveal, reset north) does not.
    // A drag that interrupts a glide may not start a new move, so the
    // gesture events are watched as well.
    const byUser = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      this.followZoom = null;
      events.onUserMove?.();
    };
    // Once a glide reaches the target zoom, later glides leave the zoom alone.
    this.map.on('moveend', () => {
      if (this.followZoom !== null && Math.abs(this.map.getZoom() - this.followZoom) < 0.01) this.followZoom = null;
    });
    for (const name of ['movestart', 'dragstart', 'zoomstart', 'rotatestart', 'pitchstart'] as const) this.map.on(name, byUser);
    this.map.on('click', (e) => {
      if (!events.onMapTap) return;
      const tap: Tap = { time: performance.now(), x: e.point.x, y: e.point.y };
      const second = isSecondTap(this.lastTap, tap);
      this.lastTap = tap;
      window.clearTimeout(this.tapTimer);
      // A double tap zooms the map and is not a tap on a site.
      if (second) return;
      // Find the site now, while the map is where the finger met it. Then wait
      // a moment to see that this tap is not the first of a double tap.
      const hit = this.publicLandAt(tap.x, tap.y);
      const zoom = this.map.getZoom();
      this.tapTimer = window.setTimeout(() => {
        events.onMapTap?.({ site: hit ? readPublicLandSite(hit) : null, at: e.lngLat, zoom });
      }, DOUBLE_TAP_MS);
    });
    this.map.on('dblclick', () => window.clearTimeout(this.tapTimer));
    // On a touch screen the engine swallows the second tap of a double tap, so
    // no second click and no dblclick arrives here. The zoom it starts does.
    // Any zoom that starts while a tap is waiting means the tap was not a
    // plain tap on a site.
    this.map.on('zoomstart', () => window.clearTimeout(this.tapTimer));

    // The style's hatch and shield images are drawn in code (style/images.ts)
    // and added the first time a layer asks for one.
    this.map.setMissingStyleImageResolver((id) => {
      if (this.map.hasImage(id)) return;
      const img = styleImage(id, window.devicePixelRatio || 1);
      if (img) this.map.addImage(id, img.data, img.options);
    });

    // Once tiles have loaded and the map is still, place one name per site.
    this.map.on('idle', () => this.refreshPublicLandLabels());
  }

  /**
   * The public land site at a screen point: the one under the point, or else
   * one within a fingertip of it, so a thin strip of land can still be tapped.
   */
  private publicLandAt(x: number, y: number): Record<string, unknown> | null {
    if (!this.map.getLayer(PUBLIC_LAND_FILL)) return null;
    const own = (f: { sourceLayer?: string }) => f.sourceLayer === PUBLIC_LAND_LAYER;
    const exact = this.map.queryRenderedFeatures([x, y], { layers: [PUBLIC_LAND_FILL] }).find(own);
    if (exact) return exact.properties as Record<string, unknown>;
    // Widen the search in steps, so the nearest site wins over one further off.
    for (const r of TAP_REACH_STEPS_PX) {
      const near = this.map
        .queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers: [PUBLIC_LAND_FILL] })
        .find(own);
      if (near) return near.properties as Record<string, unknown>;
    }
    return null;
  }

  private withLabels(options: StyleOptions): StyleOptions {
    return {
      ...options,
      publicLandLabels: this.labels,
      position: this.live.get(POSITION_SOURCE)?.data ?? null,
      parcelSelected: this.live.get(PARCEL_SELECTED_SOURCE)?.data ?? null,
      parcelRelation: this.live.get(PARCEL_RELATION_SOURCE)?.data ?? null,
      downloadAreas: this.live.get(DOWNLOAD_AREAS_SOURCE)?.data ?? null,
    };
  }

  /** The style options without the in-place data, for telling whether a rebuild is needed. */
  private styleKey(options: StyleOptions): string {
    return JSON.stringify(buildStyle({ ...this.withLabels(options), position: null, parcelSelected: null, parcelRelation: null, downloadAreas: null }));
  }

  /**
   * Puts data straight into one of the in-place sources, with no style
   * rebuild. It is kept so a later style change carries it over.
   */
  setLiveData(id: LiveSource, data: FeatureCollection): void {
    const key = JSON.stringify(data);
    if (this.live.get(id)?.key === key) return;
    this.live.set(id, { data, key });
    const source = this.map.getSource<GeoJSONSource>(id);
    if (source) source.setData(data);
  }

  /** Shows the phone's position marker (position/marker.ts), or none. */
  setPosition(data: FeatureCollection): void {
    this.setLiveData(POSITION_SOURCE, data);
  }

  /**
   * Glides the map to a point, keeping the zoom unless minZoom asks for
   * closer. With a sheet over the bottom of the map, the point goes to the
   * middle of the part still showing.
   */
  centerOn(lng: number, lat: number, minZoom: number | null = null, coveredBottom = 0): void {
    if (minZoom !== null) this.followZoom = Math.max(this.map.getZoom(), minZoom);
    // The next fix comes before a zoom glide ends and starts a new glide. It
    // carries the same target zoom, so the zoom is not left halfway.
    const zoom = this.followZoom ?? undefined;
    this.map.easeTo({
      center: [lng, lat],
      offset: [0, -coveredBottom / 2],
      ...(zoom !== undefined ? { zoom } : {}),
      duration: minZoom !== null ? LOCATE_EASE_MS : FOLLOW_EASE_MS,
      easing: (t) => t * (2 - t),
    });
  }

  /** Recomputes the public land label points from the loaded tiles. */
  private refreshPublicLandLabels(): void {
    if (!this.map.getSource(PUBLIC_LAND_LAYER) || this.map.getZoom() < PUBLIC_LAND_LABEL_MINZOOM) return;
    const features = this.map.querySourceFeatures(PUBLIC_LAND_LAYER, { sourceLayer: PUBLIC_LAND_LAYER }) as unknown as LabelSource[];
    // Keep names a little in from the edge of the screen.
    const bounds = this.map.getBounds();
    const padX = (bounds.getEast() - bounds.getWest()) * 0.08;
    const padY = (bounds.getNorth() - bounds.getSouth()) * 0.08;
    const labels = publicLandLabelPoints(features, [
      bounds.getWest() + padX,
      bounds.getSouth() + padY,
      bounds.getEast() - padX,
      bounds.getNorth() - padY,
    ]);
    const key = JSON.stringify(labels);
    if (key === this.labelsKey) return;
    this.labelsKey = key;
    this.labels = labels;
    this.update(this.options);
  }

  /**
   * Moves the map, if needed, so a point shows: clear of a bottom sheet of this
   * height, and not off the side or at the very edge of the map.
   */
  reveal(at: LngLat, coveredBottom: number): void {
    // A panel beside the map has just changed the map's width. Take the new size now.
    this.map.resize();
    const p = this.map.project(at);
    const box = this.map.getContainer();
    const dx = revealOffset(p.x, box.clientWidth, 0);
    const dy = revealOffset(p.y, box.clientHeight, coveredBottom);
    if (dx !== 0 || dy !== 0) this.map.panBy([dx, dy], { duration: 300 });
  }

  /** Applies a new base view, overlay set or selection. The camera is kept. */
  update(options: StyleOptions): void {
    this.options = options;
    // The key leaves out the in-place sources (the position changes every
    // second), which setLiveData() updates without a rebuild.
    const key = this.styleKey(options);
    if (key === this.lastStyleKey) return;
    this.lastStyleKey = key;
    this.map.setStyle(buildStyle(this.withLabels(options)), { diff: true });
  }

  /**
   * Drops the tiles the map holds for every archive source and fetches them
   * again, keeping the camera. Call it after the installed archives changed
   * (data-session.ts reloadDataSession): a source whose address did not
   * change would otherwise keep the empty tiles it got before an area was
   * downloaded, or the tiles of an area that was removed.
   */
  reloadTiles(): void {
    const sources = this.map.getStyle()?.sources ?? {};
    for (const [id, spec] of Object.entries(sources)) {
      if ((spec.type === 'vector' || spec.type === 'raster') && spec.tiles) {
        this.map.getSource<VectorTileSource | RasterTileSource>(id)?.setTiles(spec.tiles);
      }
    }
  }

  get styleOptions(): StyleOptions {
    return this.options;
  }

  resetNorth(): void {
    this.map.easeTo({ bearing: 0, pitch: 0, duration: 300 });
  }

  destroy(): void {
    window.clearTimeout(this.tapTimer);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    window.visualViewport?.removeEventListener('resize', this.onWindowResize);
    this.map.remove();
  }
}
