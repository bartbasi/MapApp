<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The position readout (D26): where the phone is against the property lines,
  in words, while position is on. The words come from parcels/readout-view.ts.
  Each state differs in icon, words and border as well as colour:
  - clear (inside a parcel, or in no parcel): white card, solid dark green edge;
  - caution (on or near a line): amber card with a heavy dark border, warning triangle;
  - weak (GPS too poor): white card with a heavy dashed border, a broken ring;
  - none (no property lines here): white card, gray edge, a dashed plot.
  A tap opens and closes the details (the neighbour, the county record, the
  "not a legal survey" statement). With no parcel data installed it shows
  only the GPS accuracy, as before.
-->
<script lang="ts">
  import type { ReadoutView } from '../parcels/readout-view';
  import { accuracyText } from '../position/messages';
  import type { PositionSnapshot, PositionStore } from '../position/store';
  import { splitIds } from './format';
  import Icon from './Icon.svelte';

  interface Props {
    store: PositionStore;
    /** The readout's words, or null when no parcel data is installed. */
    view: ReadoutView | null;
  }

  let { store, view }: Props = $props();

  // Filled at once by subscribe(), which calls back with the current state.
  let snap = $state.raw<PositionSnapshot | null>(null);
  $effect(() => store.subscribe((s) => (snap = s)));

  let open = $state(false);
  // A new kind of answer closes the details, so they never describe an old state.
  let lastKind = '';
  $effect(() => {
    const kind = view?.kind ?? '';
    if (kind !== lastKind) {
      lastKind = kind;
      open = false;
    }
  });
</script>

{#snippet ids(text: string)}{#each splitIds(text) as piece, i (i)}{#if piece.id}<span class="nb">{piece.text}</span>{:else}{piece.text}{/if}{/each}{/snippet}

{#if snap?.on && snap.fix}
  {#if view}
    <div class="readout tone-{view.tone}" class:stale={snap.stale} data-kind={view.kind} role="status" aria-live="polite">
      <button class="main" onclick={() => (open = !open)} aria-expanded={view.expandable ? open : undefined} disabled={!view.expandable}>
        <span class="icon"><Icon name={view.icon} size={28} /></span>
        <span class="text">
          <span class="title">{view.title}</span>
          {#each view.lines as line, i (i)}
            <span class="line">{@render ids(line)}</span>
          {/each}
          {#if view.sides.length}
            <span class="sides">
              {#each view.sides as side, i (i)}
                <span class="side">{@render ids(side)}</span>
              {/each}
            </span>
          {/if}
          {#each view.small as line, i (i)}
            <span class="small">{@render ids(line)}</span>
          {/each}
        </span>
        {#if view.expandable}
          <span class="chevron" class:open aria-hidden="true"><Icon name="chevron" size={20} /></span>
        {/if}
      </button>
      {#if open && view.expandable}
        <div class="more">
          {#each view.more as line, i (i)}
            <p>{@render ids(line)}</p>
          {/each}
          {#if view.moreList.length}
            <p class="list-title">{view.moreListTitle} ({view.moreList.length})</p>
            <ul class="list">
              {#each view.moreList as item, i (i)}
                <li>{@render ids(item)}</li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="chip" class:stale={snap.stale} role="status" aria-live="polite">
      <span class="dot" aria-hidden="true"></span>
      <span>{accuracyText(snap.fix.accuracyM)}</span>
    </div>
  {/if}
{/if}

<style>
  .readout {
    max-width: 100%;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
    border: 3px solid transparent;
    border-left-width: 7px;
    overflow: hidden;
  }

  .tone-clear {
    border-color: var(--surface);
    border-left-color: var(--accent);
  }

  .tone-caution {
    background: #ffe7a3;
    border-color: #7a5600;
    color: #1d1600;
  }

  .tone-weak {
    border-style: dashed;
    border-color: #4a463e;
    border-left-width: 3px;
  }

  .tone-none {
    border-color: var(--surface);
    border-left-color: var(--line-strong);
  }

  .main {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 6px 8px 8px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .main:disabled {
    cursor: default;
  }

  .icon {
    flex: none;
    padding-top: 1px;
  }

  .tone-clear .icon {
    color: var(--accent);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .title {
    font-size: 1.15rem;
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .line {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.25;
  }

  .sides {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 3px 0 1px;
  }

  .side {
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.25;
    padding-left: 10px;
    border-left: 3px solid currentColor;
    overflow-wrap: anywhere;
  }

  .small {
    font-size: 0.85rem;
    line-height: 1.3;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  .tone-caution .small {
    color: #3d2f00;
  }

  .chevron {
    flex: none;
    align-self: center;
    transform: rotate(90deg);
    transition: transform 0.15s;
  }

  .chevron.open {
    transform: rotate(-90deg);
  }

  .more {
    max-height: 38vh;
    overflow-y: auto;
    padding: 0 12px 10px 44px;
    font-size: 0.92rem;
    line-height: 1.35;
  }

  .more p {
    margin: 0 0 6px;
  }

  .list-title {
    font-weight: 700;
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 9.5em;
    overflow-y: auto;
    border-top: 1px solid var(--line);
  }

  .list li {
    padding: 3px 0;
    border-bottom: 1px solid var(--line);
  }

  .nb {
    white-space: nowrap;
  }

  .stale .title,
  .stale .line,
  .stale .side {
    color: var(--text-muted);
  }

  /* With no parcel data: the small accuracy line, as before. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    min-height: 36px;
    padding: 6px 12px;
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #1559d6;
    box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(10, 22, 48, 0.45);
  }

  .chip.stale {
    color: var(--text-muted);
  }

  .chip.stale .dot {
    background: #80858c;
  }
</style>
