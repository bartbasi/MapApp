<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  Every installed layer and every source in it, straight from the archives'
  metadata files. Nothing here is written per source. A layer that is on the
  phone several times (the overview map, downloaded counties and areas) is
  listed once, with each place it covers (sources-groups.ts).
-->
<script lang="ts">
  import type { ArchiveEntry } from '../platform/archive-meta';
  import { formatBytes, formatDate } from './format';
  import Icon from './Icon.svelte';
  import { groupSources } from './sources-groups';

  interface Props {
    entries: ArchiveEntry[];
    /** The name of each downloaded area, by its ID, to say which download a copy belongs to. */
    areaNames?: ReadonlyMap<string, string>;
    onOpenDiagnostics: () => void;
  }

  let { entries, areaNames = new Map(), onOpenDiagnostics }: Props = $props();

  const groups = $derived(groupSources(entries, areaNames));
</script>

{#if entries.length === 0}
  <p>No map data is installed.</p>
{/if}

{#each groups as group (group.layer)}
  <article>
    <h3>{group.title}</h3>
    <ul class="places">
      {#each group.places as place (place.key)}
        <li class="muted">{place.where}. Built {formatDate(place.buildDate)}, {formatBytes(place.bytes)}{place.count > 1 ? ' in all' : ''}.</li>
      {/each}
    </ul>
    {#each group.sources as source, i (i)}
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
    {#each group.notes as note (note)}
      <p class="notes">{note}</p>
    {/each}
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

  .places {
    list-style: none;
    margin: 2px 0 0;
    padding: 0;
  }

  .places li + li {
    margin-top: 2px;
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
