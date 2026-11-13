<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!-- What is known about a tapped public land site. -->
<script lang="ts">
  import { findHuntingNote, huntingNotes, huntingStatusText } from '../content/hunting-notes';
  import { accessOnFootText, categoryLabels, type PublicLandSite } from '../map/public-land';
  import { publicLandPalette } from '../map/style/palette';
  import { formatAcres, formatDate } from './format';

  interface Props {
    site: PublicLandSite;
  }

  let { site }: Props = $props();

  const note = $derived(findHuntingNote(huntingNotes, site));
</script>

<div class="category">
  <span class="swatch" style:--c={publicLandPalette[site.category]}></span>
  {categoryLabels[site.category]}
</div>

<dl>
  <dt>Managed by</dt>
  <dd>{site.manager || 'Not stated'}</dd>
  <dt>Access</dt>
  <dd>{accessOnFootText(site.access)}</dd>
  <dt>Size</dt>
  <dd>{formatAcres(site.acres)}</dd>
</dl>

<section class="hunting" data-status={note.hunting}>
  <h3>{huntingStatusText(note.hunting)}</h3>
  <p>{note.text}</p>
  {#if note.sourceUrl}
    <p class="source">
      Source: <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer">{note.sourceName || note.sourceUrl}</a>
    </p>
  {/if}
  <p class="muted">Hunting notes checked {formatDate(huntingNotes.asOf)}. Rules change every year.</p>
</section>

<p class="survey">Boundaries come from public records and are not a legal survey.</p>

<style>
  .category {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .swatch {
    flex: none;
    width: 22px;
    height: 16px;
    border: 2px solid var(--c);
    background: color-mix(in srgb, var(--c) 30%, transparent);
    border-radius: 3px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    margin: 0 0 12px;
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
  }

  .hunting {
    padding: 10px 12px;
    border-radius: var(--radius);
    background: var(--surface-alt);
    border-left: 4px solid #8a8780;
  }

  .hunting[data-status='no'] {
    border-left-color: #a33a2a;
  }

  .hunting[data-status='limited'] {
    border-left-color: #b88a1c;
  }

  .hunting h3 {
    margin: 0 0 4px;
    font-size: 1rem;
  }

  .hunting p {
    margin: 4px 0;
  }

  .source a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .survey {
    margin: 12px 0 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }
</style>
