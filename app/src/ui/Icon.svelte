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
    | 'external'
    | 'locate'
    | 'locate-fix'
    | 'parcel'
    | 'caution'
    | 'gap'
    | 'weak-gps'
    | 'no-lines'
    | 'download'
    | 'pause'
    | 'resume'
    | 'trash'
    | 'check'
    | 'clock'
    | 'offline'
    | 'mobile-data'
    | 'retry'
    | 'frame'
    | 'show-area'
    | 'bigger'
    | 'smaller';
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
  {:else if name === 'locate' || name === 'locate-fix'}
    <!-- A sighting ring with four short marks, like a scope's reticle. With a
         solid center when the phone's position is known. -->
    <circle cx="12" cy="12" r="6.6" stroke-width="2.3" />
    <path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4" stroke-width="2.3" />
    {#if name === 'locate-fix'}
      <circle class="center" cx="12" cy="12" r="3.3" fill="currentColor" stroke="none" />
    {/if}
  {:else if name === 'parcel'}
    <!-- A plot of land with an uneven boundary and a dot inside it: you are in this parcel. -->
    <path d="M3.5 6.5 10 3.5l10.5 3-1.5 13-12.5 1z" stroke-width="2.2" />
    <circle cx="11.5" cy="12" r="2.6" fill="currentColor" stroke="none" />
  {:else if name === 'caution'}
    <!-- A warning triangle with an exclamation mark. -->
    <path d="M12 3 22 20.5H2z" stroke-width="2.3" />
    <path d="M12 9.5v5.2" stroke-width="2.6" />
    <circle cx="12" cy="17.6" r="1.3" fill="currentColor" stroke="none" />
  {:else if name === 'gap'}
    <!-- Two boundaries with a strip between them, like a road between fields. -->
    <path d="M7 2.5v19M17 2.5v19" stroke-width="2.4" />
    <path d="M12 4v3M12 10.5v3M12 17v3" stroke-width="1.8" />
  {:else if name === 'weak-gps'}
    <!-- A broken ring around a hollow center: the position is not known well enough. -->
    <circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 3" stroke-width="2.3" />
    <circle cx="12" cy="12" r="2.6" stroke-width="2" />
  {:else if name === 'no-lines'}
    <!-- A plot drawn in dashes: no property lines here. -->
    <path d="M4 5h16v14H4z" stroke-dasharray="3 2.6" stroke-width="2" />
    <path d="M9 12h6" stroke-width="2.2" />
  {:else if name === 'download'}
    <!-- An arrow dropping into an open tray: keep this on the phone. -->
    <path d="M12 3v11.5M7 9.8l5 5 5-5" stroke-width="2.5" />
    <path d="M3.5 15v3.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V15" stroke-width="2.3" />
  {:else if name === 'pause'}
    <rect x="5.5" y="4.5" width="4.5" height="15" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4.5" height="15" rx="1.2" fill="currentColor" stroke="none" />
  {:else if name === 'resume'}
    <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke-width="1.8" />
  {:else if name === 'trash'}
    <!-- A bin with its lid lifted a little. -->
    <path d="M3.5 6.5h17M9.5 6.5V3.8h5v2.7" stroke-width="2.2" />
    <path d="M6 6.5 7.2 20.2h9.6L18 6.5" stroke-width="2.2" />
    <path d="M10 10.5v6M14 10.5v6" stroke-width="1.8" />
  {:else if name === 'check'}
    <!-- A tick in a ring: done. -->
    <circle cx="12" cy="12" r="9.2" stroke-width="2.3" />
    <path d="m7.4 12.4 3.1 3.1 6.1-6.6" stroke-width="2.7" />
  {:else if name === 'clock'}
    <!-- A clock face: waiting its turn. -->
    <circle cx="12" cy="12" r="9.2" stroke-width="2.3" />
    <path d="M12 6.8v5.6l3.8 2.3" stroke-width="2.4" />
  {:else if name === 'offline'}
    <!-- Three arcs of a signal, crossed out: no connection. -->
    <path d="M2.8 9.2a13.5 13.5 0 0 1 18.4 0M6.2 12.8a8.6 8.6 0 0 1 11.6 0M9.4 16.3a3.9 3.9 0 0 1 5.2 0" stroke-width="2.1" />
    <circle cx="12" cy="19.6" r="1.4" fill="currentColor" stroke="none" />
    <path d="M4 3.2 20 20.8" stroke-width="2.6" />
  {:else if name === 'mobile-data'}
    <!-- One arrow up and one down, side by side: data going to and from the phone. -->
    <path d="M8 19.5V5M4.3 8.7 8 5l3.7 3.7" stroke-width="2.4" />
    <path d="M16 4.5V19M12.3 15.3 16 19l3.7-3.7" stroke-width="2.4" />
  {:else if name === 'retry'}
    <!-- An arrow going round: try again. -->
    <path d="M19.6 12.5A7.6 7.6 0 1 1 17.2 6.6" stroke-width="2.4" />
    <path d="M19.8 3.6v4.8H15" stroke-width="2.4" />
  {:else if name === 'frame'}
    <!-- Four corners of a frame around a spot: pick an area. -->
    <path d="M3.5 8.5v-5h5M15.5 3.5h5v5M20.5 15.5v5h-5M8.5 20.5h-5v-5" stroke-width="2.5" />
    <path d="M12 8.5v7M8.5 12h7" stroke-width="2.2" />
  {:else if name === 'show-area'}
    <!-- A dashed outline with a dot in it: where this download is. -->
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" stroke-dasharray="3.4 2.4" stroke-width="2.1" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  {:else if name === 'bigger'}
    <!-- Arrows out to two corners: take in more ground. -->
    <path d="M13.5 10.5 20 4M14.5 4H20v5.5M10.5 13.5 4 20M9.5 20H4v-5.5" stroke-width="2.4" />
  {:else if name === 'smaller'}
    <!-- Arrows in from two corners: take in less ground. -->
    <path d="M20 4l-6.5 6.5M13.5 5v5.5H19M4 20l6.5-6.5M10.5 19v-5.5H5" stroke-width="2.4" />
  {/if}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
