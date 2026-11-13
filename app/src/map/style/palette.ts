// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Every color and line pattern the map style uses, in one place. The legend
// and the details panel read the public land entries from here too, so the
// map and its key cannot drift apart.
//
// Designed for a glance outdoors: open ground is pale, woods are a clear
// mid green, water is a saturated blue, roads go from white lanes to amber
// interstates, and the strong saturated hues are kept for public land.
// Contrast and color blindness results are in the comments next to each group.

/** The vector base map (the map view). */
export const basePalette = {
  // Ground. Open ground and fields are nearly the same pale tone, so woods stand out.
  land: '#f5f2e7',
  farmland: '#f2eedb',
  /** Woods against open ground is the first thing to read: lightness 80 against 95 (CIELAB). */
  wood: '#abcd94',
  woodEdge: '#74a35c',
  grass: '#e6ecd0',
  park: '#dde8c9',
  wetland: '#d2e5dc',
  wetlandEdge: '#8fbcae',
  residential: '#ebe6dc',
  built: '#e2dbd1',
  institution: '#e9e1d2',
  special: '#e4e0e6',
  sand: '#efe3bd',
  building: '#d2c9bc',
  // Water: fill, lines (river, creek, ditch) and its names.
  water: '#9ec7e6',
  waterLine: '#3f88c5',
  waterText: '#1c5a8c',
  // The county line is the hunting unit: a wide soft band with a dark dash-dot core.
  boundaryCounty: '#2f2b3a',
  boundaryCountyBand: '#9c8fb0',
  boundaryState: '#2f2b3a',
  boundaryLocal: '#9a9184',
  // Roads, from largest to smallest. Fills and their casings.
  motorway: '#f4b740',
  motorwayCasing: '#8a5a10',
  primaryRoad: '#fbe08c',
  primaryRoadCasing: '#94783a',
  majorRoad: '#ffffff',
  majorRoadCasing: '#5a534a',
  minorRoad: '#ffffff',
  minorRoadCasing: '#736b5f',
  /** Field lanes and tracks: dark brown dashes, easy to tell from paved roads. */
  track: '#6b4a2c',
  path: '#6f6658',
  rail: '#4a4642',
  runway: '#d0cac0',
  // Labels.
  labelText: '#26231f',
  labelHalo: '#ffffff',
  placeText: '#15130f',
  roadText: '#3a362f',
  parkText: '#3d5e2c',
  shieldText: '#ffffff',
  shieldCountyText: '#26231f',
} as const;

/**
 * A plain, muted base map drawn under the imagery, seen only where or when
 * there is no imagery (beyond a county's imagery, or zoomed out past it). It
 * is darker and grayer than the map view so it sits quietly beside imagery.
 */
export const plainPalette = {
  land: '#cfcdc0',
  wood: '#93ad83',
  water: '#7fa8c8',
  waterLine: '#5b8db5',
  road: '#f3f0e6',
  majorRoad: '#fff2c8',
} as const;

/**
 * Lines and names drawn over imagery in the hybrid view. Every line has a
 * dark casing and every name a dark halo, so they read over dark woods and
 * pale fields alike.
 */
export const imageryPalette = {
  background: '#3b3d3a',
  casing: '#141414',
  motorway: '#ffcc4d',
  majorRoad: '#fff1bf',
  minorRoad: '#ffffff',
  track: '#ffd9a8',
  waterLine: '#8fd0ff',
  boundaryCounty: '#ffffff',
  boundaryCountyBand: '#f0e6ff',
  labelText: '#ffffff',
  labelHalo: '#141414',
  waterText: '#c8ecff',
} as const;

