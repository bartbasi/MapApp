<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The map screen. Holds the app's state (base view, overlays, which panel is
  open, the tapped site) and passes it to the map and the panels. The map is
  created once and never re-created, so a fold, an unfold or a panel opening
  keeps the camera where it is.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { detectPlatform } from '../platform';
  import type { LngLat } from 'maplibre-gl';
  import type { ArchiveSource } from '../platform/archive-meta';
  import type { Platform } from '../platform/platform';
  import { loadDataSession, presentPublicLandCategories, type CategoryList, type DataSession } from '../map/data-session';
  import { buildTour, runFrameTest, tourArea, type FrameTestResult } from '../map/frame-test';
  import { MapView, registerTileProtocol, tileStats } from '../map/map-view';
  import { PUBLIC_LAND_LAYER, type PublicLandSite } from '../map/public-land';
  import { availableBaseViews, effectiveBaseView, type BaseView, type StyleOptions } from '../map/style/build-style';
  import { glyphsUrl } from '../map/style/fonts';
  import BaseViewSwitch from './BaseViewSwitch.svelte';
  import Icon from './Icon.svelte';
  import DiagnosticsScreen from './DiagnosticsScreen.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import Panel from './Panel.svelte';
  import PublicLandDetails from './PublicLandDetails.svelte';
  import SourcesScreen from './SourcesScreen.svelte';

  type PanelName = 'layers' | 'details' | 'sources' | 'diagnostics';

  let platform = $state.raw<Platform | null>(null);
  let mapView: MapView | null = null;
  let mapContainer: HTMLDivElement;

  let session = $state.raw<DataSession | null>(null);
  let loadError = $state('');
  let baseView = $state<BaseView>('map');
  let publicLandOn = $state(true);
  let panel = $state<PanelName | null>(null);
  let site = $state<PublicLandSite | null>(null);
  let bearing = $state(0);
  let categories = $state.raw<CategoryList | null>(null);
  let frameRunning = $state(false);
  let frameResult = $state.raw<FrameTestResult | null>(null);
  let frameContext = $state('');
  let tilesSnapshot = $state({ ...tileStats });

  const installed = $derived(session?.installed ?? new Map());
  const views = $derived(availableBaseViews(installed));
  const shownView = $derived(effectiveBaseView(baseView, installed));

  function styleOptions(): StyleOptions {
    return {
      base: baseView,
      overlays: { publicland: publicLandOn },
      installed,
      glyphs: glyphsUrl(location.origin),
      selection: panel === 'details' && site ? { name: site.name, manager: site.manager } : null,
    };
  }

  onMount(() => {
    let cancelled = false;
    (async () => {
      try {
        platform = detectPlatform();
        const s = await loadDataSession(platform);
        if (cancelled) return;
        session = s;
        registerTileProtocol(s.resolver);
        mapView = new MapView(mapContainer, styleOptions(), {
          onPublicLandTap: (tapped, at) => {
            if (frameRunning) return;
            if (tapped) {
              site = tapped;
              panel = 'details';
              void revealUnderSheet(at);
            } else if (panel === 'details') {
              panel = null;
              site = null;
            }
          },
          onBearingChange: (b) => (bearing = b),
        });
        // A handle for checks in a desktop browser during development only.
        if (import.meta.env.DEV) Object.assign(window, { __mapapp: { map: mapView.map, tileStats, session: s } });
        if (s.installed.has(PUBLIC_LAND_LAYER)) categories = await presentPublicLandCategories(s);
      } catch (e) {
        console.error(e);
        loadError = e instanceof Error ? e.message : String(e);
      }
    })();
    return () => {
      cancelled = true;
      mapView?.destroy();
    };
  });

  // Redraw the style when a choice changes. The camera is untouched.
  $effect(() => {
    const opts = styleOptions();
    mapView?.update(opts);
  });

  /**
   * On a narrow screen the details sheet covers the lower part of the map.
   * Once it is open, move the map so the tapped spot shows above it.
   */
  async function revealUnderSheet(at: LngLat) {
    await tick();
    if (!mapView || !window.matchMedia('(max-width: 599px)').matches) return;
    const sheet = document.querySelector<HTMLElement>('aside.panel');
    if (sheet) mapView.reveal(at, sheet.offsetHeight);
  }

  /** Every source of the installed public land archives, once each, for the details panel. */
  const publicLandSources = $derived.by(() => {
    const seen = new Map<string, ArchiveSource>();
    for (const a of installed.get(PUBLIC_LAND_LAYER)?.archives ?? []) {
      for (const src of a.meta.sources) seen.set(`${src.name}|${src.credit}`, src);
    }
    return [...seen.values()];
  });

  function open(name: PanelName) {
    if (name === 'diagnostics') tilesSnapshot = { ...tileStats };
    panel = name;
  }

  function close() {
    panel = null;
    site = null;
  }

  async function frameTest() {
    const s = session;
    if (!mapView || !s || frameRunning) return;
    const area = tourArea(s.installed);
    if (!area) return;
    frameRunning = true;
    panel = null;
    await tick();
    try {
      const result = await runFrameTest(mapView.map, buildTour(area.bounds, area.minzoom, area.maxzoom));
      const context = {
        base: shownView,
        overlays: { publicland: publicLandOn && s.installed.has(PUBLIC_LAND_LAYER) },
        platform: platform?.kind ?? 'unknown',
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        pixelRatio: window.devicePixelRatio,
        tileReads: tileStats.requested,
        tileFailures: tileStats.failed,
      };
      console.log('FRAME_TEST ' + JSON.stringify({ ...result, ...context }));
      frameResult = result;
      frameContext = `Base view ${context.base}, public land ${context.overlays.publicland ? 'on' : 'off'}, ${context.viewport} at pixel ratio ${context.pixelRatio}.`;
    } finally {
      frameRunning = false;
      open('diagnostics');
    }
  }

  const panelTitles: Record<PanelName, string> = {
    layers: 'Layers',
    details: 'Public land',
    sources: 'Sources and licenses',
    diagnostics: 'Diagnostics',
  };
