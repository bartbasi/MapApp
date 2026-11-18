<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  A whole county, one tap: each layer with its size, the total, and the
  Download button. Layers that are on now are always included; imagery and
  layers that are off can be left out or added.

  Each layer says truthfully whether it is on the phone already (from an
  earlier download of this county), on its way, or not. A new download asks
  only for what is missing, so adding imagery later fetches the imagery and
  not the map again.
-->
<script lang="ts">
  import type { AreaRequest, AreaView, CountyOffer, NetworkState } from '../../downloads/contract';
  import Icon from '../Icon.svelte';
  import DlButton from './DlButton.svelte';
  import { chosenLayers, countyBytes, countyDownloadName, countyHoldings, countyImageryMaxzoom, layerChoices, missingLayers } from './selection';
  import { errorCode } from './estimate-runner';
  import { NOTIFY_NOTE, formatSize, hasRoom, layerLabel, layerNote, meteredQuestion, notEnoughSpaceText, propertyLinesNote, startErrorText } from './text';

  interface Props {
    offer: CountyOffer;
    layersOn: readonly string[];
    /** Property lines are on. They are never part of a download; the screen says so. */
    parcelsOn: boolean;
    /** Counties whose property lines came with the app. Property lines are never part of a download. */
    linesWith: readonly string[];
    areas: readonly AreaView[];
    network: NetworkState;
    freeBytes: number | undefined;
    /** Show the sentence about Android's notification question (until a first download has started). */
    notifyNote: boolean;
    /** allowMetered: the user said yes to mobile data for this download. */
    onStart: (request: AreaRequest, name: string, allowMetered: boolean) => Promise<void>;
  }

  let { offer, layersOn, parcelsOn, linesWith, areas, network, freeBytes, notifyNote, onStart }: Props = $props();

  const name = $derived(offer.countyName.replace(/, Illinois$/, ''));
  const choices = $derived(layerChoices(offer.layers.map((l) => l.layer), layersOn));
  /** Optional layers the user has ticked. Starts as the choices' defaults. */
  let picked = $state<Set<string>>(new Set());
  let pickedFrom = '';
  $effect.pre(() => {
    // Take the defaults again only when what is offered or on changes, not on every redraw.
    const key = JSON.stringify(choices);
    if (key === pickedFrom) return;
    pickedFrom = key;
    picked = new Set(choices.filter((c) => c.chosen && c.rule === 'optional').map((c) => c.layer));
  });
  const layers = $derived(chosenLayers(choices, picked));
  /** Each layer of this county already on the phone or on its way. */
  const holdings = $derived(countyHoldings(areas, offer.county));
  /** What a new download fetches: the chosen layers the phone neither has nor is getting. */
  const missing = $derived(missingLayers(layers, holdings));
  const total = $derived(countyBytes(offer, missing));
  const anyComing = $derived(layers.some((l) => holdings.get(l) === 'coming'));
  // The same rule as the download service: the download and the room it keeps spare.
  const tooBig = $derived(!hasRoom(total, freeBytes));
  let confirming = $state(false);
  let starting = $state(false);
  let failed = $state('');

  function sizeOf(layer: string): number {
    return offer.layers.find((l) => l.layer === layer)?.bytes ?? 0;
  }

  function toggle(layer: string, on: boolean) {
    const next = new Set(picked);
    if (on) next.add(layer);
    else next.delete(layer);
    picked = next;
    confirming = false;
  }

  async function start() {
    if (network.metered && !confirming) {
      confirming = true;
      return;
    }
    // Only a yes to the mobile data question allows mobile data. Started on Wi-Fi, it waits for Wi-Fi.
    const agreed = confirming;
    confirming = false;
    starting = true;
    failed = '';
    try {
      await onStart({ where: { county: offer.county }, layers: missing, aerialMaxzoom: countyImageryMaxzoom(offer) }, countyDownloadName(name, missing, holdings), agreed);
    } catch (e) {
      console.warn('the county download could not start:', e);
      failed = startErrorText(errorCode(e), e as object);
    } finally {
      starting = false;
    }
  }
</script>

