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
  import Icon from './Icon.svelte';

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
      <button class="icon" onclick={onBack} aria-label="Back"><Icon name="back" /></button>
    {/if}
    <h2>{title}</h2>
    <button class="icon" onclick={onClose} aria-label="Close"><Icon name="close" /></button>
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
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.3);
    z-index: 10;
    padding-left: var(--inset-left);
    padding-right: var(--inset-right);
  }

  header {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 60px;
    padding: 6px 6px 6px 16px;
    border-bottom: 1px solid var(--line);
    flex: none;
  }

  header:has(.icon:first-child) {
    padding-left: 6px;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    line-height: 1.2;
  }

  .icon {
    flex: none;
    width: var(--touch);
    height: var(--touch);
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: var(--surface-alt);
    cursor: pointer;
  }

  .icon:active {
    background: var(--line);
  }

  .body {
    overflow-y: auto;
    padding: 14px 16px calc(20px + var(--inset-bottom));
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
      border-left: 1px solid var(--line-strong);
      box-shadow: none;
      padding-left: 0;
      padding-top: var(--inset-top);
    }
  }
</style>
