// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Every word the download screens show about sizes, statuses and errors, in
// one place, so each thing has one name. The words never say "tile",
// "archive", "zoom level" or "extract": the user downloads a county or an
// area, and a download is on this phone or not.

import type { AreaError, AreaView } from '../../downloads/contract';
import { SPACE_MARGIN_BYTES } from '../../downloads/service';
import { formatSize } from '../format';

/** Sizes in decimal MB and GB, the app's one unit (format.ts). */
export { formatSize };

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
export type StatusIcon = 'check' | 'download' | 'clock' | 'pause' | 'offline' | 'caution' | 'mobile-data';

/**
 * What the user can do with a download, besides delete and show on the map.
 * 'use-mobile-data' lets a download that waits for Wi-Fi go on over mobile data.
 */
export type MainAction = 'pause' | 'resume' | 'retry' | 'again' | 'use-mobile-data' | null;

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
  // At the very start "less than 0.1 MB of 3.4 MB" reads badly: say 0.
  const a = done < 50_000 ? '0 MB' : formatSize(done);
  const b = formatSize(total);
  const ua = a.split(' ').pop();
  const ub = b.split(' ').pop();
  if (ua === ub && /^[\d.]+ (MB|GB)$/.test(a)) return `${a.replace(/ (MB|GB)$/, '')} of ${b}`;
  return `${a} of ${b}`;
}

export function statusText(view: Pick<AreaView, 'status' | 'error' | 'waitingFor' | 'bytesDone' | 'bytesTotal'>): StatusText {
  const progress = progressLine(view.bytesDone, view.bytesTotal);
  switch (view.status) {
    case 'queued':
      return { title: 'Waiting to start', detail: 'Starts when the download before it is done.', icon: 'clock', tone: 'idle', progress: true, action: 'pause' };
    case 'downloading':
      return { title: `Downloading, ${percentDone(view.bytesDone, view.bytesTotal)}%`, detail: progress, icon: 'download', tone: 'active', progress: true, action: 'pause' };
    case 'paused':
      return { title: 'Paused', detail: `${progress}. Tap Resume to go on.`, icon: 'pause', tone: 'idle', progress: true, action: 'resume' };
    case 'waiting':
      // On mobile data, a download the user did not allow it waits for Wi-Fi (D33). It never uses the data plan by itself.
      if (view.waitingFor === 'unmetered') {
        return { title: 'Waiting for Wi-Fi', detail: `${progress}. Goes on by itself on Wi-Fi.`, icon: 'mobile-data', tone: 'idle', progress: true, action: 'use-mobile-data' };
      }
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
  'use-mobile-data': 'Use mobile data',
};

// ---------------------------------------------------------------- mobile data

/**
 * The rule the words below describe (D33, contract.ts AreaJob.allowMetered):
 * a download uses mobile data only if the user said yes when it started, or
 * later with "Use mobile data". Any other download waits for Wi-Fi while the
 * phone is on mobile data, and goes on by itself on Wi-Fi.
 */
export const METERED_NOTE_TITLE = 'You are on mobile data';
export const METERED_NOTE = 'A new download asks before it uses your data plan. Downloads started on Wi-Fi wait for Wi-Fi.';
/** Under the size of a picked area, on mobile data, before the question. */
export const METERED_ASK_FIRST = 'You are on mobile data. You are asked before this download uses your data plan.';

/** The question before a download on mobile data. Yes starts it with mobile data allowed; no starts nothing. */
export function meteredQuestion(bytes: number): { title: string; detail: string } {
  return { title: `Use ${formatSize(bytes)} of mobile data?`, detail: 'This comes out of your data plan. On Wi-Fi it costs nothing.' };
}

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

/** The list of maps is of a newer kind than this version of the app reads (errors.ts CatalogUnsupportedError). */
export const CATALOG_UNSUPPORTED_TEXT = 'This version of the app cannot read the list of maps. Update the app.';

/**
 * Why a download could not start or go on, in plain words, from the
 * service's error name ('offline', 'no-space', 'nothing',
 * 'catalog-unavailable', 'catalog-unsupported'). Any other failure gets a
 * general sentence.
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
    case 'catalog-unsupported':
      return CATALOG_UNSUPPORTED_TEXT;
    default:
      return 'The download could not start. Check the connection and try again.';
  }
}

// ---------------------------------------------------------------- before the first download

/**
 * Said under the Download button until a first download has started, because
 * Android asks for leave to show notifications at that first tap.
 */
export const NOTIFY_NOTE = 'Android may ask about notifications. They only show progress, and the download works either way.';

// ---------------------------------------------------------------- space on the phone

/**
 * Room the download service keeps free beside every download
 * (downloads/service.ts). The screens check against the same number, so a
 * download they offer is one the service will start.
 */
export { SPACE_MARGIN_BYTES };

/** Free space a download needs: its own size and the room kept spare. */
export function spaceNeeded(downloadBytes: number): number {
  return downloadBytes + SPACE_MARGIN_BYTES;
}

/** True when the phone has room for a download, or cannot tell. */
export function hasRoom(downloadBytes: number, freeBytes: number | undefined): boolean {
  return freeBytes === undefined || freeBytes >= spaceNeeded(downloadBytes);
}

/** "Not enough space. It needs ... free ... and the phone has ...", with what to do. */
export function notEnoughSpaceText(downloadBytes: number, freeBytes: number, county: boolean): string {
  const fix = county ? 'Delete a download, leave out imagery, or pick a smaller area.' : 'Delete a download, choose less imagery detail, or pick a smaller area.';
  return `It needs ${formatSize(spaceNeeded(downloadBytes))} free (the download and some room to spare) and the phone has ${formatSize(freeBytes)}. ${fix}`;
}

// ---------------------------------------------------------------- property lines

/** "Macon County" from "Macon County, Illinois". */
function shortCounty(name: string): string {
  return name.replace(/, Illinois$/, '');
}

function andList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * One sentence for when property lines are on: they are never part of a
 * download (D33), because they come with the app. `linesWith` names the
 * counties whose property lines are on this phone. With `county`, the
 * sentence is about that county.
 */
export function propertyLinesNote(linesWith: readonly string[], county?: string): string {
  const have = linesWith.map(shortCounty);
  if (county !== undefined) {
    const c = shortCounty(county);
    return have.includes(c)
      ? `Property lines are not part of the download: they come with the app for ${c} and work offline.`
      : `Property lines are not part of the download, and none are offered for ${c} yet.`;
  }
  return have.length
    ? `Property lines are not part of the download: they come with the app for ${andList(have)} and work offline there.`
    : 'Property lines are not part of the download, and none are on this phone yet.';
}
