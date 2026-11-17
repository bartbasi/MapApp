<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The parcel at a tapped point: owner name, acreage, parcel ID, county and
  data date, and the statement that the lines are not a legal survey.
  Nothing else about a parcel is ever shown (D8, D25). Parcels stacked on
  the same spot are listed after the first, in a scrolling list. The words
  come from parcels/parcel-panel.ts.
-->
<script lang="ts">
  import type { ParcelPanel } from '../parcels/parcel-panel';
  import { splitIds } from './format';
  import Icon from './Icon.svelte';
  import ParcelLineSwatch from './ParcelLineSwatch.svelte';

  interface Props {
    panel: ParcelPanel;
  }

  let { panel }: Props = $props();
</script>

{#if panel.kind === 'parcels'}
  <section class="parcel" aria-label="Parcel">
    <p class="kicker"><ParcelLineSwatch width={30} height={20} />Property lines</p>
    <h3>{panel.first.owner}</h3>
    <dl>
      {#each panel.first.facts as fact (fact.label)}
        <dt>{fact.label}</dt>
        <dd>{fact.value}</dd>
      {/each}
    </dl>
    {#if panel.others.length}
      <p class="others-title">{panel.others.length === 1 ? '1 more parcel' : `${panel.others.length} more parcels`} at this spot</p>
      <ul class="others">
        {#each panel.others as line, i (i)}
          <li>{#each splitIds(line) as piece, j (j)}{#if piece.id}<span class="nb">{piece.text}</span>{:else}{piece.text}{/if}{/each}</li>
        {/each}
      </ul>
    {/if}
    <p class="survey">{panel.survey}</p>
  </section>
{:else}
  <section class="parcel plain" aria-label="Property lines">
    <div class="headline">
      <Icon name={panel.kind === 'gap' ? 'gap' : 'no-lines'} size={26} />
      <h3>{panel.title}</h3>
    </div>
    {#if panel.text}
      <p>{panel.text}</p>
    {/if}
  </section>
{/if}

<style>
  .parcel {
    margin: 0;
  }

  .kicker {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 2px;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  h3 {
    margin: 0 0 10px;
    font-size: 1.3rem;
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 14px;
    margin: 0;
  }

  dt {
    color: var(--text-muted);
    font-size: 0.9rem;
    padding-top: 2px;
  }

  dd {
    margin: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .others-title {
    margin: 14px 0 4px;
    font-weight: 700;
  }

  .others {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 12em;
    overflow-y: auto;
    border-top: 1px solid var(--line);
    font-size: 0.92rem;
  }

  .others li {
    padding: 5px 0;
    border-bottom: 1px solid var(--line);
  }

  .nb {
    white-space: nowrap;
  }

  .survey {
    margin: 14px 0 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .headline {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .plain h3 {
    margin: 0;
    font-size: 1.15rem;
  }

  .plain p {
    margin: 8px 0 0;
  }
</style>
