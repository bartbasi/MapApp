// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The public land layer's data: its categories and the fields of a tapped
// site. Field names follow the archive contract in pipeline/README.md.

export const PUBLIC_LAND_LAYER = 'publicland';

export const PUBLIC_LAND_CATEGORIES = ['state', 'county_district', 'local', 'university', 'federal', 'ngo', 'other'] as const;
export type PublicLandCategory = (typeof PUBLIC_LAND_CATEGORIES)[number];

/** Plain labels for the legend and the details panel. */
export const categoryLabels: Record<PublicLandCategory, string> = {
  state: 'State',
  county_district: 'County forest preserve or conservation district',
  local: 'City, village, township or park district',
  university: 'University',
  federal: 'Federal',
  ngo: 'Land trust (privately owned)',
  other: 'Other public body',
};

export function isPublicLandCategory(v: unknown): v is PublicLandCategory {
  return typeof v === 'string' && (PUBLIC_LAND_CATEGORIES as readonly string[]).includes(v);
}

export type Access = 'open' | 'restricted' | 'closed' | 'unknown';

export interface PublicLandSite {
  name: string;
  manager: string;
  category: PublicLandCategory;
  access: Access;
  acres: number | null;
}

/** Reads a tapped feature's properties. Missing or odd values become "unknown" ones. */
export function readPublicLandSite(props: Record<string, unknown>): PublicLandSite {
  const text = (k: string) => (typeof props[k] === 'string' ? (props[k] as string).trim() : '');
  const access = text('access');
  const acresRaw = props['acres'];
  const acres = typeof acresRaw === 'number' ? acresRaw : typeof acresRaw === 'string' && acresRaw !== '' ? Number(acresRaw) : NaN;
  const category = props['category'];
  return {
    name: text('name'),
    manager: text('manager'),
    category: isPublicLandCategory(category) ? category : 'other',
    access: access === 'open' || access === 'restricted' || access === 'closed' ? access : 'unknown',
    acres: Number.isFinite(acres) ? acres : null,
  };
}

/** The access field means access on foot, not hunting, and is worded that way. */
export function accessOnFootText(access: Access): string {
  switch (access) {
    case 'open':
      return 'Open to the public on foot.';
    case 'restricted':
      return 'Access on foot is restricted. Check with the managing body.';
    case 'closed':
      return 'Closed to the public on foot.';
    default:
      return 'Access on foot is not known.';
  }
}

/**
 * The categories an archive holds, read from tippecanoe's tilestats in the
 * archive's internal metadata. Returns null if the archive does not say.
 */
export function categoriesFromTilestats(metadata: unknown): PublicLandCategory[] | null {
  const layers = (metadata as { tilestats?: { layers?: unknown } } | null)?.tilestats?.layers;
  if (!Array.isArray(layers)) return null;
  const layer = layers.find((l) => (l as { layer?: unknown }).layer === PUBLIC_LAND_LAYER) as
    | { attributes?: Array<{ attribute?: unknown; values?: unknown }> }
    | undefined;
  const attr = layer?.attributes?.find((a) => a.attribute === 'category');
  if (!attr || !Array.isArray(attr.values)) return null;
  return PUBLIC_LAND_CATEGORIES.filter((c) => (attr.values as unknown[]).includes(c));
}
