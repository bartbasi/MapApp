<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The small line under the map that says how good the position is, while
  position is on. It reads the position store directly, so the later readout
  (the parcel the phone is in, the distance to the property line) can add
  its lines here.
-->
<script lang="ts">
  import { accuracyText } from '../position/messages';
  import type { PositionSnapshot, PositionStore } from '../position/store';

  interface Props {
    store: PositionStore;
  }

  let { store }: Props = $props();

  // Filled at once by subscribe(), which calls back with the current state.
  let snap = $state.raw<PositionSnapshot | null>(null);
  $effect(() => store.subscribe((s) => (snap = s)));
</script>

{#if snap?.on && snap.fix}
  <div class="readout" class:stale={snap.stale} role="status" aria-live="polite">
    <span class="dot" aria-hidden="true"></span>
    <span>{accuracyText(snap.fix.accuracyM)}</span>
  </div>
{/if}

<style>
  .readout {
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

  .stale {
    color: var(--text-muted);
  }

  .stale .dot {
    background: #80858c;
  }
</style>
