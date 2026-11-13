// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The archive contract, as the app reads it. The authority is
// pipeline/README.md ("The archive contract"). Each layer of each county is a
// <layer>.pmtiles archive with a <layer>.meta.json file beside it.
//
// This file has no browser or Node dependencies, so the development server
// plugin uses it too.

/** One dataset that went into an archive. Shown on the sources screen. */
export interface ArchiveSource {
  name: string;
  license: string;
  credit: string;
  url: string;
  dataDate: string;
}

/** The contents of a <layer>.meta.json file. */
export interface ArchiveMeta {
  schema: number;
  layer: string;
  county: string;
  countyName: string;
  kind: 'vector' | 'raster';
  title: string;
  minzoom: number;
  maxzoom: number;
  /** West, south, east, north in degrees. */
  bounds: [number, number, number, number];
  bytes: number;
  buildDate: string;
  sources: ArchiveSource[];
  notes: string;
  /**
   * Raster tiles' size in pixels. Not in the contract yet: the contract says
   * raster tiles are 512 pixels, so that is the value when the field is absent.
   */
  tileSize?: number;
}

/** The raster tile size the contract fixes, used when metadata does not say. */
export const DEFAULT_RASTER_TILE_SIZE = 512;

/** An installed archive: where it is and what its metadata says. */
export interface ArchiveEntry {
  county: string;
  layer: string;
  meta: ArchiveMeta;
}

/**
 * County IDs and layer names are lower case letters, digits and hyphens.
 * Anything else in a request path is refused, which also rules out "..".
 */
export const ARCHIVE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The path the web app uses to read an archive, on every platform. */
export function archivePath(county: string, layer: string): string {
  return `/_tiles/${county}/${layer}.pmtiles`;
}

/** Splits "/_tiles/<county>/<layer>.pmtiles" into its parts, or null if it is not one. */
export function parseArchivePath(path: string): { county: string; layer: string } | null {
  const m = /^\/_tiles\/([^/]+)\/([^/]+)\.pmtiles$/.exec(path);
  if (!m) return null;
  const county = m[1] ?? '';
  const layer = m[2] ?? '';
  if (!ARCHIVE_ID_PATTERN.test(county) || !ARCHIVE_ID_PATTERN.test(layer)) return null;
  return { county, layer };
}

function str(o: Record<string, unknown>, key: string, fallback?: string): string {
  const v = o[key];
  if (typeof v === 'string') return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`metadata field "${key}" is missing or not text`);
}

function num(o: Record<string, unknown>, key: string): number {
  const v = o[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  throw new Error(`metadata field "${key}" is missing or not a number`);
}

/**
 * Checks a parsed meta.json against the contract and returns it typed.
 * Throws with a plain message if a required field is missing or wrong.
 */
export function parseArchiveMeta(raw: unknown): ArchiveMeta {
  if (typeof raw !== 'object' || raw === null) throw new Error('metadata is not an object');
  const o = raw as Record<string, unknown>;
  const kind = str(o, 'kind');
  if (kind !== 'vector' && kind !== 'raster') throw new Error(`metadata kind "${kind}" is unknown`);
  const b = o['bounds'];
  if (!Array.isArray(b) || b.length !== 4 || !b.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    throw new Error('metadata bounds must be four numbers');
  }
  const sourcesRaw = o['sources'];
  if (!Array.isArray(sourcesRaw)) throw new Error('metadata sources must be a list');
  const sources: ArchiveSource[] = sourcesRaw.map((s) => {
    if (typeof s !== 'object' || s === null) throw new Error('a metadata source is not an object');
    const so = s as Record<string, unknown>;
    return {
      name: str(so, 'name'),
      license: str(so, 'license'),
      credit: str(so, 'credit'),
      url: str(so, 'url', ''),
      dataDate: str(so, 'dataDate', ''),
    };
  });
  const layer = str(o, 'layer');
  const county = str(o, 'county');
  if (!ARCHIVE_ID_PATTERN.test(layer) || !ARCHIVE_ID_PATTERN.test(county)) {
    throw new Error('metadata layer or county is not a valid ID');
  }
  return {
    schema: num(o, 'schema'),
    layer,
    county,
    countyName: str(o, 'countyName', county),
    kind,
    title: str(o, 'title', layer),
    minzoom: num(o, 'minzoom'),
    maxzoom: num(o, 'maxzoom'),
    bounds: [b[0], b[1], b[2], b[3]] as [number, number, number, number],
    bytes: typeof o['bytes'] === 'number' ? (o['bytes'] as number) : 0,
    buildDate: str(o, 'buildDate', ''),
    sources,
    notes: str(o, 'notes', ''),
    ...(typeof o['tileSize'] === 'number' && [256, 512].includes(o['tileSize']) ? { tileSize: o['tileSize'] } : {}),
  };
}
