<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The position button on the map. Its three looks:
  - off: a plain ring, white button. A tap turns position on.
  - on, not following: a ring with a solid center in the app's green. A tap
    centers on the phone and follows again.
  - following: a solid green button with a white ring and center.
  While waiting for the first fix the center pulses.
-->
<script lang="ts">
  import type { FollowMode } from '../position/follow';
  import Icon from './Icon.svelte';

  interface Props {
    mode: FollowMode;
    /** Position is on but no fix has come yet. */
    waiting: boolean;
    onTap: () => void;
  }

  let { mode, waiting, onTap }: Props = $props();

  const label = $derived(
    mode === 'off' ? 'Show my position' : mode === 'free' ? 'Center the map on my position' : 'Following my position',
  );
</script>

<button
  class="locate {mode}"
  class:waiting
  onclick={onTap}
  aria-label={label}
  title={label}
  aria-pressed={mode === 'following'}
>
  <Icon name={mode === 'off' ? 'locate' : 'locate-fix'} size={30} />
</button>

<style>
  .locate {
    flex: none;
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

  .locate:active {
    background: var(--surface-alt);
  }

  .locate.free {
    color: var(--accent);
  }

  .locate.following {
    background: var(--accent);
    color: var(--accent-text);
  }

  .locate.waiting :global(.center) {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.15;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .locate.waiting :global(.center) {
      animation: none;
      opacity: 0.4;
    }
  }
</style>
