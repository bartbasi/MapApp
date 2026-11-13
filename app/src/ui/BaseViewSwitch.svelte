<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!-- Map, aerial or hybrid. Only views whose data is installed are offered. -->
<script lang="ts">
  import type { BaseView } from '../map/style/build-style';

  interface Props {
    value: BaseView;
    available: BaseView[];
    onChange: (v: BaseView) => void;
  }

  let { value, available, onChange }: Props = $props();

  const labels: Record<BaseView, string> = { map: 'Map', aerial: 'Aerial', hybrid: 'Hybrid' };
</script>

{#if available.length > 1}
  <div class="switch" role="radiogroup" aria-label="Base view">
    {#each available as view (view)}
      <button
        role="radio"
        aria-checked={value === view}
        class:on={value === view}
        onclick={() => onChange(view)}>{labels[view]}</button
      >
    {/each}
  </div>
{/if}

<style>
  .switch {
    display: inline-flex;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  button {
    min-width: 64px;
    height: var(--touch);
    margin: 0;
    padding: 0 10px;
    border: 0;
    background: transparent;
    font-size: 0.95rem;
    cursor: pointer;
  }

  button.on {
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }
</style>
