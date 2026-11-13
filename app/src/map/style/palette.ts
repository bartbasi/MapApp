// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Every color the map style uses, in one place. A first plain palette, to be
// replaced by the designer.

export const basePalette = {
  land: '#f3f0e8',
  farmland: '#f0ecd9',
  wood: '#cddfbf',
  park: '#d9e8c8',
  grass: '#e3ebd2',
  wetland: '#d3e3d7',
  residential: '#ebe7df',
  built: '#e5e1da',
  institution: '#ece4d4',
  special: '#e8e3e8',
  sand: '#f1e7c6',
  building: '#dcd6cc',
  water: '#a8c8de',
  waterLine: '#7fa9c8',
  boundaryCounty: '#7d6c8f',
  boundaryState: '#5d4c70',
  boundaryLocal: '#a99fb5',
  motorway: '#e7a960',
  motorwayCasing: '#b37a3d',
  majorRoad: '#fbe7a8',
  majorRoadCasing: '#b9a46c',
  minorRoad: '#ffffff',
  minorRoadCasing: '#c4bdb0',
  track: '#9b7b55',
  path: '#8e8577',
  rail: '#8f8a84',
  runway: '#d5d0c8',
  labelText: '#2d2a26',
  labelHalo: '#ffffff',
  placeText: '#1f1d1a',
  waterText: '#3f6f93',
  parkText: '#4e6b3a',
} as const;

/** Colors drawn on top of aerial imagery in the hybrid view. */
export const imageryPalette = {
  background: '#3b3d3a',
  majorRoad: '#ffe08a',
  minorRoad: '#ffffff',
  track: '#f0d7b0',
  waterLine: '#9fd3ff',
  labelText: '#ffffff',
  labelHalo: '#1b1b1b',
  waterText: '#cfe9ff',
} as const;

/**
 * Public land, one color per managing category (see the archive contract in
 * pipeline/README.md). Chosen to stay apart from each other and from water,
 * woods and roads.
 */
export const publicLandPalette = {
  state: '#2e7d32',
  county_district: '#7b4ea3',
  local: '#d0821a',
  university: '#b7325b',
  federal: '#8a5a2b',
  ngo: '#13897a',
  other: '#6f6f6f',
} as const;

export const publicLandStyle = {
  fillOpacity: 0.28,
  fillOpacityOnImagery: 0.18,
  outlineWidth: 1.6,
  outlineWidthOnImagery: 2.4,
  selected: '#111111',
  selectedOnImagery: '#ffffff',
} as const;
