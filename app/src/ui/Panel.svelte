<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The frame for every panel. On a narrow screen it is a bottom sheet over the
  map; on a wide screen it sits beside the map. The switch is pure CSS, so a
  fold or unfold keeps the panel, its scroll position and the map as they are.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    onClose: () => void;
    onBack?: (() => void) | undefined;
    children: Snippet;
  }

  let { title, onClose, onBack, children }: Props = $props();
</script>

<aside class="panel" aria-label={title}>
  <header>
    {#if onBack}
      <button class="icon" onclick={onBack} aria-label="Back">&#8592;</button>
    {/if}
    <h2>{title}</h2>
    <button class="icon" onclick={onClose} aria-label="Close">&#10005;</button>
  </header>
  <div class="body">
    {@render children()}
  </div>
</aside>

<style>
  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 62%;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: var(--radius) var(--radius) 0 0;
    box-shadow: var(--shadow);
    z-index: 10;
    padding-left: var(--inset-left);
    padding-right: var(--inset-right);
  }

  header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px 16px;
    border-bottom: 1px solid var(--line);
    flex: none;
  }

  header:has(.icon:first-child) {
    padding-left: 4px;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    line-height: 1.25;
  }

  .icon {
    flex: none;
    width: var(--touch);
    height: var(--touch);
    border: 0;
    border-radius: 50%;
    background: transparent;
    font-size: 1.25rem;
    cursor: pointer;
  }

  .icon:active {
    background: var(--surface-alt);
  }

  .body {
    overflow-y: auto;
    padding: 12px 16px calc(16px + var(--inset-bottom));
    -webkit-overflow-scrolling: touch;
  }

  /* Wide screen (the Fold 5 unfolded is about 768 dp): beside the map. */
  @media (min-width: 600px) {
    .panel {
      position: relative;
      flex: none;
      width: 360px;
      max-height: none;
      height: 100%;
      border-radius: 0;
      border-left: 1px solid var(--line);
      box-shadow: none;
      padding-left: 0;
      padding-top: var(--inset-top);
    }
  }
</style>
