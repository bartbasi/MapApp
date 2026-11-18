<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The downloads panel: what is on this phone, a whole county in one tap, and
  the way into picking an area. Works against any DownloadService.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { AreaRequest, AreaView, DownloadService, NetworkState } from '../../downloads/contract';
  import type { Bounds } from '../../map/tile-math';
  import AreaPicker from './AreaPicker.svelte';
  import CountyCard from './CountyCard.svelte';
  import DlButton from './DlButton.svelte';
  import DownloadItem from './DownloadItem.svelte';
  import NetworkNote from './NetworkNote.svelte';
  import type { DownloadsUi } from './downloads-ui.svelte';
  import { errorCode } from './estimate-runner';
  import { formatSize, startErrorText, type MainAction } from './text';

  interface Props {
    service: DownloadService;
    ui: DownloadsUi;
    /** Layers on now: overlays switched on, and 'aerial' when the base view uses imagery. */
    layersOn: readonly string[];
    /** Counties whose property lines came with the app. Property lines are never part of a download. */
    linesWith: readonly string[];
    /** Moves the map so this rectangle shows, clear of the panel. */
    onShowArea: (bounds: Bounds) => void;
    onZoom: (direction: 1 | -1) => void;
  }

  let { service, ui, layersOn, linesWith, onShowArea, onZoom }: Props = $props();

  let root = $state<HTMLElement | null>(null);
  let areas = $state.raw<readonly AreaView[]>([]);
  let network = $state.raw<NetworkState>({ online: true, metered: false });
  let freeBytes = $state<number | undefined>(undefined);
  /** Shown only while the list of counties is not in hand. */
  let offersState = $state<'loading' | 'ready' | 'failed'>('loading');

  $effect(() => {
    areas = service.areas();
    return service.onAreas((a) => (areas = a));
  });
  $effect(() => {
    network = service.network();
    return service.onNetwork((n) => (network = n));
  });

  // Free space: read when the panel opens and again when a download starts, ends or is deleted.
  const statusKey = $derived(areas.map((a) => `${a.record.id}:${a.status}`).join(','));
  $effect(() => {
    void statusKey;
    service.freeBytes().then(
      (b) => (freeBytes = b),
      () => (freeBytes = undefined),
    );
  });

  async function loadOffers() {
    offersState = 'loading';
    try {
      ui.offers = await service.offers();
      offersState = 'ready';
    } catch (e) {
      console.warn('the list of counties could not be fetched:', e);
      offersState = 'failed';
    }
  }

  $effect(() => {
    if (!ui.offers) void loadOffers();
  });
  // Coming back online fetches the list the phone could not get before.
  $effect(() => {
    if (network.online && offersState === 'failed') void loadOffers();
  });

  // A new screen starts at its top.
  $effect(() => {
    void ui.mode;
    void tick().then(() => {
      const body = root?.closest('.body');
      if (body) body.scrollTop = 0;
    });
  });

  function show(view: AreaView) {
    ui.shown = view.record.id;
    onShowArea(view.record.bounds);
  }

  function requestOf(view: AreaView): AreaRequest {
    const r = view.record;
    return { where: r.county ? { county: r.county } : { bounds: r.bounds }, layers: [...r.layers], aerialMaxzoom: r.aerialMaxzoom };
  }

  /** A sentence under a download whose last button press failed, by area ID. */
  let notes = $state<Record<string, string>>({});

  async function act(view: AreaView, action: Exclude<MainAction, null>) {
    const { [view.record.id]: _old, ...rest } = notes;
    notes = rest;
    try {
      if (action === 'pause') await service.pause(view.record.id);
      else if (action === 'resume' || action === 'retry') await service.resume(view.record.id);
      else {
        // The data changed or arrived damaged: plan it again from what was asked for.
        const request = requestOf(view);
        await service.remove(view.record.id);
        const id = await service.start(request, view.record.name);
        if (ui.shown === view.record.id) ui.shown = id;
      }
    } catch (e) {
      console.warn(`the download could not ${action}:`, e);
      notes = { ...notes, [view.record.id]: startErrorText(errorCode(e), e as object) };
    }
  }

  async function remove(view: AreaView) {
    if (ui.shown === view.record.id) ui.shown = null;
    try {
      await service.remove(view.record.id);
    } catch (e) {
      console.warn('the download could not be deleted:', e);
    }
  }

  async function startCounty(request: AreaRequest, name: string) {
    const id = await service.start(request, name);
    markStarted();
    ui.shown = id;
  }

  function started(id: string) {
    markStarted();
    ui.shown = id;
    ui.mode = 'list';
  }

  // Android asks for leave to show notifications at the first download. Until
  // a first download has started, a sentence under each Download button says
  // so first. Kept in this browser's storage; if that is gone the sentence
  // shows again, which does no harm.
  const STARTED_KEY = 'mapapp.downloads.started';
  function readStarted(): boolean {
    try {
      return localStorage.getItem(STARTED_KEY) === '1';
    } catch {
      return false;
    }
  }
  let everStarted = $state(readStarted());
  const notifyNote = $derived(!everStarted && areas.length === 0);
  function markStarted() {
    everStarted = true;
    try {
      localStorage.setItem(STARTED_KEY, '1');
    } catch {
      // Storage may be blocked; the sentence then shows again next time.
    }
  }
