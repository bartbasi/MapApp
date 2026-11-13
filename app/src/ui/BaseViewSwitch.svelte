<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!-- Map, aerial or hybrid. Only views whose data is installed are offered. -->
<script lang="ts">
  import type { BaseView } from '../map/style/build-style';
  import Icon from './Icon.svelte';

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
      <button role="radio" aria-checked={value === view} class:on={value === view} onclick={() => onChange(view)}>
        <Icon name={view} size={22} />
        <span>{labels[view]}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .switch {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  button {
    width: 62px;
    height: 54px;
    margin: 0;
    padding: 4px 0 3px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.1;
    cursor: pointer;
  }

  button.on {
    background: var(--accent);
    color: var(--accent-text);
  }

  button:not(.on):active {
    background: var(--surface-alt);
  }
</style>
