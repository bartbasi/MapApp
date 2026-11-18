<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  What the downloads panel puts on the map. Never touched: every touch goes
  through to the map.

  Picking an area: a frame that stays still in the part of the map that
  shows, with the ground outside it dimmed. The user moves the map under it.
  The frame tells the picker which rectangle on the ground it holds. A fold or
  unfold keeps the same ground in the frame. The frame stays still on the
  screen while the map moves, so it is drawn here and not as a map layer (a
  map layer would trail the finger during a drag). It leaves a clear circle
  around the phone's position marker and its accuracy circle, so it never
  covers them (D26).

  The list: the outline of every download, the one looked at drawn heavier
  and named. These are a map layer (map/style/download-areas.ts) under the
  position marker; this component only hands the map their features.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import type { AreaView, DownloadService } from '../../downloads/contract';
  import type { Bounds } from '../../map/tile-math';
  import type { DownloadsUi } from './downloads-ui.svelte';
  import { boundsOfPoints, circleMeetsRect, frameCorners, frameRect, markerHole, metersPerPixel, roundBounds, sameBounds, type ScreenRect } from './frame';
  import { NO_OUTLINES, outlineFeatures } from './outline-features';

  interface Props {
    map: MapLibreMap;
    ui: DownloadsUi;
    service: DownloadService;
    /** The downloads panel is open. */
    active: boolean;
    /** The phone's position, when it is shown on the map. */
    marker: { lng: number; lat: number; accuracyM: number } | null;
    /** Hands the map the outlines to draw in its download-areas layer. */
    setOutlines: (features: FeatureCollection) => void;
  }

  let { map, ui, service, active, marker, setOutlines }: Props = $props();

  let areas = $state.raw<readonly AreaView[]>([]);
  $effect(() => {
    areas = service.areas();
    return service.onAreas((a) => (areas = a));
  });

  let root = $state<HTMLElement | null>(null);
  let width = $state(0);
  let height = $state(0);
  let frame = $state.raw<ScreenRect | null>(null);
  /** The clear circle around the position marker, in screen pixels. */
  let hole = $state.raw<{ x: number; y: number; r: number } | null>(null);

  const picking = $derived(active && ui.mode === 'pick');
  const listing = $derived(active && ui.mode === 'list');

  // ---------------------------------------------------------------- what covers the map

  /** How much of the map's top and bottom is under controls or the panel. */
  function covered(): { top: number; bottom: number; left: number; right: number } {
    const box = root?.getBoundingClientRect();
    if (!box) return { top: 0, bottom: 0, left: 0, right: 0 };
    // Below the base view switch and the round buttons, which sit in one row at the top.
    let top = 0;
    for (const sel of ['.map-area .top-left', '.map-area .top-right']) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && el.offsetHeight > 0) top = Math.max(top, el.getBoundingClientRect().bottom - box.top);
    }
    let bottom = 0;
    const narrow = window.matchMedia('(max-width: 599px)').matches;
    const sheet = document.querySelector<HTMLElement>('aside.panel');
    if (narrow && sheet) bottom = Math.max(bottom, box.bottom - sheet.getBoundingClientRect().top);
    const controls = document.querySelector<HTMLElement>('.map-area .bottom');
    if (controls) {
      const c = controls.getBoundingClientRect();
      if (c.height > 0 && c.left < box.left + box.width / 2 && c.right > box.left + box.width / 2) bottom = Math.max(bottom, box.bottom - c.top);
    }
    return { top: Math.max(0, top), bottom: Math.max(0, bottom), left: 0, right: 0 };
  }

  function measure() {
    if (!root) return;
    width = root.clientWidth;
    height = root.clientHeight;
    frame = picking ? frameRect(width, height, covered()) : null;
    redraw();
  }

  // ---------------------------------------------------------------- map to screen and back

  let raf = 0;
  function redraw() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (picking && frame) {
        ui.frameCenter = { x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2 };
      }
      if (picking && frame && !ui.naming) {
        const corners = frameCorners(frame).map(([x, y]) => map.unproject([x, y]));
        const b = boundsOfPoints(corners);
        const next = b ? roundBounds(b) : null;
        if (!sameBounds(next, ui.pickBounds)) ui.pickBounds = next;
      }
      if (picking && frame) {
        const m = marker;
        hole = m ? markerHole(map.project([m.lng, m.lat]), m.accuracyM / metersPerPixel(m.lat, map.getZoom())) : null;
      } else {
        hole = null;
      }
    });
  }

  $effect(() => {
    const m = map;
    const onMove = () => redraw();
    m.on('move', onMove);
    m.on('resize', onMove);
    return () => {
      m.off('move', onMove);
      m.off('resize', onMove);
    };
  });
  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
    setOutlines(NO_OUTLINES);
  });

  // A new fix moves the clear circle; the end of naming takes the frame's ground again.
  $effect(() => {
    void marker;
    void ui.naming;
    redraw();
  });

  // The outlines, handed to the map while the list shows, and taken away after.
  $effect(() => {
    setOutlines(listing ? outlineFeatures(areas, ui.shown) : NO_OUTLINES);
  });

  // ---------------------------------------------------------------- watching sizes

  // The map's own size (a fold, an unfold, the panel opening beside it), and
  // the panel and controls that cover it.
  $effect(() => {
    if (!active || !root) return;
    let lastW = root.clientWidth;
    let lastH = root.clientHeight;
    const observer = new ResizeObserver(() => {
      if (!root) return;
      const w = root.clientWidth;
      const h = root.clientHeight;
      const resized = w !== lastW || h !== lastH;
      lastW = w;
      lastH = h;
      // A fold or unfold keeps the ground; the keyboard coming up for the name does not move the map at all.
      const keep = picking && resized && !ui.naming ? ui.pickBounds : null;
      measure();
      if (keep && frame) keepGround(keep, frame);
    });
    observer.observe(root);
    const watched = ['aside.panel', '.map-area .bottom', '.map-area .top-left', '.map-area .top-right'].map((s) => document.querySelector(s));
    for (const el of watched) if (el) observer.observe(el);
    measure();
    return () => observer.disconnect();
  });

  // Entering or leaving the picker redraws.
  $effect(() => {
    void picking;
    measure();
  });

  // Entering the picker: north up, so the frame and the ground rectangle match.
  let wasPicking = false;
  $effect(() => {
    if (picking && !wasPicking && Math.abs(map.getBearing()) > 0.5) map.easeTo({ bearing: 0, pitch: 0, duration: 300 });
    wasPicking = picking;
  });

  /**
   * After a fold or unfold, moves the map so the new frame holds the same
   * middle and the same amount of ground as before. The frame's shape
   * changes, so its edges cannot all stay; keeping the amount of ground (and
   * not the whole old rectangle) means folding and unfolding again does not
   * make the area grow each time.
   */
  function keepGround(b: Bounds, f: ScreenRect) {
    map.resize();
    const a = map.project([b[0], b[3]]);
    const c = map.project([b[2], b[1]]);
    const oldArea = Math.abs(c.x - a.x) * Math.abs(c.y - a.y);
    const newArea = (f.right - f.left) * (f.bottom - f.top);
    if (!(oldArea > 0) || !(newArea > 0)) return;
    const zoom = map.getZoom() + 0.5 * Math.log2(newArea / oldArea);
    map.jumpTo({ center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], zoom });
    // The frame's middle is not always the map's middle (a sheet covers the bottom).
    map.panBy([width / 2 - (f.left + f.right) / 2, height / 2 - (f.top + f.bottom) / 2], { duration: 0 });
  }

  /** The frame's words, kept off the marker: at the top of the frame, or at its foot when the marker is there. */
  const tagAtFoot = $derived(!!(frame && hole && circleMeetsRect(hole, { left: frame.left, top: frame.top, right: frame.right, bottom: frame.top + 48 })));
