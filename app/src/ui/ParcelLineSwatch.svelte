<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!-- A short piece of property line for the legend: the map's colours, read from the palette. -->
<script lang="ts">
  import { parcelPalette } from '../map/style/palette';

  interface Props {
    width?: number;
    height?: number;
  }

  let { width = 36, height = 24 }: Props = $props();
</script>

<svg {width} {height} viewBox="0 0 36 24" aria-hidden="true">
  <rect x="0.5" y="0.5" width="35" height="23" rx="4" fill="#d9d4c4" />
  <path d="M3 18 15 6l18 4" fill="none" stroke={parcelPalette.casing} stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round" />
  <path d="M3 18 15 6l18 4" fill="none" stroke={parcelPalette.core} stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
