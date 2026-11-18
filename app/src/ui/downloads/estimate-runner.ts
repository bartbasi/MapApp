// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Asks for the size of a picked area while the user frames it. The size needs
// a connection and takes a moment, so a request waits until the map has been
// still for a short while, and a newer request cancels an older one.

import type { AreaEstimate, AreaRequest } from '../../downloads/contract';

export type EstimateState =
  /** Nothing asked yet. */
  | { kind: 'none' }
  /** Waiting for the map to be still, or for the answer. */
  | { kind: 'working' }
  | { kind: 'ready'; estimate: AreaEstimate }
  /** Nothing hosted overlaps the area, or none of the layers asked for. */
  | { kind: 'empty' }
  /** No connection, so no size. */
  | { kind: 'offline' }
  | { kind: 'error' };

export type Estimator = (request: AreaRequest, signal: AbortSignal) => Promise<AreaEstimate>;

/** How long the map must be still before a size is asked for. */
export const ESTIMATE_DEBOUNCE_MS = 600;

/**
 * The service's own name for an error, when it gives one: 'offline',
 * 'no-space', 'nothing' or 'catalog-unavailable' (downloads/errors.ts). The
 * contract does not list these, so they are read by name and not by class.
 */
export function errorCode(e: unknown): string | undefined {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** True when an estimate holds nothing to download. */
export function isEmptyEstimate(e: AreaEstimate, request: AreaRequest): boolean {
  if (e.bytes <= 0) return true;
  return request.layers.length > 0 && request.layers.every((l) => e.missing.includes(l));
}

export class EstimateRunner {
  private state: EstimateState = { kind: 'none' };
  private key = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | null = null;
  private online = true;
  private last: AreaRequest | null = null;

  constructor(
    private readonly estimator: Estimator,
    private readonly onState: (s: EstimateState) => void,
    private readonly debounceMs = ESTIMATE_DEBOUNCE_MS,
  ) {}

  get current(): EstimateState {
    return this.state;
  }

  /** The phone went online or offline. Coming online asks again. */
  setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    if (!online) {
      this.cancel();
      if (this.last) this.set({ kind: 'offline' });
    } else if (this.last) {
      this.key = '';
      this.request(this.last);
    }
  }

  /** A new request (the frame moved, or a choice changed), or null when there is nothing to ask. */
  request(request: AreaRequest | null): void {
    this.last = request;
    if (!request) {
      this.cancel();
      this.key = '';
      this.set({ kind: 'none' });
      return;
    }
    const key = JSON.stringify(request);
    if (key === this.key && this.state.kind !== 'error') return;
    this.key = key;
    this.cancel();
    if (!this.online) {
      this.set({ kind: 'offline' });
      return;
    }
    this.set({ kind: 'working' });
    this.timer = setTimeout(() => void this.run(request, key), this.debounceMs);
  }

  /** Asks again for the same request, after an error. */
  retry(): void {
    if (!this.last) return;
    this.key = '';
    this.request(this.last);
  }

  destroy(): void {
    this.cancel();
  }

  private async run(request: AreaRequest, key: string): Promise<void> {
    this.timer = undefined;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const estimate = await this.estimator(request, controller.signal);
      if (controller.signal.aborted || key !== this.key) return;
      this.set(isEmptyEstimate(estimate, request) ? { kind: 'empty' } : { kind: 'ready', estimate });
    } catch (e) {
      if (controller.signal.aborted || key !== this.key) return;
      if ((e as { name?: string } | null)?.name === 'AbortError') return;
      const code = errorCode(e);
      if (code === 'nothing') return this.set({ kind: 'empty' });
      if (code === 'offline' || !this.online) return this.set({ kind: 'offline' });
      console.warn('the download size could not be worked out:', e);
      this.set({ kind: 'error' });
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  private cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.controller?.abort();
    this.controller = null;
  }

  private set(s: EstimateState): void {
    this.state = s;
    this.onState(s);
  }
}
