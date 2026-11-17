// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Web Mercator tile coordinates, down to the units inside one vector tile.
// A vector tile's own coordinates run from 0 to its extent (usually 4096)
// across the tile, x to the east and y to the south.

/** The zoom the readout reads: it holds every parcel at full detail (D27). */
export const PARCEL_ZOOM = 16;

export interface TileId {
  z: number;
  x: number;
  y: number;
}

export function tileKey(t: TileId): string {
  return `${t.z}/${t.x}/${t.y}`;
}

/** Longitude to the world's x, 0 to 1 from west to east. */
export function lngToWorldX(lng: number): number {
  return (lng + 180) / 360;
}

/** Latitude to the world's y, 0 to 1 from north to south. */
export function latToWorldY(lat: number): number {
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
}

export function worldXToLng(x: number): number {
  return x * 360 - 180;
}

export function worldYToLat(y: number): number {
  return (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
}

/** The tile at zoom z that holds a point. */
export function tileAt(lng: number, lat: number, z: number): TileId {
  const n = 2 ** z;
  const x = Math.min(n - 1, Math.max(0, Math.floor(lngToWorldX(lng) * n)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(latToWorldY(lat) * n)));
  return { z, x, y };
}

/** A point in a tile's own units to longitude and latitude. Exact, no rounding. */
export function tileUnitsToLngLat(t: TileId, extent: number, tx: number, ty: number): [number, number] {
  const n = 2 ** t.z;
  return [worldXToLng((t.x + tx / extent) / n), worldYToLat((t.y + ty / extent) / n)];
}

/** Longitude and latitude to a tile's own units (not rounded, may fall outside the tile). */
export function lngLatToTileUnits(t: TileId, extent: number, lng: number, lat: number): [number, number] {
  const n = 2 ** t.z;
  return [(lngToWorldX(lng) * n - t.x) * extent, (latToWorldY(lat) * n - t.y) * extent];
}
