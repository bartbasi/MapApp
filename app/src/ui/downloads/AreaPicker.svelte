<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The controls for picking an area. The frame itself is on the map
  (AreaOverlay); the user moves the map under it with one finger, and the two
  large buttons here take in more or less ground. The size is worked out once
  the map is still, and shown before the download starts.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { AreaRequest, AreaView, CountyOffer, DownloadService, NetworkState } from '../../downloads/contract';
  import Icon from '../Icon.svelte';
  import DlButton from './DlButton.svelte';
  import type { DownloadsUi } from './downloads-ui.svelte';
  import { EstimateRunner, errorCode, type EstimateState } from './estimate-runner';
  import { boundsSizeKm, suggestName } from './frame';
  import { IMAGERY_LAYER, chosenLayers, layerChoices, offeredLayers } from './selection';
  import { CATALOG_UNSUPPORTED_TEXT, DETAIL_TEXT, METERED_ASK_FIRST, NOTIFY_NOTE, formatSize, hasRoom, layerLabel, listLayers, meteredQuestion, notEnoughSpaceText, propertyLinesNote, spanText, startErrorText, type DetailLevel } from './text';

  interface Props {
    service: DownloadService;
    ui: DownloadsUi;
    offers: readonly CountyOffer[];
    areas: readonly AreaView[];
    layersOn: readonly string[];
    /** Property lines are on. They are never part of a download; the screen says so. */
    parcelsOn: boolean;
    /** Counties whose property lines came with the app. Property lines are never part of a download. */
    linesWith: readonly string[];
    network: NetworkState;
    freeBytes: number | undefined;
    /** Show the sentence about Android's notification question (until a first download has started). */
    notifyNote: boolean;
    onZoom: (direction: 1 | -1) => void;
    onStarted: (id: string) => void;
  }

  let { service, ui, offers, areas, layersOn, parcelsOn, linesWith, network, freeBytes, notifyNote, onZoom, onStarted }: Props = $props();

  const LEVELS: (DetailLevel | 0)[] = [0, 14, 15, 16];

  // Imagery starts at high detail when the user is looking at it, and off
  // when not, until the user chooses; the choice is kept (DownloadsUi.detail).
  const detail = $derived<DetailLevel | 0>(
    ui.detail !== null && (LEVELS as number[]).includes(ui.detail) ? (ui.detail as DetailLevel | 0) : layersOn.includes(IMAGERY_LAYER) ? 16 : 0,
  );

  const choices = $derived(layerChoices(offeredLayers(offers), layersOn).filter((c) => c.layer !== IMAGERY_LAYER));
  let picked = $state<Set<string>>(new Set());
  const fixed = $derived(chosenLayers(choices, picked));
  const layers = $derived(detail > 0 ? [...fixed, IMAGERY_LAYER] : fixed);
  const optional = $derived(choices.filter((c) => c.rule === 'optional'));

  const request = $derived<AreaRequest | null>(ui.pickBounds ? { where: { bounds: ui.pickBounds }, layers, aerialMaxzoom: detail || 14 } : null);

  let est = $state.raw<EstimateState>({ kind: 'none' });
  const runner = new EstimateRunner((r, signal) => service.estimate(r, signal), (s) => (est = s));
  onDestroy(() => runner.destroy());
  $effect(() => runner.setOnline(network.online));
  $effect(() => runner.request(request));

  // The name: suggested from the counties the frame touches, until the user
  // types one. It sits in the foot with the Download button, so it shows on
  // the cover screen; Change opens a field there, in place of the size, so
  // the field stays in view above the keyboard.
  let name = $state('');
  let nameEdited = $state(false);
  const suggested = $derived(ui.pickBounds ? suggestName(ui.pickBounds, offers, areas.map((a) => a.record.name)) : 'Area 1');
  const shownName = $derived(nameEdited && name.trim() ? name.trim() : suggested);

  function startNaming() {
    if (!nameEdited) name = suggested;
    ui.naming = true;
  }

  function endNaming() {
    nameEdited = name.trim() !== '' && name.trim() !== suggested;
    ui.naming = false;
  }

  /** Puts the cursor in the field as it opens, at the end of the name. */
  function focusAtEnd(el: HTMLInputElement) {
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }
  onDestroy(() => (ui.naming = false));

  const span = $derived(ui.pickBounds ? boundsSizeKm(ui.pickBounds) : null);
  /** The estimate's bytes per layer, added up across counties, in the order the layers are listed. */
  const perLayer = $derived.by(() => {
    if (est.kind !== 'ready') return [];
    const sums = new Map<string, number>();
    for (const l of est.estimate.layers) sums.set(l.layer, (sums.get(l.layer) ?? 0) + l.bytes);
    return layers.filter((l) => sums.has(l)).map((l) => ({ layer: l, bytes: sums.get(l) ?? 0 }));
  });
  const missing = $derived(est.kind === 'ready' ? est.estimate.missing : []);
  const bytes = $derived(est.kind === 'ready' ? est.estimate.bytes : 0);
  // The same rule as the download service: the download and the room it keeps spare.
  const tooBig = $derived(est.kind === 'ready' && !hasRoom(bytes, freeBytes));
  const canStart = $derived(est.kind === 'ready' && !tooBig && network.online);

  let confirming = $state(false);
  let starting = $state(false);
  let startFailed = $state('');
  // A new size needs a new yes.
  $effect(() => {
    void bytes;
    confirming = false;
  });

  function setDetail(level: DetailLevel | 0) {
    ui.detail = level;
  }

  function toggle(layer: string, on: boolean) {
    const next = new Set(picked);
    if (on) next.add(layer);
    else next.delete(layer);
    picked = next;
  }

  async function start() {
    if (!canStart || !request || starting) return;
    if (network.metered && !confirming) {
      confirming = true;
      return;
    }
    // Only a yes to the mobile data question allows mobile data. Started on Wi-Fi, it waits for Wi-Fi.
    const agreed = confirming;
    confirming = false;
    starting = true;
    startFailed = '';
    try {
      const id = await service.start(request, shownName.trim() || suggested, { allowMetered: agreed });
      onStarted(id);
    } catch (e) {
      console.warn('the area download could not start:', e);
      startFailed = startErrorText(errorCode(e), e as object);
    } finally {
      starting = false;
    }
  }
