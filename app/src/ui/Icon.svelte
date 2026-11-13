<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  Every icon in the app, drawn for MapApp on a 24 by 24 grid. Lines use the
  current text color, so an icon takes the color of the button it sits in.
-->
<script lang="ts" module>
  export type IconName =
    | 'layers'
    | 'close'
    | 'back'
    | 'chevron'
    | 'map'
    | 'aerial'
    | 'hybrid'
    | 'no-hunting'
    | 'permit'
    | 'ask'
    | 'info'
    | 'external';
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
  }

  let { name, size = 24 }: Props = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="2.2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {#if name === 'layers'}
    <!-- Three stacked sheets, seen at an angle. -->
    <path d="M12 3.5 21 8l-9 4.5L3 8z" fill="currentColor" stroke-width="1.6" />
    <path d="m4.5 12.2 7.5 3.8 7.5-3.8" />
    <path d="m4.5 16.2 7.5 3.8 7.5-3.8" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6 6 18" stroke-width="2.6" />
  {:else if name === 'back'}
    <path d="M19 12H5.5M11 6l-6 6 6 6" stroke-width="2.6" />
  {:else if name === 'chevron'}
    <path d="m9 5.5 6.5 6.5L9 18.5" stroke-width="2.6" />
  {:else if name === 'map'}
    <!-- A folded paper map with a road across it. -->
    <path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" />
    <path d="M8.5 4v13.5M15.5 6.5V20" stroke-width="1.6" />
  {:else if name === 'aerial'}
    <!-- A photo frame over fields: rows of crops and a woodlot. -->
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M3 13.5 13.5 3M3 19.5 19.5 3M9 21l12-12" stroke-width="1.5" />
    <circle cx="16.5" cy="16.5" r="3" fill="currentColor" stroke="none" />
  {:else if name === 'hybrid'}
    <!-- The photo frame with two crossing roads drawn over it. -->
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M3 9 9 3M15 21l6-6" stroke-width="1.3" opacity="0.7" />
    <path d="M3 13h18M13 3v18" stroke-width="3.2" stroke-linecap="butt" />
  {:else if name === 'no-hunting'}
    <!-- A circle with a bar through it. -->
    <circle cx="12" cy="12" r="9" stroke-width="2.6" />
    <path d="m5.6 5.6 12.8 12.8" stroke-width="2.6" />
  {:else if name === 'permit'}
    <!-- A permit card with a punched corner and lines of text. -->
    <rect x="3" y="5" width="18" height="14" rx="2" stroke-width="2.4" />
    <path d="M7 10h6M7 14h10" stroke-width="2.2" />
    <circle cx="17" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
  {:else if name === 'ask'}
    <!-- A question mark in a speech bubble: ask first. -->
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 14.5z" stroke-width="2.2" />
    <path d="M9.6 8.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5" stroke-width="2" />
    <circle cx="12" cy="14.4" r="1.1" fill="currentColor" stroke="none" />
  {:else if name === 'info'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none" />
  {:else if name === 'external'}
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke-width="2" />
  {/if}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
