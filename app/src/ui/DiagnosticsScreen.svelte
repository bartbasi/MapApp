<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!-- The frame test, one tap, and a few facts that help read its result. -->
<script lang="ts">
  import type { FrameTestResult } from '../map/frame-test';
  import type { TileStats } from '../map/tile-protocol';

  interface Props {
    platform: string;
    result: FrameTestResult | null;
    resultContext: string;
    tiles: TileStats;
    onRun: () => void;
    canRun: boolean;
  }

  let { platform, result, resultContext, tiles, onRun, canRun }: Props = $props();
</script>

<h3>Frame test</h3>
<p>
  Moves the map on a fixed 15 second tour (pan, zoom, rotate) with the current base view and overlays, and measures
  how smoothly it draws. The panel closes while the test runs and comes back with the result.
</p>
<button class="run" onclick={onRun} disabled={!canRun}>Run frame test</button>
{#if !canRun}
  <p class="muted">No map data is installed, so there is nothing to test.</p>
{/if}

{#if result}
  <dl>
    <dt>Average</dt>
    <dd>{result.avgFps} frames per second</dd>
    <dt>Worst 1 percent</dt>
    <dd>{result.worst1pctFps} frames per second</dd>
    <dt>Frames over 33 ms</dt>
    <dd>{result.framesOver33ms} of {result.frames}</dd>
    <dt>Tour length</dt>
    <dd>{result.seconds} s</dd>
    <dt>Tiles finished after stop</dt>
    <dd>{result.settleMs === null ? 'not within 60 s' : `${result.settleMs} ms`}</dd>
  </dl>
  <p class="muted">{resultContext}</p>
{/if}

<h3>Tile reads</h3>
<p>{tiles.requested} requested, {tiles.failed} failed{tiles.lastError ? `. Last error: ${tiles.lastError}` : ''}</p>
<p class="muted">Running on: {platform}. Screen {window.innerWidth} by {window.innerHeight}, pixel ratio {window.devicePixelRatio}.</p>

<style>
  h3 {
    margin: 4px 0 4px;
    font-size: 1.05rem;
    font-weight: 700;
  }

  h3 + p {
    margin-top: 0;
  }

  p {
    margin: 4px 0 10px;
  }

  .run {
    width: 100%;
    min-height: 56px;
    border: 0;
    border-radius: var(--radius);
    background: var(--accent);
    color: var(--accent-text);
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
  }

  .run:active {
    filter: brightness(1.2);
  }

  .run:disabled {
    background: #8a8478;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    margin: 14px 0 4px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface-alt);
  }

  dd {
    font-weight: 600;
  }

  .run + p,
  dl + p {
    margin-bottom: 18px;
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9rem;
  }
</style>
