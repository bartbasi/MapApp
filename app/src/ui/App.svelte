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
  import type { LngLat, Map as MapLibreMap } from 'maplibre-gl';
  import type { DownloadService } from '../downloads/contract';
  import type { Bounds } from '../map/tile-math';
  import type { ArchiveSource } from '../platform/archive-meta';
  import type { Platform } from '../platform/platform';
  import { loadDataSession, presentPublicLandCategories, reloadDataSession, type CategoryList, type DataSession } from '../map/data-session';
  import { buildTour, runFrameTest, tourArea, type FrameTestResult } from '../map/frame-test';
  import { MapView, registerTileProtocol, tileStats, type MapTap } from '../map/map-view';
  import { PUBLIC_LAND_LAYER, sourcesForSite, type PublicLandSite } from '../map/public-land';
  import { PARCELS_LAYER, availableBaseViews, effectiveBaseView, type BaseView, type StyleOptions } from '../map/style/build-style';
  import { glyphsUrl } from '../map/style/fonts';
  import { PARCEL_RELATION_SOURCE, PARCEL_SELECTED_SOURCE } from '../map/style/parcels';
  import { OwnerMask, maskRequested } from '../parcels/owner-text';
  import { parcelPanel } from '../parcels/parcel-panel';
  import { isNamedParcel } from '../parcels/parcel-record';
  import type { LngLat as ParcelPoint, ParcelLookup } from '../parcels/parcel-source';
  import { ParcelTracker, type TrackerState } from '../parcels/parcel-tracker';
  import { readoutView } from '../parcels/readout-view';
  import { EMPTY_RELATION } from '../parcels/relation-features';
  import { StoredParcelSource, parcelArchivesFrom } from '../parcels/stored-parcel-source';
  import { createPositionSource } from '../position';
  import { markerData } from '../position/marker';
  import type { PositionFix } from '../position/types';
  import { PositionStore, type PositionSnapshot } from '../position/store';
  import ParcelDetails from './ParcelDetails.svelte';
  import BaseViewSwitch from './BaseViewSwitch.svelte';
  import Icon from './Icon.svelte';
  import DiagnosticsScreen from './DiagnosticsScreen.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import LocateButton from './LocateButton.svelte';
  import Panel from './Panel.svelte';
  import PositionMessage from './PositionMessage.svelte';
  import PositionReadout from './PositionReadout.svelte';
  import PublicLandDetails from './PublicLandDetails.svelte';
  import SourcesScreen from './SourcesScreen.svelte';
  import AreaOverlay from './downloads/AreaOverlay.svelte';
  import DownloadInvite from './downloads/DownloadInvite.svelte';
  import DownloadsButton from './downloads/DownloadsButton.svelte';
  import DownloadsScreen from './downloads/DownloadsScreen.svelte';
  import { connectDownloads } from './downloads/connect';
  import { DownloadsUi } from './downloads/downloads-ui.svelte';
  import { zoomFrame } from './downloads/frame-zoom';

  import { backStep, type PanelName } from './back';
  import { DOWNLOAD_AREAS_SOURCE } from '../map/style/download-areas';

  // The platform is known at once; the position store needs it before the map exists.
  const platformImpl = detectPlatform();
  const position = new PositionStore(createPositionSource(platformImpl.kind));
  let pos = $state.raw<PositionSnapshot>(position.snapshot);
  const messageContext = { android: platformImpl.kind === 'android', canOpenSettings: platformImpl.settings.canOpen };

  let platform = $state.raw<Platform | null>(null);
  /** Height of the map's own bottom controls (scale bar, credit line), so the position controls sit above them. */
  let chromeBottom = $state(28);
  let mapView: MapView | null = null;
  let mapContainer: HTMLDivElement;
  /** The MapLibre map, once made, for the download screens' frame and outlines. */
  let mapRef = $state.raw<MapLibreMap | null>(null);

  // Offline downloads (Step 3). Null where the platform cannot download; then nothing about downloads shows.
  let downloads = $state.raw<DownloadService | null>(null);
  const downloadsUi = new DownloadsUi();

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

  // Property lines. The source reads the installed parcel archives; the
  // tracker keeps the position readout up to date (D26).
  let parcelsOn = $state(true);
  let parcelSource: StoredParcelSource | null = null;
  let tracker: ParcelTracker | null = null;
  let trackerState = $state.raw<TrackerState | null>(null);
  /** The parcel lookup for the tapped point, shown in the details panel. */
  let tapped = $state.raw<{ lookup: ParcelLookup; at: ParcelPoint } | null>(null);
  let tapSeq = 0;

  // Owner names can be masked for evidence screenshots, in two cases only:
  // a development build, or a test build made with VITE_MAPAPP_MASK_OWNERS=1
  // (for screenshots on the emulator, where there is no query string to set).
  // Any other build creates the mask as not allowed, so it never masks.
  const maskBuild = import.meta.env.VITE_MAPAPP_MASK_OWNERS === '1';
  const ownerMask = new OwnerMask(
    import.meta.env.DEV || maskBuild,
    maskBuild || (import.meta.env.DEV && maskRequested(location.search)),
  );
  let masked = $state(ownerMask.on);
  ownerMask.subscribe((on) => (masked = on));

  const installed = $derived(session?.installed ?? new Map());
  const views = $derived(availableBaseViews(installed));
  const shownView = $derived(effectiveBaseView(baseView, installed));
  const parcelLayer = $derived(installed.get(PARCELS_LAYER));
  const countiesWithLines = $derived(((parcelLayer?.archives ?? []) as { meta: { countyName: string } }[]).map((a) => a.meta.countyName.replace(/, Illinois$/, '')));
  /** The readout's words, or null with no parcel data installed (then only the GPS accuracy shows). */
  const readout = $derived(parcelLayer && trackerState ? readoutView(trackerState.readout, { masked, staleFix: pos.stale, fixTooOld: pos.tooOld, countiesWithLines }) : null);
  const parcelInfo = $derived(tapped ? parcelPanel(tapped.lookup, masked, countiesWithLines) : null);
  /** The parcel part of the details panel: shown alone, or under a public land site when it names a parcel. */
  const showParcelInfo = $derived(!!parcelInfo && (!site || parcelInfo.kind === 'parcels'));
  /** What a new download includes besides the map: the overlays that are on, and imagery when the base view shows it. */
  const layersOn = $derived(['basemap', ...(publicLandOn ? ['publicland'] : []), ...(parcelsOn ? ['parcels'] : []), ...(shownView !== 'map' ? ['aerial'] : [])]);

  function styleOptions(): StyleOptions {
    return {
      base: baseView,
      overlays: { publicland: publicLandOn, parcels: parcelsOn },
      installed,
      glyphs: glyphsUrl(location.origin),
      selection: panel === 'details' && site ? { name: site.name, manager: site.manager } : null,
    };
  }

  /**
   * A downloaded area became complete or was removed: the map reads the list
   * of what is on the phone again. The style follows `installed` by itself;
   * the tiles the map already holds are dropped, because a place that had
   * nothing a moment ago may have tiles now.
   *
   * The parcel source is not rebuilt. Parcel data is not hosted (D33), so a
   * download cannot add or remove a parcel archive. That must change here
   * before parcel data is ever offered as a download.
   */
  let archiveReload: Promise<void> = Promise.resolve();
  function archivesChanged(): Promise<void> {
    archiveReload = archiveReload.then(async () => {
      const current = session;
      if (!platform || !current) return;
      try {
        const next = await reloadDataSession(platform, current);
        session = next;
        await tick();
        mapView?.reloadTiles();
        categories = next.installed.has(PUBLIC_LAND_LAYER) ? await presentPublicLandCategories(next) : null;
      } catch (e) {
        console.error('the list of maps on this phone could not be read again:', e);
      }
    });
    return archiveReload;
  }

  onMount(() => {
    let cancelled = false;
    // The back press is answered from the start, before the map has loaded.
    const cleanups: (() => void)[] = [listenForBack()];
    (async () => {
      try {
        platform = platformImpl;
        void connectDownloads(platformImpl)
          .then((d) => {
            if (cancelled || !d) return;
            downloads = d;
            cleanups.push(d.onArchivesChanged(() => void archivesChanged()));
          })
          .catch((e) => console.warn('downloads are not available:', e));
        const s = await loadDataSession(platform);
        if (cancelled) return;
        session = s;
        registerTileProtocol(s.resolver);
        mapView = new MapView(mapContainer, styleOptions(), {
          onMapTap: (t) => void onMapTap(t),
          onBearingChange: (b) => (bearing = b),
          onUserMove: () => position.userMovedMap(),
        });
        const view = mapView;
        mapRef = view.map;
        const parcelArchives = parcelArchivesFrom(s.archives);
        if (parcelArchives.length > 0) {
          parcelSource = new StoredParcelSource(parcelArchives);
          const t = new ParcelTracker(parcelSource);
          tracker = t;
          cleanups.push(
            t.subscribe((st) => {
              trackerState = st;
              view.setLiveData(PARCEL_RELATION_SOURCE, st.relation);
            }),
            () => t.destroy(),
          );
        }
        // The tracker hears of a new fix, a fix going stale, or position off.
        // Not of compass turns or the age ticking, which change nothing for it.
        let lastFix: PositionFix | null = null;
        let lastStale = false;
        cleanups.push(
          position.subscribe((snap) => {
            pos = snap;
            view.setPosition(markerData(snap));
            const fix = snap.on ? snap.fix : null;
            if (fix !== lastFix || snap.stale !== lastStale) {
              lastFix = fix;
              lastStale = snap.stale;
              tracker?.update(fix, snap.stale);
            }
          }),
          position.onCamera((c) => view.centerOn(c.lng, c.lat, c.minZoom, coveredBottom())),
          watchBottomChrome(mapContainer),
        );
        // A handle for checks in a desktop browser during development only.
        if (import.meta.env.DEV) {
          const { devPositionHandle } = await import('../position/dev');
          Object.assign(window, {
            __mapapp: {
              map: mapView.map,
              tileStats,
              session: s,
              position: devPositionHandle(position, platformImpl.kind),
              /** Replaces every owner name on screen with OWNER NAME, for evidence screenshots. */
              maskOwners: (on = true) => ownerMask.set(on),
              parcels: { source: parcelSource, tracker, timings: () => tracker?.timings() ?? null },
            },
          });
        }
        if (s.installed.has(PUBLIC_LAND_LAYER)) categories = await presentPublicLandCategories(s);
      } catch (e) {
        console.error(e);
        loadError = e instanceof Error ? e.message : String(e);
      }
    })();
    return () => {
      cancelled = true;
      for (const c of cleanups) c();
      position.destroy();
      mapView?.destroy();
    };
  });

  /**
   * Keeps the position controls just above the map's scale bar and credit
   * line. The credit line wraps to two lines on a narrow screen with imagery,
   * so its height is measured, not assumed.
   */
  function watchBottomChrome(container: HTMLElement): () => void {
    const corners = ['.maplibregl-ctrl-bottom-left', '.maplibregl-ctrl-bottom-right']
      .map((sel) => container.querySelector<HTMLElement>(sel))
      .filter((el): el is HTMLElement => el !== null);
    const measure = () => {
      const h = Math.max(0, ...corners.map((el) => el.offsetHeight));
      chromeBottom = Math.ceil(h);
    };
    const observer = new ResizeObserver(measure);
    for (const el of corners) observer.observe(el);
    measure();
    return () => observer.disconnect();
  }

  function openSettings(page: 'app' | 'location') {
    void platformImpl.settings.open(page);
  }

  // Redraw the style when a choice changes. The camera is untouched.
  $effect(() => {
    const opts = styleOptions();
    mapView?.update(opts);
  });

  /**
   * The details panel takes room from the map. On a narrow screen it is a
   * sheet over the lower part of the map; on a wide screen it sits beside the
   * map, which gets narrower. Once it is open, move the map if the tapped spot
   * is now hidden or at the very edge.
   */
  async function revealUnderSheet(at: LngLat) {
    await tick();
    if (!mapView) return;
    mapView.reveal(at, sheetHeight());
  }

  /** How much of the map's bottom a panel covers: the sheet's height on a narrow screen, none on a wide one. */
  function sheetHeight(): number {
    const sheet = document.querySelector<HTMLElement>('aside.panel');
    const narrow = window.matchMedia('(max-width: 599px)').matches;
    return narrow && sheet ? sheet.offsetHeight : 0;
  }

  /**
   * How much of the map's bottom is covered where the marker would sit: a
   * bottom sheet, or the position readout and its buttons when they reach
   * across the middle of the map. Following keeps the marker clear of both.
   */
  function coveredBottom(): number {
    let overlay = 0;
    const controls = document.querySelector<HTMLElement>('.map-area .bottom');
    if (controls && mapContainer) {
      const map = mapContainer.getBoundingClientRect();
      const box = controls.getBoundingClientRect();
      const middle = map.left + map.width / 2;
      if (box.height > 0 && box.left <= middle && box.right >= middle) overlay = Math.max(0, map.bottom - box.top);
    }
    return Math.max(sheetHeight(), overlay);
  }

  /**
   * A single tap on the map. Public land comes from the map; parcels come
   * from the parcel source (never from what the map has drawn), only while
   * the property lines are on and the map is close enough to show them.
   */
  async function onMapTap(t: MapTap) {
    // While an area is being framed, a tap belongs to moving the map.
    if (frameRunning || (panel === 'downloads' && downloadsUi.mode === 'pick')) return;
    const seq = ++tapSeq;
    const at: ParcelPoint = { lng: t.at.lng, lat: t.at.lat };
    let lookup: ParcelLookup | null = null;
    const minZoom = parcelLayer?.minzoom ?? Infinity;
    if (parcelSource && parcelsOn && t.zoom >= minZoom) {
      try {
        lookup = await parcelSource.parcelsAt(at);
      } catch (e) {
        console.warn('the parcel lookup failed:', e);
        lookup = { at, coverage: 'read-error', parcels: [] };
      }
      // A later tap has taken over.
      if (seq !== tapSeq) return;
    }
    const namesParcel = !!lookup && lookup.coverage === 'ok' && lookup.parcels.some(isNamedParcel);
    if (t.site || namesParcel) {
      site = t.site;
      tapped = lookup ? { lookup, at } : null;
      panel = 'details';
      void revealUnderSheet(t.at);
    } else if (lookup && panel === null) {
      // Not in a parcel, or no property lines here: a short plain message.
      site = null;
      tapped = { lookup, at };
      panel = 'details';
    } else if (panel === 'details') {
      close();
    }
  }

  // The tapped parcel's outline, while its panel is open.
  let selectedKey = '';
  $effect(() => {
    const info = panel === 'details' && showParcelInfo ? parcelInfo : null;
    const point = tapped?.at;
    const key = info?.kind === 'parcels' && point ? `${info.first.county}|${info.first.pid}|${point.lng}|${point.lat}` : '';
    if (key === selectedKey) return;
    selectedKey = key;
    mapView?.setLiveData(PARCEL_SELECTED_SOURCE, EMPTY_RELATION);
    if (!key || info?.kind !== 'parcels' || !point || !parcelSource) return;
    const { pid, county } = info.first;
    parcelSource
      .outline(pid, county, point)
      .then((outline) => {
        if (selectedKey !== key || !outline) return;
        mapView?.setLiveData(PARCEL_SELECTED_SOURCE, { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: outline.lines, properties: {} }] });
      })
      .catch((e) => console.warn('the tapped parcel outline could not be read:', e));
  });

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

  /**
   * The system back gesture or button, for every panel (back.ts). The Android
   * shell calls window.mapappBack() and gives the press to the system only
   * when it returns false; in a browser the Escape key does the same.
   */
  function goBack(): boolean {
    const step = backStep(panel, downloadsUi.mode);
    if (step.kind === 'downloads-list') downloadsUi.mode = 'list';
    else if (step.kind === 'open') open(step.panel);
    else if (step.kind === 'close') close();
    return step.kind !== 'system';
  }

  function listenForBack(): () => void {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && goBack()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    Object.assign(window, { mapappBack: goBack });
    return () => {
      window.removeEventListener('keydown', onKey);
      if ((window as { mapappBack?: unknown }).mapappBack === goBack) delete (window as { mapappBack?: unknown }).mapappBack;
    };
  }

  function close() {
    if (panel === 'downloads') downloadsUi.mode = 'list';
    panel = null;
    site = null;
    tapped = null;
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
        overlays: { publicland: publicLandOn && s.installed.has(PUBLIC_LAND_LAYER), parcels: parcelsOn && s.installed.has(PARCELS_LAYER) },
        platform: platform?.kind ?? 'unknown',
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        pixelRatio: window.devicePixelRatio,
        tileReads: tileStats.requested,
        tileFailures: tileStats.failed,
      };
      console.log('FRAME_TEST ' + JSON.stringify({ ...result, ...context }));
      frameResult = result;
      frameContext = `Base view ${context.base}, public land ${context.overlays.publicland ? 'on' : 'off'}, property lines ${context.overlays.parcels ? 'on' : 'off'}, ${context.viewport} at pixel ratio ${context.pixelRatio}.`;
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
    downloads: 'Offline maps',
  };

  /** Moves the map so a download's rectangle shows, clear of the top controls and of a bottom sheet. */
  async function showArea(b: Bounds) {
    await tick();
    if (!mapView) return;
    mapView.map.resize();
    mapView.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 90, left: 24, right: 84, bottom: Math.max(sheetHeight(), 24) + 24 }, maxZoom: 16, duration: 600 });
  }
