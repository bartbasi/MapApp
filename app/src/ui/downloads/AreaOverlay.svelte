<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  Drawn over the map while the downloads panel is open, and never touched:
  every touch goes through to the map.

  Picking an area: a frame that stays still in the part of the map that
  shows, with the ground outside it dimmed. The user moves the map under it.
  The frame tells the picker which rectangle on the ground it holds. A fold or
  unfold keeps the same ground in the frame.

  The list: the outline of every download, the one looked at drawn heavier
  and named.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import type { AreaView, DownloadService } from '../../downloads/contract';
  import type { Bounds } from '../../map/tile-math';
  import type { DownloadsUi } from './downloads-ui.svelte';
  import { isDamagedRecord } from './text';
  import { boundsOfPoints, frameCorners, frameRect, roundBounds, sameBounds, type ScreenRect } from './frame';

  interface Props {
    map: MapLibreMap;
    ui: DownloadsUi;
    service: DownloadService;
    /** The downloads panel is open. */
    active: boolean;
  }

  let { map, ui, service, active }: Props = $props();

  let areas = $state.raw<readonly AreaView[]>([]);
  $effect(() => {
    areas = service.areas();
    return service.onAreas((a) => (areas = a));
  });

  let root = $state<HTMLElement | null>(null);
  let width = $state(0);
  let height = $state(0);
  let frame = $state.raw<ScreenRect | null>(null);
  /** Screen corners of each outline, recomputed as the map moves. */
  let outlines = $state.raw<{ id: string; name: string; points: [number, number][] }[]>([]);

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
    const c = covered();
    topClear = c.top;
    frame = picking ? frameRect(width, height, c) : null;
    redraw();
  }

  // ---------------------------------------------------------------- map to screen and back

  let raf = 0;
  function redraw() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (picking && frame) {
        const corners = frameCorners(frame).map(([x, y]) => map.unproject([x, y]));
        const b = boundsOfPoints(corners);
        const next = b ? roundBounds(b) : null;
        if (!sameBounds(next, ui.pickBounds)) ui.pickBounds = next;
      }
      outlines = listing
        ? areas.filter((a) => !isDamagedRecord(a.record)).map((a) => ({ id: a.record.id, name: a.record.name, points: project(a.record.bounds) }))
        : [];
    });
  }

  function project(b: Bounds): [number, number][] {
    const corners: [number, number][] = [
      [b[0], b[3]],
      [b[2], b[3]],
      [b[2], b[1]],
      [b[0], b[1]],
    ];
    return corners.map((c) => {
      const p = map.project(c);
      return [p.x, p.y];
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
      const keep = picking && resized ? ui.pickBounds : null;
      measure();
      if (keep && frame) keepGround(keep, frame);
    });
    observer.observe(root);
    const watched = ['aside.panel', '.map-area .bottom', '.map-area .top-left', '.map-area .top-right'].map((s) => document.querySelector(s));
    for (const el of watched) if (el) observer.observe(el);
    measure();
    return () => observer.disconnect();
  });

  // Entering or leaving the picker, and the list changing, redraw.
  $effect(() => {
    void picking;
    void listing;
    void areas;
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

  const shownOutline = $derived(outlines.find((o) => o.id === ui.shown) ?? null);
  /** Where the shown download's name sits: just inside its top left corner, below the top controls, kept on the screen. */
  let topClear = $state(0);
  const label = $derived.by(() => {
    if (!shownOutline) return null;
    const xs = shownOutline.points.map((p) => p[0]);
    const ys = shownOutline.points.map((p) => p[1]);
    const x = Math.min(Math.max(Math.min(...xs) + 10, 8), Math.max(8, width - 160));
    const y = Math.min(Math.max(Math.min(...ys) + 10, topClear + 8), Math.max(8, height - 40));
    return { x, y };
  });

  const path = (pts: [number, number][]) => `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`;
</script>

<div class="overlay" bind:this={root} aria-hidden={!picking}>
  {#if picking && frame}
    <!-- The dimmed ground outside the frame, the frame's double line, and its corners. -->
    <svg class="layer" width={width} height={height}>
      <path class="dim" fill-rule="evenodd" d={`M0,0H${width}V${height}H0Z M${frame.left},${frame.top}V${frame.bottom}H${frame.right}V${frame.top}Z`} />
      <rect class="edge-halo" x={frame.left} y={frame.top} width={frame.right - frame.left} height={frame.bottom - frame.top} />
      <rect class="edge" x={frame.left} y={frame.top} width={frame.right - frame.left} height={frame.bottom - frame.top} />
      {#each frameCorners(frame) as [x, y], i (i)}
        {@const dx = i === 0 || i === 3 ? 1 : -1}
        {@const dy = i < 2 ? 1 : -1}
        <path class="corner-halo" d={`M${x},${y + dy * 26}V${y}H${x + dx * 26}`} />
        <path class="corner" d={`M${x},${y + dy * 26}V${y}H${x + dx * 26}`} />
      {/each}
    </svg>
    <p class="tag" style:left={`${frame.left + 8}px`} style:top={`${frame.top + 8}px`} style:max-width={`${Math.max(120, frame.right - frame.left - 16)}px`}>Move the map to frame your area</p>
  {:else if listing && outlines.length}
    <svg class="layer" width={width} height={height}>
      {#each outlines as o (o.id)}
        {#if o.id !== ui.shown}
          <path class="outline-halo" d={path(o.points)} />
          <path class="outline" d={path(o.points)} />
        {/if}
      {/each}
      {#if shownOutline}
        <path class="shown-fill" d={path(shownOutline.points)} />
        <path class="shown-halo" d={path(shownOutline.points)} />
        <path class="shown" d={path(shownOutline.points)} />
      {/if}
    </svg>
    {#if shownOutline && label}
      <p class="tag" style:left={`${label.x}px`} style:top={`${label.y}px`}>{shownOutline.name}</p>
    {/if}
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

  .outline-halo,
  .shown-halo {
    fill: none;
    stroke: #ffffff;
    stroke-linejoin: round;
  }

  .outline-halo {
    stroke-width: 6;
  }

  .outline {
    fill: none;
    stroke: #14130f;
    stroke-width: 2.5;
    stroke-dasharray: 10 6;
  }

  .shown-fill {
    fill: rgba(255, 255, 255, 0.16);
  }

  .shown-halo {
    stroke-width: 10;
  }

  .shown {
    fill: none;
    stroke: #14130f;
    stroke-width: 5;
    stroke-dasharray: 16 8;
  }

  .tag {
    position: absolute;
    margin: 0;
    max-width: 200px;
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