</script>

<div class="overlay" bind:this={root} aria-hidden={!picking}>
  {#if picking && frame}
    <!-- The dimmed ground outside the frame, the frame's double line and its corners, with a clear circle around the phone's position. -->
    <svg class="layer" width={width} height={height}>
      <defs>
        <mask id="frame-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <rect x="0" y="0" width={width} height={height} fill="#fff" />
          {#if hole}<circle cx={hole.x} cy={hole.y} r={hole.r} fill="#000" />{/if}
        </mask>
      </defs>
      <g mask="url(#frame-mask)">
        <path class="dim" fill-rule="evenodd" d={`M0,0H${width}V${height}H0Z M${frame.left},${frame.top}V${frame.bottom}H${frame.right}V${frame.top}Z`} />
        <rect class="edge-halo" x={frame.left} y={frame.top} width={frame.right - frame.left} height={frame.bottom - frame.top} />
        <rect class="edge" x={frame.left} y={frame.top} width={frame.right - frame.left} height={frame.bottom - frame.top} />
        {#each frameCorners(frame) as [x, y], i (i)}
          {@const dx = i === 0 || i === 3 ? 1 : -1}
          {@const dy = i < 2 ? 1 : -1}
          <path class="corner-halo" d={`M${x},${y + dy * 26}V${y}H${x + dx * 26}`} />
          <path class="corner" d={`M${x},${y + dy * 26}V${y}H${x + dx * 26}`} />
        {/each}
      </g>
    </svg>
    <p class="tag" style:left={`${frame.left + 8}px`} style:top={tagAtFoot ? `${frame.bottom - 44}px` : `${frame.top + 8}px`} style:max-width={`${Math.max(120, frame.right - frame.left - 16)}px`}>
      Move the map to frame your area
    </p>
  {/if}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    overflow: hidden;
  }

  .layer {
    position: absolute;
    inset: 0;
    display: block;
  }

  .dim {
    fill: rgba(20, 19, 15, 0.42);
  }

  /* Every line is dark on a white halo, so it reads on the light map and on dark imagery alike. */
  .edge-halo,
  .corner-halo {
    fill: none;
    stroke: #ffffff;
    stroke-linejoin: round;
  }

  .edge-halo {
    stroke-width: 7;
  }

  .edge {
    fill: none;
    stroke: #14130f;
    stroke-width: 3;
  }

  .corner-halo {
    stroke-width: 13;
    stroke-linecap: round;
  }

  .corner {
    fill: none;
    stroke: #14130f;
    stroke-width: 7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tag {
    position: absolute;
    margin: 0;
    padding: 6px 10px;
    border-radius: 8px;
    background: #14130f;
    color: #ffffff;
    font-weight: 700;
    font-size: 0.95rem;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: var(--shadow);
  }
</style>
