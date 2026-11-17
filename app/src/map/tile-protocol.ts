// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The custom tile address scheme the style uses:
//   mapapp://<layer>/{z}/{x}/{y}           the layer, from whichever archive has the tile
//   mapapp://<layer>@<county>/{z}/{x}/{y}  one archive only (raster layers):
//                                          the county's archive that came with the app
//   mapapp://<layer>@<county>.<area>/{z}/{x}/{y}
//                                          one archive of a downloaded area
// County, layer and area IDs hold no dots (ARCHIVE_ID_PATTERN), so the dot is unambiguous.
// The loader below turns such an address into tile bytes through the TileResolver.

import type { TileResolver } from './tile-resolver';

export const TILE_SCHEME = 'mapapp';

/** The tile URL template for a layer's map source, or for one archive's source. */
export function tileUrlTemplate(layer: string, county?: string, area?: string): string {
  const archive = county ? `@${county}${area ? `.${area}` : ''}` : '';
  return `${TILE_SCHEME}://${layer}${archive}/{z}/{x}/{y}`;
}

export interface TileAddress {
  layer: string;
  /** Set when the address names one archive. */
  county?: string;
  /** Set when that archive belongs to a downloaded area. */
  area?: string;
  z: number;
  x: number;
  y: number;
}

export function parseTileUrl(url: string): TileAddress | null {
  const m = /^mapapp:\/\/([a-z0-9-]+)(?:@([a-z0-9-]+)(?:\.([a-z0-9-]+))?)?\/(\d+)\/(\d+)\/(\d+)$/.exec(url);
  if (!m) return null;
  return { layer: m[1] ?? '', ...(m[2] ? { county: m[2] } : {}), ...(m[3] ? { area: m[3] } : {}), z: Number(m[4]), x: Number(m[5]), y: Number(m[6]) };
}

/** Counts kept for the diagnostics screen. */
export interface TileStats {
  requested: number;
  failed: number;
  lastError: string;
}

export function newTileStats(): TileStats {
  return { requested: 0, failed: 0, lastError: '' };
}

/**
 * The function given to MapLibre's addProtocol. A tile no archive holds is
 * answered with zero bytes: MapLibre draws that as an empty vector tile, or as
 * a transparent raster tile.
 */
export function createTileLoader(resolver: TileResolver, stats: TileStats = newTileStats()) {
  return async (params: { url: string }, abort: AbortController): Promise<{ data: Uint8Array }> => {
    stats.requested++;
    const address = parseTileUrl(params.url);
    if (!address) {
      stats.failed++;
      stats.lastError = `bad tile address ${params.url}`;
      throw new Error(stats.lastError);
    }
    try {
      const data = await resolver.getTile(address.layer, address.z, address.x, address.y, abort.signal, address.county, address.area);
      return { data: data === undefined ? new Uint8Array(0) : new Uint8Array(data) };
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        stats.failed++;
        stats.lastError = String(e instanceof Error ? e.message : e);
      }
      throw e;
    }
  };
}
