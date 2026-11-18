// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Every word the download screens show about sizes, statuses and errors, in
// one place, so each thing has one name. The words never say "tile",
// "archive", "zoom level" or "extract": the user downloads a county or an
// area, and a download is on this phone or not.

import type { AreaError, AreaView } from '../../downloads/contract';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * A size in MB or GB, as the rest of the app counts them (1 MB is 1024 KB).
 * Under 100 MB with one decimal, so a 1.7 MB area does not read as 2 MB.
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  // Under 0.05 MB would round to 0.0 MB.
  if (bytes < 0.05 * MB) return 'less than 0.1 MB';
  if (bytes < 100 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes < 1000 * MB) return `${Math.round(bytes / MB)} MB`;
  return `${(bytes / GB).toFixed(bytes < 10 * GB ? 2 : 1)} GB`;
}

/** Whole percent done, never 100 before the last byte. */
export function percentDone(done: number, total: number): number {
  if (total <= 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.floor((done / total) * 100));
}

// ---------------------------------------------------------------- layers

/** The app's word for each hosted layer. The same words as the base view switch and the Layers panel. */
const LAYER_LABELS: Readonly<Record<string, string>> = {
  basemap: 'Map',
  aerial: 'Aerial imagery',
  publicland: 'Public land',
  parcels: 'Property lines',
};

/** What each layer shows, in a few words. */
const LAYER_NOTES: Readonly<Record<string, string>> = {
  basemap: 'Roads, water, woods and place names.',
  aerial: 'Photos for the Aerial and Hybrid views.',
  publicland: 'Who manages it, and access on foot.',
  parcels: 'Property lines and owners.',
};

export function layerLabel(layer: string, fallback = layer): string {
  return LAYER_LABELS[layer] ?? fallback;
}

export function layerNote(layer: string): string {
  return LAYER_NOTES[layer] ?? '';
}

/** "Map, public land and aerial imagery": a list of layers in a sentence. */
export function listLayers(layers: readonly string[]): string {
  const words = layers.map((l, i) => {
    const label = layerLabel(l);
    return i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1);
  });
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// ---------------------------------------------------------------- imagery detail

/** The detail levels on offer for aerial imagery, highest first. 0 means no imagery. */
export const DETAIL_LEVELS = [16, 15, 14] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export interface DetailText {
  /** One word for a segmented button. */
  short: string;
  /** What shows on the ground at this detail. */
  ground: string;
}

/**
 * At this latitude one dot of imagery covers about 6 ft at the highest
 * detail, 12 ft at the middle one and 24 ft at the lowest. The words say what
 * that lets a hunter see.
 */
export const DETAIL_TEXT: Readonly<Record<DetailLevel | 0, DetailText>> = {
  16: { short: 'High', ground: 'Single trees, trails and vehicles show. The largest download.' },
  15: { short: 'Medium', ground: 'Tree lines, field edges and buildings show.' },
  14: { short: 'Low', ground: 'Fields, woods and ponds show. The smallest download.' },
  0: { short: 'None', ground: 'No imagery. The Aerial and Hybrid views stay empty here.' },
};

/** "high detail", for a sentence about a finished download. */
export function detailPhrase(maxzoom: number): string {
  if (maxzoom >= 16) return 'high detail';
  if (maxzoom >= 15) return 'medium detail';
  return 'low detail';
}

/** What a download holds, in a sentence: "Map, public land and aerial imagery (high detail)." */
export function contentsLine(layers: readonly string[], aerialMaxzoom: number): string {
  const ordered = [...layers].sort((a, b) => layerOrder(a) - layerOrder(b));
  const text = listLayers(ordered);
  return ordered.includes('aerial') ? `${text} (${detailPhrase(aerialMaxzoom)}).` : `${text}.`;
}

function layerOrder(layer: string): number {
  const i = ['basemap', 'publicland', 'parcels', 'aerial'].indexOf(layer);
  return i < 0 ? 10 : i;
}

// ---------------------------------------------------------------- statuses

export type StatusTone = 'done' | 'active' | 'idle' | 'problem';
export type StatusIcon = 'check' | 'download' | 'clock' | 'pause' | 'offline' | 'caution';

/** What the user can do with a download, besides delete and show on the map. */
export type MainAction = 'pause' | 'resume' | 'retry' | 'again' | null;

export interface StatusText {
  title: string;
  /** A sentence under the title, or ''. */
  detail: string;
  icon: StatusIcon;
  tone: StatusTone;
  /** The progress bar shows while the download is not complete and has not failed for good. */
  progress: boolean;
  action: MainAction;
}

interface ErrorText {
  title: string;
  detail: (remaining: string) => string;
  action: 'retry' | 'again';
}

