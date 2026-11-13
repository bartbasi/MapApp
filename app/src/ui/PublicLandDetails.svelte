<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  What is known about a tapped public land site. The hunting note comes first
  and is the loudest thing on the panel. Its three states differ in words,
  icon, and border as well as color:
  - no:      solid dark red block, white text, a barred circle;
  - limited: amber block with a heavy solid border, a permit card;
  - unknown: white block with a heavy dashed border, a question in a bubble.
-->
<script lang="ts">
  import { findHuntingNote, huntingNotes, type HuntingStatus } from '../content/hunting-notes';
  import { accessOnFootText, categoryLabels, type PublicLandSite } from '../map/public-land';
  import type { ArchiveSource } from '../platform/archive-meta';
  import { formatAcres, formatDate } from './format';
  import Icon, { type IconName } from './Icon.svelte';
  import PublicLandSwatch from './PublicLandSwatch.svelte';

  interface Props {
    site: PublicLandSite;
    /** The public land layer's sources, from the archives' metadata. */
    sources: ArchiveSource[];
  }

  let { site, sources }: Props = $props();

  const note = $derived(findHuntingNote(huntingNotes, site));

  const status: Record<HuntingStatus, { headline: string; icon: IconName }> = {
    no: { headline: 'No hunting', icon: 'no-hunting' },
    limited: { headline: 'Limited: permit needed', icon: 'permit' },
    unknown: { headline: 'Unknown: ask first', icon: 'ask' },
  };

  const shown = $derived(status[note.hunting] ?? status.unknown);
</script>

<section class="hunting" data-status={note.hunting} aria-label="Hunting">
  <div class="headline">
    <Icon name={shown.icon} size={34} />
    <h3>{shown.headline}</h3>
  </div>
  <p class="note">{note.text}</p>
  {#if note.sourceUrl}
    <a class="source" href={note.sourceUrl} target="_blank" rel="noopener noreferrer">
      <span>{note.sourceName || 'The rule'}</span>
      <Icon name="external" size={20} />
    </a>
  {/if}
  <p class="checked">Checked {formatDate(huntingNotes.asOf)}. Rules change every year.</p>
</section>

<dl>
  <dt>Access</dt>
  <dd class:closed={site.access === 'closed'}>{accessOnFootText(site.access)}</dd>
  <dt>Managed by</dt>
  <dd>
    <span class="with-swatch">
      <PublicLandSwatch category={site.category} access={site.access} width={36} height={24} />
      <span>
        {site.manager || 'Not stated'}
        <span class="muted">{categoryLabels[site.category]}</span>
      </span>
    </span>
  </dd>
  <dt>Size</dt>
  <dd>{formatAcres(site.acres)}</dd>
</dl>

<p class="survey">Boundaries come from public records and are not a legal survey.</p>

{#if sources.length}
  <ul class="credits" aria-label="Public land data sources">
    {#each sources as src (src.name + src.credit)}
      <li>{src.credit} ({src.license}, data of {formatDate(src.dataDate)})</li>
    {/each}
  </ul>
{/if}

<style>
  /* The hunting note. */
  .hunting {
    margin: 0 0 16px;
    padding: 12px 14px 10px;
    border-radius: var(--radius);
    border: 4px solid;
  }

  .hunting[data-status='no'] {
    background: #9b1c13;
    border-color: #9b1c13;
    color: #ffffff;
  }

  .hunting[data-status='limited'] {
    background: #ffe7a3;
    border-color: #7a5600;
    color: #1d1600;
  }

  .hunting[data-status='unknown'] {
    background: #ffffff;
    border-color: #3a362f;
    border-style: dashed;
    color: var(--text);
  }

  .headline {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hunting h3 {
    margin: 0;
    font-size: 1.45rem;
    font-weight: 800;
    line-height: 1.15;
  }

  .note {
    margin: 10px 0 4px;
    font-size: 1rem;
    line-height: 1.4;
  }

  .source {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: var(--touch);
    color: inherit;
    font-weight: 700;
    line-height: 1.25;
  }

  .checked {
    margin: 2px 0 0;
    font-size: 0.85rem;
    opacity: 0.9;
  }

  /* Facts about the site. */
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 14px;
    margin: 0;
    align-items: start;
  }

  dt {
    color: var(--text-muted);
    font-size: 0.9rem;
    padding-top: 2px;
  }

  dd {
    margin: 0;
    font-weight: 600;
  }

  dd.closed {
    font-weight: 800;
  }

  .with-swatch {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .muted {
    display: block;
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 400;
  }

  .survey {
    margin: 16px 0 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .credits {
    margin: 12px 0 0;
    padding: 8px 0 0;
    list-style: none;
    border-top: 1px solid var(--line);
    font-size: 0.75rem;
    line-height: 1.35;
    color: var(--text-muted);
  }

  .credits li + li {
    margin-top: 4px;
  }
</style>