<article aria-label={name}>
  <h4>{name}</h4>
  <ul>
    {#each choices as c (c.layer)}
      {@const title = layerLabel(c.layer, offer.layers.find((l) => l.layer === c.layer)?.title)}
      {@const held = holdings.get(c.layer)}
      <li>
        {#if held}
          <div class="row held">
            <span class="have-mark" aria-hidden="true"><Icon name={held === 'on-phone' ? 'check' : 'download'} size={26} /></span>
            <span class="text">
              <span class="label">{title}</span>
              <span class="note">{held === 'on-phone' ? 'On this phone.' : 'In your downloads, not finished yet.'}</span>
            </span>
            <span class="size muted">{formatSize(sizeOf(c.layer))}</span>
          </div>
        {:else if c.rule === 'optional'}
          <label class="row optional">
            <input type="checkbox" checked={picked.has(c.layer)} onchange={(e) => toggle(c.layer, e.currentTarget.checked)} />
            <span class="box" aria-hidden="true"></span>
            <span class="text"><span class="label">{title}</span><span class="note">{layerNote(c.layer)}</span></span>
            <span class="size">{formatSize(sizeOf(c.layer))}</span>
          </label>
        {:else}
          <div class="row fixed">
            <span class="box locked" aria-hidden="true"></span>
            <span class="text">
              <span class="label">{title}</span>
              <span class="note">{c.rule === 'always' ? 'Always included.' : 'On in Layers, so always included.'}</span>
            </span>
            <span class="size">{formatSize(sizeOf(c.layer))}</span>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  {#if parcelsOn}
    <p class="lines"><Icon name="parcel" size={20} /> <span>{propertyLinesNote(linesWith, name)}</span></p>
  {/if}

  <div class="foot">
    {#if missing.length === 0}
      <p class="have"><Icon name={anyComing ? 'download' : 'check'} size={22} /> <span>{anyComing ? 'All of these are in your downloads.' : 'All of these are on this phone.'}</span></p>
    {:else}
      <p class="total"><span>{holdings.size ? 'To download' : 'Total'}</span> <strong>{formatSize(total)}</strong></p>
    {/if}
    {#if missing.length === 0}
      <!-- Nothing to fetch. -->
    {:else if !network.online}
      <p class="why">Downloading needs a connection.</p>
    {:else if tooBig}
      <p class="why problem"><strong>Not enough space.</strong> {notEnoughSpaceText(total, freeBytes ?? 0, true)}</p>
    {:else if confirming}
      <div class="confirm" role="group" aria-label="Download on mobile data">
        <p><Icon name="mobile-data" size={22} /> <span><strong>{meteredQuestion(total).title}</strong> {meteredQuestion(total).detail}</span></p>
        <div class="buttons">
          <DlButton kind="primary" icon="download" label="Download now" onclick={start} />
          <DlButton label="Not now" onclick={() => (confirming = false)} />
        </div>
      </div>
    {:else}
      <DlButton kind="primary" icon="download" label={starting ? 'Starting' : 'Download'} disabled={starting} ariaLabel="Download {name}, {formatSize(total)}" onclick={start} />
      {#if notifyNote}
        <p class="why notify">{NOTIFY_NOTE}</p>
      {/if}
    {/if}
    {#if failed}
      <p class="why problem" role="alert">{failed}</p>
    {/if}
  </div>
</article>

<style>
  article {
    padding: 12px 12px 14px;
    border: 2px solid var(--line);
    border-radius: var(--radius);
  }

  article + :global(article) {
    margin-top: 10px;
  }

  h4 {
    margin: 0 0 4px;
    font-size: 1.1rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li + li {
    border-top: 1px solid var(--line);
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 6px 0;
  }

  .optional {
    cursor: pointer;
  }

  /* The real checkbox covers the whole row, invisible, so the row is one large target. */
  .optional input {
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
    background: var(--surface);
  }

  /* A tick drawn with borders, so it works without the icon. */
  .optional input:checked + .box {
    border-color: var(--accent);
    background: var(--accent);
  }

  .optional input:checked + .box::after,
  .locked::after {
    content: '';
    width: 7px;
    height: 14px;
    margin-top: -3px;
    border: solid var(--accent-text);
    border-width: 0 3px 3px 0;
    transform: rotate(45deg);
  }

  .optional input:focus-visible + .box {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  /* Always included: a tick on a muted box that cannot be changed. */
  .locked {
    border-color: var(--line-strong);
    background: var(--line-strong);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .label {
    font-weight: 700;
  }

  .note {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.25;
  }

  .size {
    flex: none;
    font-weight: 600;
    white-space: nowrap;
  }

  .lines {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 4px 0 0;
    padding: 8px 0 2px;
    border-top: 1px solid var(--line);
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .foot {
    margin-top: 6px;
    padding-top: 10px;
    border-top: 2px solid var(--line);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
  }

  .total {
    margin: 0;
    font-size: 1.05rem;
  }

  .total strong {
    font-size: 1.2rem;
  }

  .held .note {
    color: var(--accent);
    font-weight: 600;
  }

  .have-mark {
    flex: none;
    width: 30px;
    display: grid;
    place-items: center;
    color: var(--accent);
  }

  .size.muted {
    color: var(--text-muted);
    font-weight: 500;
  }

  .have {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-weight: 700;
    color: var(--accent);
  }

  .why {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-muted);
  }

  .why.problem {
    color: #8c1d18;
  }

  .confirm {
    flex-basis: 100%;
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
