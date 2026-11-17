<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  Every installed archive and every source in it, straight from the archives'
  metadata files. Nothing here is written per source.
-->
<script lang="ts">
  import { layerTitle } from '../map/installed';
  import type { ArchiveEntry } from '../platform/archive-meta';
  import { formatBytes, formatDate } from './format';
  import Icon from './Icon.svelte';

  interface Props {
    entries: ArchiveEntry[];
    onOpenDiagnostics: () => void;
  }

  let { entries, onOpenDiagnostics }: Props = $props();
</script>

{#if entries.length === 0}
  <p>No map data is installed.</p>
{/if}

{#each entries as entry (`${entry.county}/${entry.layer}`)}
  <article>
    <h3>{layerTitle(entry)}</h3>
    <p class="muted">{entry.meta.countyName}. Built {formatDate(entry.meta.buildDate)}, {formatBytes(entry.meta.bytes)}.</p>
    {#each entry.meta.sources as source, i (i)}
      <dl>
        <dt>Source</dt>
        <dd>
          {#if /^https:\/\//.test(source.url)}
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
          {:else}
            {source.name}
          {/if}
        </dd>
        <dt>License</dt>
        <dd>{source.license}</dd>
        <dt>Credit</dt>
        <dd>{source.credit}</dd>
        <dt>Data date</dt>
        <dd>{formatDate(source.dataDate)}</dd>
      </dl>
    {/each}
    {#if entry.meta.notes}
      <p class="notes">{entry.meta.notes}</p>
    {/if}
  </article>
{/each}

<p class="muted">Map fonts: Noto Sans, under the SIL Open Font License 1.1. Icons and map style: drawn for MapApp.</p>

<button class="wide" onclick={onOpenDiagnostics}><span>Diagnostics</span><Icon name="chevron" /></button>

<style>
  article {
    padding: 12px 0 14px;
    border-bottom: 1px solid var(--line);
  }

  article:first-child {
    padding-top: 0;
  }

  h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 8px 0 0;
    font-size: 0.95rem;
  }

  dl + dl {
    padding-top: 8px;
    border-top: 1px dashed var(--line);
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  dd a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 4px 0;
  }

  .notes {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--surface-alt);
    font-size: 0.9rem;
  }

  .wide {
    margin-top: 14px;
    width: 100%;
    min-height: 52px;
    padding: 0 8px 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    font-weight: 600;
    cursor: pointer;
  }

  .wide:active {
    background: var(--surface-alt);
  }
</style>
