<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  A short card at the top of the map when the map is bare and the user would
  not know why: the Aerial or Hybrid view where no imagery is on the phone,
  or close in where only the overview map is. It says why, and opens the
  downloads (or, for imagery, switches back to the Map view). Where no
  county on offer covers the place, it says that nothing can be downloaded
  there. It sits under the top controls, away from the position readout, and
  it never covers the position marker: where the whole card would, it
  shrinks to a small pill, and where even the pill would, it steps away.
-->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import type { AreaView, DownloadService } from '../../downloads/contract';
  import type { InstalledLayers } from '../../map/installed';
  import Icon from '../Icon.svelte';
  import type { Bounds } from '../../map/tile-math';
  import { detailedAreas, imageryAreas, inviteFor } from './coverage';
  import { cardMode, markerHole, metersPerPixel, type ScreenRect } from './frame';

  interface Props {
    map: MapLibreMap;
    installed: InstalledLayers;
    service: DownloadService;
    /** The base view on screen. */
    view: 'map' | 'aerial' | 'hybrid';
    /** The counties on offer, or null before the list has been fetched. */
    offered: readonly Bounds[] | null;
    /** Kept out of the way, for example while the downloads panel is open. */
    hidden: boolean;
    onOpen: () => void;
    onShowMap: () => void;
    /** The phone's position, when it is shown on the map. */
    marker: { lng: number; lat: number; accuracyM: number } | null;
  }

  let { map, installed, service, view, offered, hidden, onOpen, onShowMap, marker }: Props = $props();

  // ---------------------------------------------------------------- keeping off the marker
  let card = $state<HTMLElement | null>(null);
  let hole = $state.raw<{ x: number; y: number; r: number } | null>(null);
  let fullRect = $state.raw<ScreenRect | null>(null);
  let pillRect = $state.raw<ScreenRect | null>(null);
  function placeHole() {
    const m = marker;
    hole = m ? markerHole(map.project([m.lng, m.lat]), m.accuracyM / metersPerPixel(m.lat, map.getZoom())) : null;
  }
  $effect(() => {
    void marker;
    placeHole();
  });
  $effect(() => {
    const m = map;
    m.on('move', placeHole);
    return () => m.off('move', placeHole);
  });
  const mode = $derived(cardMode(hole, fullRect, pillRect));
  // The card's place on the map, measured each time it is drawn in a shape.
  $effect(() => {
    void mode;
    const el = card;
    if (!el) return;
    const r = { left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight };
    if (mode === 'full') fullRect = r;
    else if (mode === 'pill') pillRect = r;
  });

  let areas = $state.raw<readonly AreaView[]>([]);
  $effect(() => {
    areas = service.areas();
    return service.onAreas((a) => (areas = a));
  });

  let zoom = $state(0);
  let center = $state.raw({ lng: 0, lat: 0 });
  $effect(() => {
    const m = map;
    const onMoveEnd = () => {
      zoom = m.getZoom();
      center = m.getCenter();
    };
    onMoveEnd();
    m.on('moveend', onMoveEnd);
    return () => m.off('moveend', onMoveEnd);
  });

  const invite = $derived(
    hidden ? null : inviteFor({ zoom, center, view, detailed: detailedAreas(installed, areas), imagery: imageryAreas(installed, areas), offered }),
  );
  const show = $derived(invite !== null);

  // Below the base view switch, when it shows.
  let top = $state(0);
  $effect(() => {
    void show;
    const el = document.querySelector<HTMLElement>('.map-area .top-left');
    top = el && el.offsetHeight > 0 ? el.offsetTop + el.offsetHeight + 10 : 0;
  });
</script>

{#if invite && mode === 'pill'}
  <button class="invite pill" bind:this={card} style:--below={`${top}px`} onclick={invite.offered ? onOpen : onShowMap}>
    <Icon name={invite.kind === 'imagery' ? 'aerial' : 'download'} size={22} />
    <span>{invite.kind === 'imagery' ? 'No imagery here' : 'Only a rough map here'}</span>
  </button>
{:else if invite && mode === 'full'}
  <div class="invite" bind:this={card} style:--below={`${top}px`} role="status">
    <Icon name={invite.kind === 'imagery' ? 'aerial' : 'download'} size={28} />
    <div class="text">
      {#if invite.kind === 'imagery'}
        <p class="title">No imagery here on this phone</p>
        {#if invite.offered}
          <p class="body">The Aerial and Hybrid views show only imagery you have downloaded.</p>
          <div class="buttons">
            <button onclick={onOpen}>Download imagery</button>
            <button class="plain" onclick={onShowMap}>Show the map</button>
          </div>
        {:else}
          <p class="body">Imagery is offered for Champaign County and Macon County only.</p>
          <div class="buttons"><button class="plain" onclick={onShowMap}>Show the map</button></div>
        {/if}
      {:else}
        <p class="title">Only a rough map here</p>
        {#if invite.offered}
          <p class="body">Download this place to see it in detail, with or without a signal.</p>
          <div class="buttons"><button onclick={onOpen}>Download maps</button></div>
        {:else}
          <p class="body">Detailed maps are offered for Champaign County and Macon County only.</p>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .invite {
    position: absolute;
    z-index: 5;
    top: max(calc(var(--inset-top) + var(--gap)), var(--below));
    left: calc(var(--inset-left) + var(--gap));
    /* Clear of the column of round buttons on the right. */
    right: calc(var(--inset-right) + var(--gap) + 60px + 10px);
    max-width: 380px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    border-left: 5px solid var(--accent);
  }

  .text {
    flex: 1;
    min-width: 0;
  }

  p {
    margin: 0;
  }

  .title {
    font-weight: 700;
    font-size: 1.05rem;
    line-height: 1.25;
  }

  .body {
    margin-top: 2px;
    font-size: 0.95rem;
    color: var(--text-muted);
  }

  /* The small form: one line, one tap, still 48 px tall. */
  .invite.pill {
    right: auto;
    min-height: 48px;
    margin: 0;
    padding: 0 14px 0 10px;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: var(--text);
    border: 0;
    border-left: 5px solid var(--accent);
    cursor: pointer;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .buttons button {
    white-space: nowrap;
    min-height: 48px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 700;
    cursor: pointer;
  }

  .buttons button:active {
    background: #163a22;
  }

  .pill:active {
    background: var(--surface-alt);
  }

  .buttons button.plain {
    background: var(--surface);
    color: var(--text);
    box-shadow: inset 0 0 0 2px var(--line-strong);
  }

  .buttons button.plain:active {
    background: var(--surface-alt);
  }
</style>