</script>

<div class="app">
  <div class="map-area">
    <div class="map" bind:this={mapContainer}></div>

    <div class="top-left">
      <BaseViewSwitch value={shownView} available={views} onChange={(v) => (baseView = v)} />
    </div>

    <div class="top-right">
      <button class="round" onclick={() => (panel === 'layers' ? close() : open('layers'))} aria-label="Layers" aria-pressed={panel === 'layers'}>
        <Icon name="layers" size={26} />
      </button>
      {#if Math.abs(bearing) > 0.5}
        <button class="round" onclick={() => mapView?.resetNorth()} aria-label="Point north up">
          <!-- A compass needle: the dark half with the N points north. -->
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" style:transform={`rotate(${-bearing}deg)`}>
            <path d="M12 1.5 16.5 12h-9z" fill="#14130f" />
            <path d="M12 22.5 7.5 12h9z" fill="#ffffff" stroke="#14130f" stroke-width="1.4" stroke-linejoin="round" />
          </svg>
        </button>
      {/if}
    </div>

    {#if loadError}
      <div class="notice" role="alert">The map data could not be loaded: {loadError}</div>
    {:else if session && session.entries.length === 0}
      <div class="notice">No map data is installed.</div>
    {/if}
    {#if frameRunning}
      <div class="notice small">Frame test running, 15 seconds. Please do not touch the screen.</div>
    {/if}
  </div>

  {#if panel}
    <!-- A new panel starts scrolled to the top. A fold does not change the key, so it keeps its place. -->
    {#key panel}
    <Panel
      title={panel === 'details' && site?.name ? site.name : panelTitles[panel]}
      onClose={close}
      onBack={panel === 'sources' ? () => open('layers') : panel === 'diagnostics' ? () => open('sources') : undefined}
    >
      {#if panel === 'layers'}
        <LayersPanel
          {installed}
          {publicLandOn}
          {categories}
          onTogglePublicLand={(on) => (publicLandOn = on)}
          onOpenSources={() => open('sources')}
        />
      {:else if panel === 'details' && site}
        <PublicLandDetails {site} sources={publicLandSources} />
      {:else if panel === 'sources'}
        <SourcesScreen entries={session?.entries ?? []} onOpenDiagnostics={() => open('diagnostics')} />
      {:else if panel === 'diagnostics'}
        <DiagnosticsScreen
          platform={platform?.kind ?? 'unknown'}
          result={frameResult}
          resultContext={frameContext}
          tiles={tilesSnapshot}
          onRun={frameTest}
          canRun={installed.size > 0}
        />
      {/if}
    </Panel>
    {/key}
  {/if}
</div>

<style>
  .app {
    position: fixed;
    inset: 0;
    display: flex;
    background: #3b3d3a;
  }

  .map-area {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .map {
    position: absolute;
    inset: 0;
  }

  .top-left,
  .top-right {
    position: absolute;
    top: calc(var(--inset-top) + var(--gap));
    z-index: 5;
    display: flex;
    gap: 8px;
  }

  .top-left {
    left: calc(var(--inset-left) + var(--gap));
  }

  .top-right {
    right: calc(var(--inset-right) + var(--gap));
    flex-direction: column;
  }

  .round {
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

  .notice {
    position: absolute;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    max-width: calc(100% - 32px);
    padding: 12px 16px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    z-index: 4;
    text-align: center;
  }

  .notice.small {
    top: auto;
    bottom: calc(var(--inset-bottom) + 48px);
    font-size: 0.9rem;
  }

  /* Wide screen: the panel sits beside the map, so the right-hand buttons
     keep clear of the system bar only when no panel is open. */
  @media (min-width: 600px) {
    .app:has(:global(.panel)) .top-right {
      right: var(--gap);
    }
  }
</style>
