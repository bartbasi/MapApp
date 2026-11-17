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
 * Property lines (parcel outlines), the app's core layer (D26).
 *
 * A cased line: a chartreuse core on a near-black casing, the same in all
 * three base views. Chartreuse is a hue nothing else on the map uses: roads
 * are white, cream and amber, water is blue, woods are a pale soft green,
 * public land runs purple, orange, crimson, brown, blue and teal, and the
 * position marker is blue. The dark casing carries the line over pale fields
 * and the pale map; the bright core carries it over dark woods. Under
 * red-green colour blindness the core reads as a pale yellow; it is then
 * told from the hybrid view's cream roads by its width (a road is three to
 * six times wider) and by its dark casing on both sides at every zoom.
 *
 * Widths are in screen pixels: quiet at zoom 13 to 14, clear from 15, and
 * heavy from 17 to 20, where a few meters fill the screen.
 * The tapped parcel uses selectionPalette, as a tapped public land site does.
 */
export const parcelPalette = {
  core: '#c8f53a',
  casing: '#161a08',
  /** [zoom, core width] stops. */
  coreWidth: [
    [13, 0.6],
    [14, 0.8],
    [15, 1.4],
    [17, 2.2],
    [20, 3.4],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Casing width beyond the core, on each side together, at zoom 13 and from zoom 15. */
  casingExtraLow: 1.2,
  casingExtraHigh: 2.4,
  /** Quiet at the lowest zooms. */
  opacityLow: 0.55,
  opacityHigh: 1,
} as const;

/**
 * The phone against the property lines (D26), drawn above the parcel
 * outlines and below the marker:
 * - here: the parcel the phone is in, a wide soft glow in the marker's blue
 *   under its lines (unlike the tapped parcel's yellow and black), drawn
 *   below the lines so it never tints them;
 * - connector: dashes in the marker's blue on a white casing, from the
 *   marker to the nearest line, with a short tick across the line;
 * - near: in the caution state, the stretch of line the phone may be on, in
 *   amber and black hazard stripes, matching the readout's caution colours.
 */
export const relationPalette = {
  hereGlow: '#1559d6',
  hereGlowOpacity: 0.35,
  hereGlowOnImagery: '#8fc1ff',
  hereGlowOpacityOnImagery: 0.6,
  hereGlowWidth: 11,
  connector: '#1559d6',
  connectorCasing: '#ffffff',
  connectorWidth: 2.4,
  connectorCasingWidth: 5,
  /** Dash and gap, in line widths. */
  connectorDash: [2, 1.6],
  tick: '#1559d6',
  tickRim: '#ffffff',
  nearStripe: '#ffb000',
  nearDark: '#111111',
  nearWidth: 6,
  nearCasingWidth: 10,
  /** Black stripes over the amber, in line widths. */
  nearDash: [1, 1],
} as const;

/**
 * The phone's position marker, drawn above everything (DECISIONS D26).
 * A strong blue no other layer uses, inside a white ring with a dark edge,
 * so it reads on the pale map and on dark woods in the imagery. The
 * accuracy circle is a light wash with a firm edge. A stale fix turns gray.
 */
export const positionPalette = {
  dot: '#1559d6',
  ring: '#ffffff',
  /** The soft dark edge outside the white ring, for pale ground. */
  edge: '#0a1630',
  edgeOpacity: 0.45,
  stale: '#80858c',
  accuracyFill: '#1559d6',
  accuracyFillOpacity: 0.13,
  accuracyEdge: '#1559d6',
  accuracyFillOnImagery: '#cfe0ff',
  accuracyFillOpacityOnImagery: 0.2,
  accuracyEdgeOnImagery: '#ffffff',
  accuracyEdgeOpacity: 0.85,
  staleAccuracy: '#80858c',
  /** The heading wedge: the dot's blue, fading outward, with a pale rim. */
  wedge: '#1559d6',
  wedgeRim: '#ffffff',
  /** Sizes in screen pixels. */
  dotRadius: 7.5,
  ringWidth: 3,
  edgeWidth: 1.6,
  accuracyEdgeWidth: 1.5,
} as const;

/** Route number shields: a dark shield for interstate, US and state routes, a light one for county roads. */
export const shieldPalette = {
  major: '#2e3b4e',
  majorBorder: '#ffffff',
  county: '#ffffff',
  countyBorder: '#3a362f',
} as const;