</script>

<span class="area-picker" hidden></span>
<div class="zoom">
  <DlButton icon="bigger" label="Bigger area" onclick={() => onZoom(-1)} />
  <DlButton icon="smaller" label="Smaller area" onclick={() => onZoom(1)} />
</div>

<fieldset class="detail">
  <legend>Aerial imagery</legend>
  <div class="segments" role="radiogroup" aria-label="Aerial imagery detail">
    {#each LEVELS as level (level)}
      <button role="radio" aria-checked={detail === level} class:on={detail === level} onclick={() => setDetail(level)}>
        {DETAIL_TEXT[level].short}
      </button>
    {/each}
  </div>
  <p class="ground">{DETAIL_TEXT[detail].ground}</p>
</fieldset>

{#each optional as c (c.layer)}
  <label class="row">
    <input type="checkbox" checked={picked.has(c.layer)} onchange={(e) => toggle(c.layer, e.currentTarget.checked)} />
    <span class="box" aria-hidden="true"></span>
    <span>Add {layerLabel(c.layer).toLowerCase()}</span>
  </label>
{/each}

{#if parcelsOn}
  <p class="lines"><Icon name="parcel" size={20} /> <span>{propertyLinesNote(linesWith)}</span></p>
{/if}

<!-- The name, the size and the Download button stay in view at the foot of the panel while the choices above scroll. -->
<div class="foot">
{#if ui.naming}
  <form class="naming" onsubmit={(e) => { e.preventDefault(); endNaming(); }}>
    <label for="area-name">Name of this area</label>
    <div class="name-row">
      <input id="area-name" type="text" bind:value={name} maxlength="60" autocomplete="off" enterkeyhint="done" use:focusAtEnd />
      <DlButton kind="primary" label="Done" onclick={endNaming} />
    </div>
  </form>
{:else}
<div class="name-line">
  <p><span class="muted">Name:</span> <strong>{shownName}</strong></p>
  <DlButton kind="quiet" label="Change" ariaLabel="Change the name, {shownName}" onclick={startNaming} />
</div>
<div class="size" aria-live="polite">
  {#if est.kind === 'none' || est.kind === 'working'}
    <p class="working"><span class="spinner" aria-hidden="true"></span> Working out the size</p>
    <p class="sub">{listLayers(layers)}{span ? `. ${spanText(span.widthKm, span.heightKm)}.` : '.'}</p>
  {:else if est.kind === 'ready'}
    <p class="bytes">{formatSize(bytes)}</p>
    <p class="sub">{perLayer.map((l, i) => `${i === 0 ? layerLabel(l.layer) : layerLabel(l.layer).toLowerCase()} ${formatSize(l.bytes)}`).join(', ')}.{span ? ` ${spanText(span.widthKm, span.heightKm)}.` : ''}</p>
    {#if missing.length}
      <p class="sub">Not offered here: {listLayers(missing).toLowerCase()}.</p>
    {/if}
    {#if network.metered}
      <p class="metered"><Icon name="mobile-data" size={20} /> <span>{METERED_ASK_FIRST}</span></p>
    {/if}
  {:else if est.kind === 'empty'}
    <p class="problem"><Icon name="info" size={22} /> <span><strong>Nothing to download here.</strong> Maps are offered for Champaign County and Macon County. Move the frame over one of them.</span></p>
  {:else if est.kind === 'offline'}
    <p class="problem"><Icon name="offline" size={22} /> <span><strong>You are offline.</strong> The size and the download need a connection.</span></p>
  {:else if est.kind === 'unsupported'}
    <p class="problem"><Icon name="caution" size={22} /> <span>{CATALOG_UNSUPPORTED_TEXT}</span></p>
  {:else if est.kind === 'error'}
    <p class="problem"><Icon name="caution" size={22} /> <span><strong>The size could not be worked out.</strong> Check the connection.</span></p>
    <DlButton icon="retry" label="Try again" onclick={() => runner.retry()} />
  {/if}
  {#if tooBig}
    <p class="problem"><Icon name="caution" size={22} /> <span><strong>Not enough space.</strong> {notEnoughSpaceText(bytes, freeBytes ?? 0, false)}</span></p>
  {/if}
</div>
{/if}

{#if confirming}
  <div class="confirm" role="group" aria-label="Download on mobile data">
    <p><Icon name="mobile-data" size={22} /> <span><strong>{meteredQuestion(bytes).title}</strong> {meteredQuestion(bytes).detail}</span></p>
    <div class="buttons">
      <DlButton kind="primary" icon="download" label="Download now" onclick={start} />
      <DlButton label="Not now" onclick={() => (confirming = false)} />
    </div>
  </div>
{:else}
  <DlButton kind="primary" wide icon="download" disabled={!canStart || starting}
    label={starting ? 'Starting' : est.kind === 'ready' ? `Download ${formatSize(bytes)}` : 'Download'}
    onclick={start} />
{/if}
{#if startFailed}
  <p class="problem start-failed" role="alert"><Icon name="caution" size={22} /> <span>{startFailed}</span></p>
{/if}
{#if notifyNote && !ui.naming}
  <p class="notify">{NOTIFY_NOTE}</p>
{/if}
</div>

<style>
  /* On a narrow screen the sheet keeps one height while picking. If it grew
     and shrank with the size text, the frame above it would move, the area
     would change and the size would be asked for again, without end. */
  @media (max-width: 599px) {
    :global(aside.panel:has(.area-picker)) {
      height: min(62%, 540px);
    }
  }

  .zoom {
    display: flex;
    gap: 8px;
  }

  .zoom > :global(button) {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 8px;
    white-space: nowrap;
  }

  .detail {
    margin: 14px 0 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .segments {
    display: flex;
    padding: 3px;
    gap: 3px;
    border-radius: var(--radius);
    background: var(--surface-alt);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .segments button {
    flex: 1 1 0;
    min-width: 0;
    min-height: 48px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text);
    font-weight: 700;
    cursor: pointer;
  }

  .segments button.on {
    background: var(--accent);
    color: var(--accent-text);
    box-shadow: var(--shadow);
  }

  .ground {
    margin: 6px 0 0;
    font-size: 0.9rem;
    color: var(--text-muted);
    min-height: 2.5em;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    font-weight: 700;
    cursor: pointer;
  }

  .row input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .box {
    flex: none;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 2.5px solid var(--line-strong);
    border-radius: 7px;
  }

  .row input:checked + .box {
    border-color: var(--accent);
    background: var(--accent);
  }

  .row input:checked + .box::after {
    content: '';
    width: 7px;
    height: 14px;
    margin-top: -3px;
    border: solid var(--accent-text);
    border-width: 0 3px 3px 0;
    transform: rotate(45deg);
  }

  .row input:focus-visible + .box {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .lines {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 8px 0 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .name-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: -4px 0 6px;
  }

  .name-line p {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    line-height: 1.25;
  }

  .name-line :global(button) {
    flex: none;
    min-height: 48px;
  }

  .muted {
    color: var(--text-muted);
  }

  .naming {
    margin: 0 0 10px;
  }

  .naming label {
    display: block;
    margin-bottom: 4px;
    font-weight: 700;
  }

  .name-row {
    display: flex;
    gap: 8px;
  }

  .notify {
    margin: 8px 0 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .name-row input {
    flex: 1;
    min-width: 0;
    min-height: 48px;
    padding: 0 12px;
    border: 2px solid var(--line-strong);
    border-radius: 10px;
    font: inherit;
    font-weight: 400;
  }

  .foot {
    position: sticky;
    bottom: calc(-20px - var(--inset-bottom));
    z-index: 1;
    margin: 12px -16px calc(-20px - var(--inset-bottom));
    padding: 10px 16px calc(14px + var(--inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--line);
  }

  .size {
    margin: 0 0 10px;
    min-height: 74px;
  }

  .size p {
    margin: 0;
  }

  .bytes {
    font-size: 1.6rem;
    font-weight: 800;
    line-height: 1.15;
  }

  .working {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.1rem;
    font-weight: 700;
    min-height: 1.85rem;
  }

  .sub {
    margin-top: 2px;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .start-failed {
    margin-top: 10px;
  }

  .metered {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    margin-top: 6px !important;
    font-size: 0.95rem;
    font-weight: 600;
    color: #6b4600;
  }

  .problem {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 0 0 8px;
  }

  .size .problem + :global(button) {
    margin-top: 4px;
  }

  .size p.problem:not(:first-child) {
    margin-top: 8px;
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

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }
  }

  .confirm {
    padding: 12px;
    border-radius: 10px;
    background: #fbf3e2;
    border-left: 5px solid #8a5a00;
  }

  .confirm p {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 0;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .buttons > :global(button) {
    flex: 1 1 auto;
  }
</style>
