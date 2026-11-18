// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-12" as "November 12, 2026". Anything else is shown as given. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso || 'not stated';
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : iso;
}

export function formatAcres(acres: number | null): string {
  if (acres === null) return 'not stated';
  return `${Math.round(acres).toLocaleString('en-US')} acres`;
}

/**
 * Splits text into plain pieces and parcel IDs (a run of digits and hyphens
 * or dots, at least five long), so a screen can keep each ID on one line: a
 * browser otherwise breaks an ID such as 08-06-23-100-005 at a hyphen.
 */
export function splitIds(text: string): { text: string; id: boolean }[] {
  const out: { text: string; id: boolean }[] = [];
  const re = /\d[\d.-]{3,}\d/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), id: false });
    out.push({ text: m[0], id: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), id: false });
  return out;
}

/**
 * The app's one unit for sizes: 1 MB is 1,000,000 bytes and 1 GB is
 * 1,000,000,000 bytes, as Android's own storage settings count them, so a
 * size here matches what the phone says is free. Every screen, and the
 * download notification, uses these numbers.
 */
export const MB = 1_000_000;
export const GB = 1_000_000_000;

/**
 * A size in MB or GB. Under 100 MB with one decimal, so a 1.7 MB area does
 * not read as 2 MB. Never in bytes or KB.
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  // Under 0.05 MB would round to 0.0 MB.
  if (bytes < 0.05 * MB) return 'less than 0.1 MB';
  if (bytes < 100 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes < 1000 * MB) return `${Math.round(bytes / MB)} MB`;
  return `${(bytes / GB).toFixed(bytes < 10 * GB ? 2 : 1)} GB`;
}

/** The same as formatSize: one unit everywhere. */
export const formatBytes = formatSize;
