<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!-- Overlays on or off, the public land legend, and each installed layer's source and date. -->
<script lang="ts">
  import type { InstalledLayers } from '../map/installed';
  import { PUBLIC_LAND_LAYER, categoryLabels } from '../map/public-land';
  import type { CategoryList } from '../map/data-session';
  import { formatDate } from './format';
  import Icon from './Icon.svelte';
  import PublicLandSwatch from './PublicLandSwatch.svelte';

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
    const counties = l.archives.map((a) => a.meta.countyName.replace(/, Illinois$/, ''));
    return { names, dates, counties };
  }
</script>

<section>
  {#if publicLand}
    <label class="toggle">
      <span class="toggle-text">Public land</span>
      <input type="checkbox" role="switch" checked={publicLandOn} onchange={(e) => onTogglePublicLand(e.currentTarget.checked)} />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
    </label>
    {#if publicLandOn && categories}
      <p class="warn"><Icon name="info" size={20} /> <span><strong>Public is not the same as open to hunting.</strong> Tap an area to see what is known.</span></p>

      <h3>Who manages it</h3>
      <ul class="legend" aria-label="Public land by who manages it">
        {#each categories.categories as cat (cat)}
          <li>
            <PublicLandSwatch category={cat} />
            <span>{categoryLabels[cat]}</span>
          </li>
        {/each}
      </ul>
      {#if !categories.exact}
        <p class="muted">The public land file does not list its categories, so every category is shown.</p>
      {/if}

      <h3>Access on foot</h3>
      <ul class="legend" aria-label="Access on foot">
        <li><PublicLandSwatch category={null} access="open" /><span>Open to the public</span></li>
        <li><PublicLandSwatch category={null} access="restricted" /><span>Restricted: check with the manager</span></li>
        <li><PublicLandSwatch category={null} access="closed" /><span>Closed to the public</span></li>
      </ul>
      <p class="muted">Boundaries come from public records and are not a legal survey.</p>
    {/if}
  {:else}
    <p class="muted">Public land is not installed.</p>
  {/if}
</section>

<section>
  <h3>Installed map data</h3>
  {#if installed.size === 0}
    <p class="muted">No map data is installed.</p>
  {/if}
  <ul class="layers">
    {#each [...installed.values()] as layer (layer.layer)}
      {@const s = layerSummary(layer.layer)}
      <li>
        <div class="layer-head"><strong>{layer.title}</strong><span class="muted">{s.counties.join(', ')}</span></div>
        <div class="muted">{s.names.join('; ')}, data of {s.dates.length ? s.dates.map(formatDate).join(', ') : 'unknown date'}</div>
      </li>
    {/each}
  </ul>
  <button class="wide" onclick={onOpenSources}><span>Sources and licenses</span><Icon name="chevron" /></button>
</section>

<style>
  section + section {
    margin-top: 20px;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }

  h3 {
    margin: 16px 0 6px;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  /* A large on/off switch. The real checkbox sits over it, invisible, so it keeps its keyboard and screen reader behavior. */
  .toggle {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    cursor: pointer;
  }

  .toggle-text {
    flex: 1;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .toggle input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .track {
    flex: none;
    width: 60px;
    height: 34px;
    padding: 3px;
    border-radius: 17px;
    background: #8a8478;
    transition: background 0.15s;
  }

  .thumb {
    display: block;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s;
  }

  .toggle input:checked + .track {
    background: var(--accent);
  }

  .toggle input:checked + .track .thumb {
    transform: translateX(26px);
  }

  .toggle input:focus-visible + .track {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .warn {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 4px 0 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface-alt);
    font-size: 0.95rem;
  }

  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    padding: 3px 0;
    line-height: 1.25;
  }

  .layers {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
  }

  .layers li {
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }

  .layer-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 6px 0;
  }

  .layers .muted {
    margin: 0;
  }

  .wide {
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
