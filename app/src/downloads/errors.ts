// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The errors the download service rejects with, so the screens can tell them
// apart: by class (`instanceof`) or by `code`.

export type DownloadErrorCode = 'offline' | 'no-space' | 'nothing' | 'catalog-unavailable';

export abstract class DownloadServiceError extends Error {
  abstract readonly code: DownloadErrorCode;
}

/** The request needs a connection and there is none. */
export class OfflineError extends DownloadServiceError {
  readonly code = 'offline';
  override name = 'OfflineError';
  constructor(message = 'There is no connection.') {
    super(message);
  }
}

/** The phone does not have room for the download and the margin kept free. */
export class NotEnoughSpaceError extends DownloadServiceError {
  readonly code = 'no-space';
  override name = 'NotEnoughSpaceError';
  constructor(
    /** Bytes the download needs, the margin included. */
    readonly neededBytes: number,
    /** Bytes free where areas are stored. */
    readonly freeBytes: number,
  ) {
    super(`The download needs ${neededBytes} bytes and ${freeBytes} are free.`);
  }
}

/** Nothing hosted matches the request: no layer for that place. */
export class NothingToDownloadError extends DownloadServiceError {
  readonly code = 'nothing';
  override name = 'NothingToDownloadError';
  constructor(message = 'There is no map data to download for this place and these layers.') {
    super(message);
  }
}

/** The catalog could not be fetched and no earlier copy is kept, or it is not valid. */
export class CatalogUnavailableError extends DownloadServiceError {
  readonly code = 'catalog-unavailable';
  override name = 'CatalogUnavailableError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** True for the rejection of an aborted operation. */
export function isAbortError(e: unknown): boolean {
  return (e instanceof Error || e instanceof DOMException) && e.name === 'AbortError';
}