</script>

<div class="app">
  <div class="map-area" style:--chrome-bottom={`${chromeBottom}px`}>
    <div class="map" bind:this={mapContainer}></div>

    <div class="bottom">
      <PositionMessage store={position} context={messageContext} onOpenSettings={openSettings} />
      <div class="bottom-row">
        <div class="readout-slot"><PositionReadout store={position} view={readout} /></div>
        <LocateButton mode={pos.follow} waiting={pos.on && !pos.fix} onTap={() => position.tapLocate()} />
      </div>
    </div>

    <div class="top-left">
      <BaseViewSwitch value={shownView} available={views} onChange={(v) => (baseView = v)} />
    </div>

    <div class="top-right">
      <button class="round" onclick={() => (panel === 'layers' ? close() : open('layers'))} aria-label="Layers" aria-pressed={panel === 'layers'}>
        <Icon name="layers" size={26} />
      </button>
      <!-- Hidden while an area is framed, so the frame can use the top of the map; the panel's own close button ends it. -->
      {#if downloads && !(panel === 'downloads' && downloadsUi.mode === 'pick')}
        <DownloadsButton service={downloads} pressed={panel === 'downloads'} onTap={() => (panel === 'downloads' ? close() : open('downloads'))} />
      {/if}
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

    {#if downloads && mapRef}
      <AreaOverlay
        map={mapRef}
        ui={downloadsUi}
        service={downloads}
        active={panel === 'downloads'}
        marker={pos.on && pos.fix ? { lng: pos.fix.lng, lat: pos.fix.lat, accuracyM: pos.fix.accuracyM } : null}
        setOutlines={(f) => mapView?.setLiveData(DOWNLOAD_AREAS_SOURCE, f)}
      />
      <DownloadInvite
        map={mapRef}
        {installed}
        service={downloads}
        view={shownView}
        offered={downloadsUi.offers?.map((o) => o.bounds) ?? null}
        hidden={panel === 'downloads' || frameRunning}
        onOpen={() => open('downloads')}
        onShowMap={() => (baseView = 'map')}
        marker={pos.on && pos.fix ? { lng: pos.fix.lng, lat: pos.fix.lat, accuracyM: pos.fix.accuracyM } : null}
      />
    {/if}

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
      title={panel === 'details' ? (site ? site.name || panelTitles.details : parcelInfo?.kind === 'parcels' ? 'Parcel' : 'Property lines') : panel === 'downloads' && downloadsUi.mode === 'pick' ? 'Pick an area' : panelTitles[panel]}
      onClose={close}
      onBack={panel === 'sources' ? () => open('layers') : panel === 'diagnostics' ? () => open('sources') : panel === 'downloads' && downloadsUi.mode === 'pick' ? () => (downloadsUi.mode = 'list') : undefined}
    >
      {#if panel === 'layers'}
        <LayersPanel
          {installed}
          {publicLandOn}
          {categories}
          positionOn={pos.on}
          onTogglePosition={(on) => (on ? position.tapLocate() : position.turnOff())}
          onTogglePublicLand={(on) => (publicLandOn = on)}
          {parcelsOn}
          onToggleParcels={(on) => (parcelsOn = on)}
          onOpenSources={() => open('sources')}
        />
      {:else if panel === 'details' && (site || showParcelInfo)}
        {#if site}
          <PublicLandDetails {site} sources={sourcesForSite(site, publicLandSources)} />
        {/if}
        {#if parcelInfo && showParcelInfo}
          {#if site}<hr class="split" />{/if}
          <ParcelDetails panel={parcelInfo} />
        {/if}
      {:else if panel === 'downloads' && downloads}
        <DownloadsScreen
          service={downloads}
          ui={downloadsUi}
          {layersOn}
          linesWith={countiesWithLines}
          onShowArea={(b) => void showArea(b)}
          onZoom={(d) => mapRef && zoomFrame(mapRef, downloadsUi, d)}
        />
      {:else if panel === 'sources'}
        <SourcesScreen entries={session?.entries ?? []} areaNames={new Map((downloads?.areas() ?? []).map((a) => [a.record.id, a.record.name]))} onOpenDiagnostics={() => open('diagnostics')} />
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

  /* The position controls: the message card, then the accuracy line and the
     locate button, just above the scale bar and credit line. The map's own
     bottom controls already include the bottom inset. */
  .bottom {
    position: absolute;
    left: calc(var(--inset-left) + var(--gap));
    right: calc(var(--inset-right) + var(--gap));
    bottom: calc(var(--chrome-bottom) + 6px);
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .bottom > :global(*) {
    pointer-events: auto;
  }

  .bottom-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    pointer-events: none;
  }

  .bottom-row > :global(*) {
    pointer-events: auto;
  }

  .readout-slot {
    flex: 1;
    min-width: 0;
    pointer-events: none;
  }

  .readout-slot > :global(*) {
    pointer-events: auto;
  }

  /* Between a public land site and the parcel under it, in one panel. */
  .split {
    margin: 20px -16px 16px;
    border: 0;
    border-top: 6px solid var(--surface-alt);
  }

  @media (min-width: 600px) {
    .bottom {
      left: auto;
      width: min(420px, calc(100% - 2 * var(--gap)));
    }

    .app:has(:global(.panel)) .bottom {
      right: var(--gap);
    }
  }

  /* Wide screen: the panel sits beside the map, so the right-hand buttons
     keep clear of the system bar only when no panel is open. */
  @media (min-width: 600px) {
    .app:has(:global(.panel)) .top-right {
      right: var(--gap);
    }
  }
</style>
