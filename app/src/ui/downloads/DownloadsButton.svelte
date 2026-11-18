<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The map's button for offline maps, under the Layers button. While anything
  is downloading, a ring around the icon fills with the progress; when a
  download has stopped with an error, a warning mark sits on its corner.
-->
<script lang="ts">
  import type { AreaView, DownloadService } from '../../downloads/contract';
  import Icon from '../Icon.svelte';

  interface Props {
    service: DownloadService;
    pressed: boolean;
    onTap: () => void;
  }

  let { service, pressed, onTap }: Props = $props();

  let areas = $state.raw<readonly AreaView[]>([]);
  $effect(() => {
    areas = service.areas();
    return service.onAreas((a) => (areas = a));
  });

  const going = $derived(areas.filter((a) => a.status === 'downloading' || a.status === 'queued' || a.status === 'waiting' || a.status === 'paused'));
  const failed = $derived(areas.filter((a) => a.status === 'failed').length);
  const fraction = $derived.by(() => {
    const total = going.reduce((s, a) => s + a.bytesTotal, 0);
    return total > 0 ? going.reduce((s, a) => s + a.bytesDone, 0) / total : 0;
  });
  const moving = $derived(going.some((a) => a.status === 'downloading'));
  const label = $derived(
    ['Offline maps', going.length ? `${going.length} downloading, ${Math.floor(fraction * 100)}% done` : '', failed ? `${failed} stopped by an error` : '']
      .filter(Boolean)
      .join(', '),
  );
  const R = 26;
  const C = 2 * Math.PI * R;
</script>

<button class="round" onclick={onTap} aria-label={label} aria-pressed={pressed}>
  <Icon name="download" size={26} />
  {#if going.length}
    <svg class="ring" viewBox="0 0 60 60" aria-hidden="true">
      <circle class="track" cx="30" cy="30" r={R} />
      <circle class="fill" class:still={!moving} cx="30" cy="30" r={R} stroke-dasharray={`${(fraction * C).toFixed(1)} ${C.toFixed(1)}`} />
    </svg>
  {/if}
  {#if failed}
    <span class="alert" aria-hidden="true">!</span>
  {/if}
</button>

<style>
  .round {
    position: relative;
    width: 60px;
    height: 60px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
    cursor: pointer;
  }

  .round:active {
    background: var(--surface-alt);
  }

  .round[aria-pressed='true'] {
    background: var(--accent);
    color: var(--accent-text);
  }

  .ring {
    position: absolute;
    inset: 0;
    width: 60px;
    height: 60px;
    transform: rotate(-90deg);
  }

  .ring circle {
    fill: none;
    stroke-width: 4;
  }

  .track {
    stroke: var(--line);
  }

  .fill {
    stroke: var(--accent);
    stroke-linecap: round;
  }

  [aria-pressed='true'] .fill {
    stroke: var(--accent-text);
  }

  [aria-pressed='true'] .track {
    stroke: rgba(255, 255, 255, 0.3);
  }

  /* Not moving (paused or waiting): the ring turns grey. The list says why, in words. */
  .fill.still {
    stroke-linecap: butt;
    stroke: var(--line-strong);
  }

  /* A warning triangle on the top right corner. */
  .alert {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 24px;
    height: 22px;
    display: grid;
    place-items: end center;
    padding-bottom: 1px;
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
    background: #b3261e;
    color: #fff;
    font-weight: 800;
    font-size: 0.85rem;
    line-height: 1;
  }
</style>
