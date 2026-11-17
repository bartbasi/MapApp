<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  A short card over the map when the position needs the user's attention:
  refused, Location switched off, waiting for the first fix, or gone stale.
  The words are in position/messages.ts.
-->
<script lang="ts">
  import { positionMessage, type MessageContext } from '../position/messages';
  import type { PositionSnapshot, PositionStore } from '../position/store';
  import Icon from './Icon.svelte';

  interface Props {
    store: PositionStore;
    context: MessageContext;
    onOpenSettings: (page: 'app' | 'location') => void;
  }

  let { store, context, onOpenSettings }: Props = $props();

  // Filled at once by subscribe(), which calls back with the current state.
  let snap = $state.raw<PositionSnapshot | null>(null);
  $effect(() => store.subscribe((s) => (snap = s)));

  const message = $derived(snap ? positionMessage(snap, context) : null);
  const urgent = $derived(message?.kind === 'denied' || message?.kind === 'approximate' || message?.kind === 'location-off' || message?.kind === 'unavailable');
</script>

{#if message}
  <div class="message" class:urgent role={urgent ? 'alert' : 'status'}>
    <div class="text">
      <p class="title">{message.title}</p>
      <p class="body">{message.body}</p>
      {#if message.settings}
        {@const page = message.settings}
        <button class="action" onclick={() => onOpenSettings(page)}>
          {page === 'app' ? 'Open app settings' : 'Open Location settings'}
        </button>
      {/if}
    </div>
    {#if message.dismissible}
      <button class="close" onclick={() => store.dismissError()} aria-label="Close this message">
        <Icon name="close" size={20} />
      </button>
    {/if}
  </div>
{/if}

<style>
  .message {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 6px 10px 14px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    border-left: 5px solid var(--line-strong);
  }

  .message.urgent {
    border-left-color: #b3261e;
  }

  .text {
    flex: 1;
    min-width: 0;
    padding-right: 8px;
  }

  p {
    margin: 0;
  }

  .title {
    font-weight: 700;
  }

  .body {
    margin-top: 2px;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .action {
    margin-top: 8px;
    min-height: var(--touch);
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 700;
    cursor: pointer;
  }

  .close {
    flex: none;
    width: var(--touch);
    height: var(--touch);
    margin: -6px 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .close:active {
    background: var(--surface-alt);
  }
</style>
