// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The contract of offline downloads (Step 3, DECISIONS D33). Three parties
// build against this file and nothing else of each other's:
//
//   the screens        use DownloadService
//   the manager        implements DownloadService on top of the platform parts
//   the platform       implements RemoteFiles, DownloadJobs and Network
//                      (natively on Android, with a stand-in in a browser)
//
// How a download works. The catalog lists the hosted archives, one per county
// per layer. For a picked area the manager makes one DownloadPlan per archive
// that overlaps it (extract-planner.ts): the bytes that start the new, smaller
// archive, and the byte ranges of the hosted file to append. A whole county is
// the same job with one range covering each file. The platform's downloader
// knows nothing about map tiles: it writes the head, fetches the ranges in
// order, and can stop and go on at any byte.

import type { Bounds } from '../map/tile-math';
import type { ArchiveMeta } from '../platform/archive-meta';
import type { ByteRange } from './download-plan';

// ---------------------------------------------------------------- catalog

/** One hosted archive, as pipeline/publish.py lists it. */
export interface CatalogArchive {
  county: string;
  layer: string;
  /** File name under the catalog's base address. */
  file: string;
  bytes: number;
  sha256: string;
  /** The archive's meta.json, without its provenance. */
  meta: ArchiveMeta;
}

/** catalog.json: what can be downloaded and from where. */
export interface Catalog {
  schema: 1;
  /** The release the files belong to. A release's files never change. */
  release: string;
  published: string;
  /** Address the file names are appended to. Ends with a slash. */
  base: string;
  archives: CatalogArchive[];
}

// ---------------------------------------------------------------- platform: reading hosted files

export interface RemoteRead {
  data: ArrayBuffer;
  /** The hosted file's ETag, if the server gave one. */
  etag?: string;
  /** The whole file's size, from Content-Range. */
  totalBytes?: number;
}

/**
 * Small reads of hosted files, for the catalog and for planning. On Android
 * these go through the shell, because release hosts do not send the headers a
 * web page needs to read them (D15).
 */
export interface RemoteFiles {
  /** A whole small file as text (the catalog). Rejects when offline or on any status but 200. */
  text(url: string, signal?: AbortSignal): Promise<string>;
  /** Exactly `length` bytes at `offset`. Rejects unless the server answers 206 with those bytes. */
  read(url: string, offset: number, length: number, signal?: AbortSignal): Promise<RemoteRead>;
}

// ---------------------------------------------------------------- platform: the downloader

/** One archive file a job produces. */
export interface FileJob {
  county: string;
  layer: string;
  /** The hosted file the ranges are read from. */
  url: string;
  /** If set, every response must carry this ETag; otherwise the file fails with 'changed'. */
  etag?: string;
  /** Bytes that start the new file. */
  head: Uint8Array;
  /** Ranges of the hosted file, appended in order after the head. */
  ranges: ByteRange[];
  /** Size of the finished file. */
  bytes: number;
  /** For a file downloaded whole: checked when it is complete. */
  sha256?: string;
  /** Text of the meta.json written beside the archive when it is complete. */
  meta: string;
}

/** Everything the downloader needs to make one area. */
export interface AreaJob {
  /** Lower case letters, digits and hyphens (ARCHIVE_ID_PATTERN). */
  id: string;
  /** The area's own record as JSON text (AreaRecord). The downloader stores it and hands it back unread. */
  record: string;
  files: FileJob[];
  /**
   * False: the downloader fetches nothing for this area over a connection
   * that is charged by use (mobile data). It waits, with `waitingFor`
   * 'unmetered', and goes on by itself on Wi-Fi. True: the user agreed to
   * mobile data for this area. The choice is stored with the job.
   */
  allowMetered: boolean;
}

export type AreaStatus =
  /** Waiting its turn behind another area. */
  | 'queued'
  | 'downloading'
  /** Stopped by the user. */
  | 'paused'
  /** Stopped because there is no connection. Goes on by itself when there is one. */
  | 'waiting'
  /** Stopped by an error that will not mend itself. `error` says which. */
  | 'failed'
  /** Every file is in place and the map can use the area. */
  | 'complete';

export type AreaError =
  /** The hosted file is not the one the plan was made from. The area must be planned again. */
  | 'changed'
  /** The phone is out of storage. */
  | 'no-space'
  /** The server refused or the file is gone. */
  | 'server'
  /** A finished file did not match its checksum or size. */
  | 'corrupt'
  | 'other';

export interface AreaState {
  id: string;
  /** The AreaJob's record, as given. */
  record: string;
  status: AreaStatus;
  error?: AreaError;
  /**
   * With status 'waiting': what it waits for. 'connection' is any connection.
   * 'unmetered' means the phone is online but only on a connection charged by
   * use, and this area was not allowed to use it.
   */
  waitingFor?: 'connection' | 'unmetered';
  /** The job's allowMetered, as it stands now. */
  allowMetered: boolean;
  bytesDone: number;
  bytesTotal: number;
}

