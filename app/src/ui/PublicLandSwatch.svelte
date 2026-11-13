<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  A small picture of public land as the map draws it: the fill, the band
  inside the edge, the edge line with its dash, and the hatch for closed or
  restricted access. Every number comes from the map palette, so the legend
  matches the map.
-->
<script lang="ts" module>
  let next = 0;
</script>

<script lang="ts">
  import type { Access, PublicLandCategory } from '../map/public-land';
  import { basePalette, publicLandDash, publicLandPalette, publicLandStyle as s } from '../map/style/palette';

  interface Props {
    /** The category, or null for a neutral swatch in the access key. */
    category: PublicLandCategory | null;
    access?: Access;
    width?: number;
    height?: number;
  }

  let { category, access = 'open', width = 44, height = 30 }: Props = $props();

  const id = `pls-${next++}`;
  const color = $derived(category ? publicLandPalette[category] : '#4a463f');
  const dash = $derived(category ? publicLandDash[category].map((d) => d * s.outlineWidth).join(' ') : '');
  const band = 7;
  const hatchGap = $derived(access === 'closed' ? s.hatchClosedSpacing : s.hatchRestrictedSpacing);
  const hatched = $derived(access === 'closed' || access === 'restricted');
</script>

<svg {width} {height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
  {#if hatched}
    <defs>
      <!-- The same line spacing and widths as the map's hatch image (style/images.ts). -->
      <pattern id={id} width={hatchGap} height={hatchGap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect x="0" y="0" width="1.3" height={hatchGap} fill={s.hatchDark} fill-opacity={s.hatchDarkOpacity} />
        <rect x="1.3" y="0" width="1" height={hatchGap} fill={s.hatchLight} fill-opacity={s.hatchLightOpacity} />
      </pattern>
    </defs>
  {/if}
  <rect x="0" y="0" {width} {height} rx="4" fill={basePalette.land} />
  <rect x="0" y="0" {width} {height} rx="4" fill={color} fill-opacity={s.fillOpacity} />
  {#if hatched}
    <rect x="0" y="0" {width} {height} rx="4" fill={`url(#${id})`} />
  {/if}
  <rect
    x={band / 2 + 1}
    y={band / 2 + 1}
    width={width - band - 2}
    height={height - band - 2}
    rx="2"
    fill="none"
    stroke={color}
    stroke-opacity={s.bandOpacity}
    stroke-width={band}
  />
  <rect
    x={s.outlineWidth / 2}
    y={s.outlineWidth / 2}
    width={width - s.outlineWidth}
    height={height - s.outlineWidth}
    rx="4"
    fill="none"
    stroke={color}
    stroke-width={s.outlineWidth}
    stroke-dasharray={dash}
  />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
