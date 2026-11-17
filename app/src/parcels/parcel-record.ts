// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The one place that decides which parcel fields the app keeps (D8, D25, D27).
// A parcel record is exactly these four fields. Anything else a tile carries
// (a mailing address, a phone number, a stray column) is dropped here, at the
// reader, before any other code sees it.

/** The fields of a parcel the app may show or keep. Nothing else. */
export interface ParcelRecord {
  /** The parcel ID as the county writes it. */
  pid: string;
  /** The owner name as the county writes it. May be empty. */
  owner: string;
  /** Acreage from the county, or null when the county gives none. */
  acres: number | null;
  /** The county id, such as "il-macon". */
  county: string;
}

/** The allowlist, in the order the record holds them. */
export const PARCEL_RECORD_FIELDS = ['pid', 'owner', 'acres', 'county'] as const;

function text(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function number(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Builds a record from a tile feature's properties, keeping only the
 * allowlisted fields. `archiveCounty` is used when the feature does not name
 * its county.
 */
export function toParcelRecord(properties: Readonly<Record<string, unknown>>, archiveCounty: string): ParcelRecord {
  return {
    pid: text(properties['pid']),
    owner: text(properties['owner']),
    acres: number(properties['acres']),
    county: text(properties['county']) || archiveCounty,
  };
}