/** Each error in plain words, with what the user can do about it. */
export const ERROR_TEXT: Readonly<Record<AreaError, ErrorText>> = {
  changed: {
    title: 'Stopped: newer map data came out',
    detail: () => 'The map data was updated during the download. Download it again to get the new data.',
    action: 'again',
  },
  'no-space': {
    title: 'Stopped: the phone is full',
    detail: (remaining) => `Free up at least ${remaining} by deleting photos, apps or another download. Then tap Try again.`,
    action: 'retry',
  },
  server: {
    title: 'Stopped: the download server did not answer',
    detail: () => 'The map data could not be fetched. Try again later.',
    action: 'retry',
  },
  corrupt: {
    title: 'Stopped: part of it arrived damaged',
    detail: () => 'Download it again to replace the damaged part.',
    action: 'again',
  },
  other: {
    title: 'Stopped by an error',
    detail: () => 'Tap Try again. If it stops again, delete it and download it again.',
    action: 'retry',
  },
};

/** "11.0 of 24.4 MB" (or "1.2 of 2.3 GB"), with the unit once when both share it. */
export function progressLine(done: number, total: number): string {
  const a = formatSize(done);
  const b = formatSize(total);
  const ua = a.split(' ').pop();
  const ub = b.split(' ').pop();
  if (ua === ub && /^[\d.]+ (MB|GB)$/.test(a)) return `${a.replace(/ (MB|GB)$/, '')} of ${b}`;
  return `${a} of ${b}`;
}

export function statusText(view: Pick<AreaView, 'status' | 'error' | 'bytesDone' | 'bytesTotal'>): StatusText {
  const progress = progressLine(view.bytesDone, view.bytesTotal);
  switch (view.status) {
    case 'queued':
      return { title: 'Waiting to start', detail: 'Starts when the download before it is done.', icon: 'clock', tone: 'idle', progress: true, action: 'pause' };
    case 'downloading':
      return { title: `Downloading, ${percentDone(view.bytesDone, view.bytesTotal)}%`, detail: progress, icon: 'download', tone: 'active', progress: true, action: 'pause' };
    case 'paused':
      return { title: 'Paused', detail: `${progress}. Tap Resume to go on.`, icon: 'pause', tone: 'idle', progress: true, action: 'resume' };
    case 'waiting':
      return { title: 'Waiting for a connection', detail: `${progress}. Goes on by itself when the phone is online.`, icon: 'offline', tone: 'idle', progress: true, action: 'pause' };
    case 'failed': {
      const e = ERROR_TEXT[view.error ?? 'other'];
      const remaining = formatSize(Math.max(0, view.bytesTotal - view.bytesDone));
      return { title: e.title, detail: e.detail(remaining), icon: 'caution', tone: 'problem', progress: false, action: e.action };
    }
    case 'complete':
      return { title: 'Ready to use offline', detail: '', icon: 'check', tone: 'done', progress: false, action: null };
  }
}

export const ACTION_LABELS: Readonly<Record<Exclude<MainAction, null>, string>> = {
  pause: 'Pause',
  resume: 'Resume',
  retry: 'Try again',
  again: 'Download again',
};

// ---------------------------------------------------------------- a damaged record

/**
 * The service shows an area whose stored record could not be read with an
 * empty name, bounds [0, 0, 0, 0] and no layers. It can only be deleted.
 */
export function isDamagedRecord(r: { name: string; bounds: readonly number[]; layers: readonly string[] }): boolean {
  return r.layers.length === 0 && r.bounds.every((v) => v === 0);
}

export const DAMAGED_NAME = 'Unreadable download';
export const DAMAGED_TEXT = 'The phone could not read what this download holds. Delete it, then download the place again.';

// ---------------------------------------------------------------- the picked area

const KM_PER_MILE = 1.609344;

/** "6.2 by 4.0 miles (10.0 by 6.4 km)": the size of a rectangle on the ground, west to east by south to north. */
export function spanText(widthKm: number, heightKm: number): string {
  const mi = (km: number) => fmtLength(km / KM_PER_MILE);
  return `${mi(widthKm)} by ${mi(heightKm)} miles (${fmtLength(widthKm)} by ${fmtLength(heightKm)} km)`;
}

function fmtLength(n: number): string {
  if (n < 10) return n.toFixed(1);
  return String(Math.round(n));
}

// ---------------------------------------------------------------- when a download cannot start

/**
 * Why a download could not start or go on, in plain words, from the
 * service's error name ('offline', 'no-space', 'nothing',
 * 'catalog-unavailable'). Any other failure gets a general sentence.
 */
export function startErrorText(code: string | undefined, space?: { neededBytes?: unknown; freeBytes?: unknown }): string {
  switch (code) {
    case 'offline':
      return 'You are offline. Downloading needs a connection.';
    case 'no-space': {
      const needed = typeof space?.neededBytes === 'number' ? space.neededBytes : undefined;
      const free = typeof space?.freeBytes === 'number' ? space.freeBytes : undefined;
      const sizes = needed !== undefined && free !== undefined ? ` It needs ${formatSize(needed)} free (the download and some room to spare) and has ${formatSize(free)}.` : '';
      return `There is not enough space on the phone.${sizes} Delete a download or choose less.`;
    }
    case 'nothing':
      return 'There is nothing to download here.';
    case 'catalog-unavailable':
      return 'The list of maps could not be fetched. Check the connection and try again.';
    default:
      return 'The download could not start. Check the connection and try again.';
  }
}
