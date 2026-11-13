<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!-- Overlays on or off, the public land legend, and each installed layer's source and date. -->
<script lang="ts">
  import type { InstalledLayers } from '../map/installed';
  import { PUBLIC_LAND_LAYER, categoryLabels } from '../map/public-land';
  import type { CategoryList } from '../map/data-session';
  import { publicLandPalette } from '../map/style/palette';
  import { formatDate } from './format';

  interface Props {
    installed: InstalledLayers;
    publicLandOn: boolean;
    categories: CategoryList | null;
    onTogglePublicLand: (on: boolean) => void;
    onOpenSources: () => void;
  }

  let { installed, publicLandOn, categories, onTogglePublicLand, onOpenSources }: Props = $props();

  const publicLand = $derived(installed.get(PUBLIC_LAND_LAYER));

  /** Unique source names and the newest data date across a layer's archives. */
  function layerSummary(layer: string) {
    const l = installed.get(layer);
    if (!l) return { names: [] as string[], dates: [] as string[], counties: [] as string[] };
    const names = [...new Set(l.archives.flatMap((a) => a.meta.sources.map((s) => s.name)))];
    const dates = [...new Set(l.archives.flatMap((a) => a.meta.sources.map((s) => s.dataDate)).filter(Boolean))].sort();
    const counties = l.archives.map((a) => a.meta.countyName);
    return { names, dates, counties };
  }
</script>

<section>
  <h3>Overlays</h3>
  {#if publicLand}
    <label class="toggle">
      <input type="checkbox" checked={publicLandOn} onchange={(e) => onTogglePublicLand(e.currentTarget.checked)} />
      <span>Public land</span>
    </label>
    {#if publicLandOn && categories}
      <ul class="legend" aria-label="Public land legend">
        {#each categories.categories as cat (cat)}
          <li>
            <span class="swatch" style:--c={publicLandPalette[cat]}></span>
            {categoryLabels[cat]}
          </li>
        {/each}
      </ul>
      {#if !categories.exact}
        <p class="muted">The public land file does not list its categories, so every category is shown.</p>
      {/if}
      <p class="muted">Public land is not always open to hunting. Tap an area to see what is known.</p>
    {/if}
  {:else}
    <p class="muted">Public land is not installed.</p>
  {/if}
</section>

<section>
  <h3>Installed layers</h3>
  {#if installed.size === 0}
    <p class="muted">No map data is installed.</p>
  {/if}
  <ul class="layers">
    {#each [...installed.values()] as layer (layer.layer)}
      {@const s = layerSummary(layer.layer)}
      <li>
        <strong>{layer.title}</strong>
        <div class="muted">{s.counties.join(', ')}</div>
        <div>Source: {s.names.join('; ')}</div>
        <div>Data date: {s.dates.length ? s.dates.map(formatDate).join(', ') : 'not stated'}</div>
      </li>
    {/each}
  </ul>
  <button class="wide" onclick={onOpenSources}>Sources and licenses</button>
</section>

<style>
  section + section {
    margin-top: 16px;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--touch);
    cursor: pointer;
    font-weight: 600;
  }

  .toggle input {
    width: 24px;
    height: 24px;
    margin: 0;
    accent-color: var(--accent);
  }

  .legend {
    list-style: none;
    margin: 4px 0 8px;
    padding: 0;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }

  .swatch {
    flex: none;
    width: 22px;
    height: 16px;
    border: 2px solid var(--c);
    background: color-mix(in srgb, var(--c) 30%, transparent);
    border-radius: 3px;
  }

  .layers {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
  }

  .layers li {
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    font-size: 0.95rem;
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 4px 0;
  }

  .wide {
    width: 100%;
    min-height: var(--touch);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-alt);
    cursor: pointer;
  }
</style>
