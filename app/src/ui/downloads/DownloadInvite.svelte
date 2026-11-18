<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  A short card at the top of the map when the user has zoomed in on a place
  that has no detail on this phone: only the overview map is there, so the
  map would be nearly blank. It says why, and opens the downloads.
  It sits under the top controls, away from the position readout.
-->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import type { AreaView, DownloadService } from '../../downloads/contract';
  import type { InstalledLayers } from '../../map/installed';
  import Icon from '../Icon.svelte';
  import { detailedAreas, needsDownload } from './coverage';

  interface Props {
    map: MapLibreMap;
    installed: InstalledLayers;
    service: DownloadService;
    /** Kept out of the way, for example while the downloads panel is open. */
    hidden: boolean;
    onOpen: () => void;
  }

  let { map, installed, service, hidden, onOpen }: Props = $props();

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

  const detailed = $derived(detailedAreas(installed, areas));
  const show = $derived(!hidden && needsDownload(zoom, center, detailed));

  // Below the base view switch, when it shows.
  let top = $state(0);
  $effect(() => {
    void show;
    const el = document.querySelector<HTMLElement>('.map-area .top-left');
    top = el && el.offsetHeight > 0 ? el.offsetTop + el.offsetHeight + 10 : 0;
  });
</script>

{#if show}
  <div class="invite" style:--below={`${top}px`} role="status">
    <Icon name="download" size={28} />
    <div class="text">
      <p class="title">Only a rough map here</p>
      <p class="body">Download this place to see it in detail, with or without a signal.</p>
      <button onclick={onOpen}>Download maps</button>
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

  button {
    margin-top: 10px;
    min-height: 48px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 700;
    cursor: pointer;
  }

  button:active {
    background: #163a22;
  }
</style>
