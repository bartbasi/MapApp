// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Loads what is installed through the platform and prepares it for the map:
// the per-layer summary, the open archives and the tile resolver.

import type { ArchiveEntry } from '../platform/archive-meta';
import type { Platform } from '../platform/platform';
import { orderArchives } from './archive-order';
import { openArchives, type OpenArchive } from './archives';
import { summarizeInstalled, type InstalledLayers } from './installed';
import { PUBLIC_LAND_CATEGORIES, PUBLIC_LAND_LAYER, categoriesFromTilestats, type PublicLandCategory } from './public-land';
import { TileResolver } from './tile-resolver';

export interface DataSession {
  entries: ArchiveEntry[];
  installed: InstalledLayers;
  archives: OpenArchive[];
  resolver: TileResolver;
}

/**
 * Lists what is installed and opens it. `entries` are in lookup order:
 * downloaded areas newest first, then what came with the app, then the
 * overview map (archive-order.ts).
 */
export async function loadDataSession(platform: Platform, resolver: TileResolver = new TileResolver()): Promise<DataSession> {
  const entries = orderArchives(await platform.archives.list());
  const installed = summarizeInstalled(entries);
  const usable = [...installed.values()].flatMap((l) => l.archives);
  const archives = openArchives(platform.archives, usable);
  resolver.setArchives(archives);
  return { entries, installed, archives, resolver };
}

/**
 * Loads the session again after the installed archives changed (the download
 * service's onArchivesChanged). The new session keeps the old one's resolver,
 * which the map's tile protocol was registered with once, and only swaps the
 * archives it answers from. The caller then takes the new session's
 * `installed` into the style and calls MapView.reloadTiles(), so tiles the map
 * already holds (empty ones where nothing was installed) are fetched again.
 */
export function reloadDataSession(platform: Platform, previous: DataSession): Promise<DataSession> {
  return loadDataSession(platform, previous.resolver);
}

export interface CategoryList {
  categories: PublicLandCategory[];
  /** False when an archive did not say which categories it holds, so all are listed. */
  exact: boolean;
}

/** The public land categories present in the installed archives, for the legend. */
export async function presentPublicLandCategories(session: DataSession): Promise<CategoryList> {
  const found = new Set<PublicLandCategory>();
  let exact = true;
  for (const a of session.archives.filter((x) => x.layer === PUBLIC_LAND_LAYER)) {
    try {
      const list = categoriesFromTilestats(await a.getMetadata());
      if (list === null) exact = false;
      else list.forEach((c) => found.add(c));
    } catch {
      exact = false;
    }
  }
  if (!exact) return { categories: [...PUBLIC_LAND_CATEGORIES], exact };
  return { categories: PUBLIC_LAND_CATEGORIES.filter((c) => found.has(c)), exact };
}