/**
 * The downloader. Jobs outlive the app: a job that was downloading when the
 * app was killed is listed as it was, with the bytes it had, and goes on when
 * the app is opened again. An area's archives are listed by ArchiveAccess only
 * once the area is 'complete', all of them together, and never half written.
 */
export interface DownloadJobs {
  /** Stores the job and starts it, or queues it behind a running one. */
  start(job: AreaJob): Promise<void>;
  pause(id: string): Promise<void>;
  /** Goes on with a paused or failed area from the bytes it has. */
  resume(id: string): Promise<void>;
  /** Removes an area in any state, with every file it has. */
  remove(id: string): Promise<void>;
  /**
   * Changes whether an area may use a connection charged by use. Allowing it
   * lets an area that waits for 'unmetered' go on at once. Withdrawing it
   * while the area downloads over such a connection makes it wait.
   */
  setAllowMetered(id: string, allow: boolean): Promise<void>;
  /** Every area the downloader knows, complete or not. */
  list(): Promise<AreaState[]>;
  /** Called on every change of status and, while downloading, about once a second. Returns the unsubscribe. */
  onChange(listener: (state: AreaState) => void): () => void;
  /** Free bytes where areas are stored, or undefined if the platform cannot tell. */
  freeBytes(): Promise<number | undefined>;
}

// ---------------------------------------------------------------- platform: the network

/** The true network state, from the shell and not from the browser (D12). */
export interface NetworkState {
  online: boolean;
  /** True on mobile data or any connection the phone marks as charged by use. */
  metered: boolean;
}

export interface Network {
  get(): Promise<NetworkState>;
  onChange(listener: (state: NetworkState) => void): () => void;
}

// ---------------------------------------------------------------- the service the screens use

/** What the user asked for. */
export interface AreaRequest {
  /** A rectangle, or a whole county by its ID. */
  where: { bounds: Bounds } | { county: string };
  /** The layers to include, by layer name. */
  layers: string[];
  /** The highest zoom of aerial imagery to include. Other layers come at full detail. */
  aerialMaxzoom: number;
}

export interface LayerEstimate {
  county: string;
  layer: string;
  title: string;
  bytes: number;
  /** Tiles in the new archive. 0 for a file taken whole (a whole county), whose directories are not read. */
  tiles: number;
}

/** What a request would download. Exact, not a guess: it comes from the hosted archives' own directories. */
export interface AreaEstimate {
  bytes: number;
  layers: LayerEstimate[];
  /** Requested layers that no hosted archive has for this place. */
  missing: string[];
}

/** An area as stored and shown. This is the `record` of its job. */
export interface AreaRecord {
  id: string;
  /** The name the user gave, or the county's name. */
  name: string;
  /** The rectangle downloaded. For a whole county, the county's bounds. */
  bounds: Bounds;
  /** Set when the area is a whole county. */
  county?: string;
  layers: string[];
  aerialMaxzoom: number;
  /** ISO date and time the download was started. */
  created: string;
  /** The catalog release the data came from. */
  release: string;
  /** The newest data date among its archives' sources, for "data from ...". */
  dataDate: string;
  bytes: number;
}

export interface AreaView {
  record: AreaRecord;
  status: AreaStatus;
  error?: AreaError;
  /** With status 'waiting': see AreaState.waitingFor. */
  waitingFor?: 'connection' | 'unmetered';
  allowMetered: boolean;
  bytesDone: number;
  bytesTotal: number;
}

export interface CountyOffer {
  county: string;
  countyName: string;
  bounds: Bounds;
  /** The layers hosted for this county, with the size of each whole archive. */
  layers: { layer: string; title: string; bytes: number; maxzoom: number }[];
}

export interface DownloadService {
  /** What can be downloaded. Needs a connection the first time; the last catalog is kept for later. */
  offers(signal?: AbortSignal): Promise<CountyOffer[]>;
  /** The size of a request before it is started. Needs a connection. Rejects with AbortError when aborted. */
  estimate(request: AreaRequest, signal?: AbortSignal): Promise<AreaEstimate>;
  /** Starts a download and returns the new area's ID. */
  /**
   * `allowMetered` is true only when the user was asked and agreed to use
   * mobile data for this download. Left out, it is false: a download started
   * on Wi-Fi never goes on over mobile data by itself.
   */
  start(request: AreaRequest, name: string, options?: { allowMetered?: boolean }): Promise<string>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  /** The user's answer to "use mobile data for this download?", for an area that waits for Wi-Fi. */
  setAllowMetered(id: string, allow: boolean): Promise<void>;
  /** Deletes an area, downloaded or not. */
  remove(id: string): Promise<void>;
  /** Every area, newest first. */
  areas(): readonly AreaView[];
  /** Called whenever areas() would give something new. Returns the unsubscribe. */
  onAreas(listener: (areas: readonly AreaView[]) => void): () => void;
  /** Called when an area became complete or was removed, so the map must load its archives again. */
  onArchivesChanged(listener: () => void): () => void;
  network(): NetworkState;
  onNetwork(listener: (state: NetworkState) => void): () => void;
  freeBytes(): Promise<number | undefined>;
}