</script>

<div bind:this={root}>
  {#if ui.mode === 'pick'}
    <AreaPicker {service} {ui} offers={ui.offers ?? []} {areas} {layersOn} {linesWith} {network} {freeBytes} {notifyNote} {onZoom} onStarted={started} />
  {:else}
    <NetworkNote {network} />

    {#if areas.length === 0}
      <p class="intro">Download maps to use them where there is no signal. Your position works anywhere, but the map shows only what is on this phone.</p>
    {:else}
      <h3>On this phone</h3>
      {#each areas as view (view.record.id)}
        <DownloadItem
          {view}
          shown={ui.shown === view.record.id}
          note={notes[view.record.id] ?? ''}
          onShow={() => show(view)}
          onAction={(a) => void act(view, a)}
          onDelete={() => void remove(view)}
        />
      {/each}
      {#if freeBytes !== undefined}
        <p class="muted">{formatSize(freeBytes)} free on this phone.</p>
      {/if}
    {/if}

    <h3>Pick an area</h3>
    <p class="muted lead">The ground around a stand or a farm. You choose how sharp the imagery is.</p>
    <DlButton wide icon="frame" label="Pick an area on the map" onclick={() => (ui.mode = 'pick')} />

    <h3>Whole county</h3>
    {#if offersState === 'loading' && !ui.offers}
      <p class="working"><span class="spinner" aria-hidden="true"></span> Getting the list of counties</p>
    {:else if !ui.offers}
      <p class="problem">
        {network.online ? 'The list of counties could not be fetched.' : 'The list of counties needs a connection the first time. It is kept on the phone after that.'}
      </p>
      {#if network.online}<DlButton icon="retry" label="Try again" onclick={() => void loadOffers()} />{/if}
    {:else}
      {#each ui.offers as offer (offer.county)}
        <CountyCard {offer} {layersOn} {linesWith} {areas} {network} {freeBytes} {notifyNote} onStart={startCounty} />
      {/each}
    {/if}

    <p class="muted legal">Public land and property lines come from public records. They are not a legal survey.</p>
  {/if}
</div>

<style>
  h3 {
    margin: 22px 0 8px;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  div > h3:first-child,
  :global(.note) + h3 {
    margin-top: 4px;
  }

  .intro {
    margin: 0 0 4px;
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 10px 0 0;
  }

  .lead {
    margin: 0 0 10px;
  }

  .legal {
    margin-top: 18px;
  }

  .working {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 6px 0;
    font-weight: 600;
  }

  .problem {
    margin: 6px 0 10px;
  }

  .spinner {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 3px solid var(--line);
    border-top-color: var(--accent);
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