/**
 * Public land, one color per managing category (see the archive contract in
 * pipeline/README.md). Kept clear of the base map's woods green, water blue
 * and road amber.
 *
 * Checked with scripts in the design notes (CIEDE2000 between the outline
 * colors, Machado 2009 simulation at full severity):
 * - normal vision: smallest difference 18.8 (county district and university)
 * - protanopia: 6.3 (land trust and other), next 11.5 (state and federal)
 * - deuteranopia: 4.7 (land trust and other), next 8.4 (state and federal)
 * - tritanopia: 7.3 (county district and local)
 * The pairs that come close are told apart by their outline dash
 * (publicLandDash), so color is never the only signal.
 * Outline contrast on the map's open ground: 3.7 (county district) to 9.4 (state).
 * Over imagery every outline sits on a white casing.
 */
export const publicLandPalette = {
  state: '#4b2a8a',
  county_district: '#cc5a0a',
  local: '#c2185b',
  university: '#7a4a1e',
  federal: '#1f5f99',
  ngo: '#0b8276',
  other: '#6b6b6b',
} as const;

/** A darker shade of each category color for site names: 7.0 to 13.0 contrast on white. */
export const publicLandTextPalette = {
  state: '#3b1f70',
  county_district: '#8f3c00',
  local: '#8e0f42',
  university: '#5c3612',
  federal: '#164672',
  ngo: '#075f56',
  other: '#4a4a4a',
} as const;

/**
 * Outline dash per category, in line widths. An empty list is a solid line.
 * Federal (long dashes), land trust (short dashes) and other (dots) differ in
 * pattern from the solid state, district, local and university outlines.
 */
export const publicLandDash: Record<keyof typeof publicLandPalette, readonly number[]> = {
  state: [],
  county_district: [],
  local: [],
  university: [],
  federal: [4, 2],
  ngo: [2, 1.5],
  other: [0.6, 1.6],
};

/**
 * How public land is drawn. The edge is a thin line in the category color;
 * inside it runs a wider translucent band of the same color, so the edge
 * reads over busy ground and over imagery. Closed and restricted land carry
 * a diagonal hatch over the fill.
 */
export const publicLandStyle = {
  /** Light enough that water and woods keep their own color inside public land. */
  fillOpacity: 0.12,
  fillOpacityOnImagery: 0.1,
  bandOpacity: 0.38,
  bandOpacityOnImagery: 0.55,
  outlineWidth: 2,
  outlineWidthOnImagery: 2.2,
  /** The white line under each outline over imagery. */
  casingOnImagery: '#ffffff',
  /** Closed land: dense hatch. Restricted land: sparse hatch. Line spacing in screen pixels. */
  hatchDark: '#1e1b18',
  hatchDarkOpacity: 0.55,
  hatchLight: '#ffffff',
  hatchLightOpacity: 0.55,
  hatchClosedSpacing: 8,
  hatchRestrictedSpacing: 14,
} as const;

/**
 * "Selected": the tapped public land site now, and the tapped parcel later.
 * A yellow core on a black casing, unlike anything else on the map, and
 * readable on the pale map and on imagery.
 */
export const selectionPalette = {
  core: '#ffd400',
  casing: '#111111',
  coreWidth: 3,
  casingWidth: 6.5,
} as const;

/**
 * Reserved for private parcel outlines (a later step). Not used yet.
 * Thin neutral lines that sit under public land in weight: a fine dark line
 * on the map view, a fine light line with a dark edge on imagery. The
 * selected parcel uses selectionPalette, the same as a selected public site.
 */
export const parcelPalette = {
  line: '#5a524a',
  lineOpacity: 0.75,
  lineWidth: 0.9,
  lineOnImagery: '#f7f3e8',
  lineCasingOnImagery: '#1a1a1a',
  lineWidthOnImagery: 1.1,
  /** Dashed so a parcel edge is never mistaken for a road or a public land edge. */
  dash: [3, 2],
  /** Parcel ID labels, from zoom 16. */
  labelText: '#3d3730',
  labelHalo: '#ffffff',
} as const;

/** Route number shields: a dark shield for interstate, US and state routes, a light one for county roads. */
export const shieldPalette = {
  major: '#2e3b4e',
  majorBorder: '#ffffff',
  county: '#ffffff',
  countyBorder: '#3a362f',
} as const;
