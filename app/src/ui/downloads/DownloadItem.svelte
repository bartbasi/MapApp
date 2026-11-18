<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  One download in the list: its name, status, size, data date and progress,
  and what can be done with it. Delete asks first, in the card itself.
-->
<script lang="ts">
  import type { AreaView } from '../../downloads/contract';
  import { formatDate } from '../format';
  import DlButton from './DlButton.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import { ACTION_LABELS, DAMAGED_NAME, DAMAGED_TEXT, contentsLine, formatSize, isDamagedRecord, percentDone, statusText, type MainAction } from './text';

  interface Props {
    view: AreaView;
    /** Its outline is the one picked out on the map. */
    shown: boolean;
    /** Why the last button press did not work, or ''. */
    note: string;
    onShow: () => void;
    onAction: (action: Exclude<MainAction, null>) => void;
    onDelete: () => void;
  }

  let { view, shown, note, onShow, onAction, onDelete }: Props = $props();

  let confirming = $state(false);
  const s = $derived(statusText(view));
  /** A record the phone could not read: it has no name, place or layers, and can only be deleted. */
  const damaged = $derived(isDamagedRecord(view.record));
  const name = $derived(damaged ? DAMAGED_NAME : view.record.name || DAMAGED_NAME);
  const pct = $derived(percentDone(view.bytesDone, view.bytesTotal));
  const stopped = $derived(view.status === 'paused' || view.status === 'waiting' || view.status === 'queued');
  const actionIcon = { pause: 'pause', resume: 'resume', retry: 'retry', again: 'download' } as const;
</script>

<article class:shown class={damaged ? 'problem' : s.tone} aria-label={name}>
  <div class="head">
    <StatusBadge icon={damaged ? 'caution' : s.icon} tone={damaged ? 'problem' : s.tone} />
    <div class="words">
      <h4>{name}</h4>
      <p class="status">{damaged ? 'Cannot be used' : s.title}</p>
    </div>
    <span class="size">{formatSize(view.bytesTotal || view.record.bytes)}</span>
  </div>

  {#if damaged}
    <p class="detail">{DAMAGED_TEXT}</p>
  {:else}
  {#if s.progress}
    <div class="bar" class:stopped role="progressbar" aria-label="Downloaded" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style:width={`${pct}%`}></span>
    </div>
  {/if}
  {#if s.detail}
    <p class="detail">{s.detail}</p>
  {/if}
  {#if note}
    <p class="note" role="alert">{note}</p>
  {/if}
  <p class="meta">{contentsLine(view.record.layers, view.record.aerialMaxzoom)} Data from {formatDate(view.record.dataDate)}.</p>
  {/if}

  {#if confirming}
    <div class="confirm" role="group" aria-label="Delete {name}">
      <p>
        <strong>Delete {name} from this phone?</strong>
        {view.status === 'complete' ? 'This place will no longer have a map when you are offline.' : 'What has downloaded so far is thrown away.'}
      </p>
      <div class="actions">
        <DlButton kind="danger-solid" icon="trash" label="Delete" onclick={() => { confirming = false; onDelete(); }} />
        <DlButton label="Keep it" onclick={() => (confirming = false)} />
      </div>
    </div>
  {:else}
    <div class="actions row3">
      {#if s.action && !damaged}
        <DlButton stacked kind={s.tone === 'problem' ? 'primary' : 'plain'} icon={actionIcon[s.action]} label={ACTION_LABELS[s.action]} onclick={() => s.action && onAction(s.action)} />
      {/if}
      {#if !damaged}
        <DlButton stacked kind={shown ? 'quiet' : 'plain'} icon="show-area" label="Show on map" ariaLabel="Show {name} on the map" onclick={onShow} />
      {/if}
      <DlButton stacked kind="danger" icon="trash" label="Delete" ariaLabel="Delete {name}" onclick={() => (confirming = true)} />
    </div>
  {/if}
</article>

<style>
  article {
    padding: 12px;
    border: 2px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  article + :global(article) {
    margin-top: 10px;
  }

  article.problem {
    border-color: #e2b4b0;
  }

  article.shown {
    border-color: var(--text);
    box-shadow: inset 0 0 0 1px var(--text);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .words {
    flex: 1;
    min-width: 0;
  }

  h4 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .status {
    margin: 1px 0 0;
    font-weight: 600;
    line-height: 1.25;
  }

  .problem .status {
    color: #8c1d18;
  }

  .size {
    flex: none;
    align-self: flex-start;
    font-weight: 700;
    white-space: nowrap;
  }

  .bar {
    height: 12px;
    margin: 10px 0 0;
    border-radius: 6px;
    background: #e3dfd5;
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: 6px;
    background: var(--accent);
    transition: width 0.4s;
  }

  /* Not moving: stripes as well as a lighter color, so it does not rest on color alone. */
  .bar.stopped span {
    background: repeating-linear-gradient(-45deg, #5d7a64 0 6px, #8fa695 6px 12px);
  }

  .detail {
    margin: 8px 0 0;
    font-size: 0.95rem;
  }

  .note {
    margin: 8px 0 0;
    font-weight: 600;
    color: #8c1d18;
  }

  .meta {
    margin: 6px 0 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .actions > :global(button) {
    flex: 1 1 auto;
  }

  .row3 {
    flex-wrap: nowrap;
  }

  .row3 > :global(button) {
    flex: 1 1 0;
    min-width: 0;
  }

  .confirm {
    margin-top: 12px;
    padding: 12px;
    border-radius: 10px;
    background: #fbe4e2;
  }

  .confirm p {
    margin: 0;
  }

  .confirm .actions {
    margin-top: 10px;
  }
</style>
