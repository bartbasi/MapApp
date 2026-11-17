// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Keeps the position readout up to date as fixes arrive (D26). For each fix
// it asks the parcel source about that spot, one query at a time with the
// latest fix winning (latest-only.ts), and turns the newest answer and the
// newest fix into a readout. Between answers the last answer is reused with
// the new fix: readout.ts widens the uncertainty by how far the phone has
// moved, so a slightly old answer can only be more cautious.
//
// It also reads the outline of the parcel the phone is in, once each time
// that parcel changes, for the soft highlight on the map.
//
// Nothing here stores or sends the position.

import { LocalFrame } from './local-frame';
import { LatestOnly } from './latest-only';
import type { ParcelOutline } from './parcel-outline';
import type { LngLat, ParcelSource, PositionQuery } from './parcel-source';
import { positionReadout, type PositionFix, type Readout } from './readout';
import { EMPTY_RELATION, relationFeatures, type HereOutline, type RelationData } from './relation-features';

/** A parcel source that can also give a parcel's outline. */
export interface OutlineSource extends ParcelSource {
  outline(pid: string, county: string, around: LngLat): Promise<ParcelOutline | null>;
}

export interface TrackerState {
  /** The readout for the latest fix, or null with no fix or no answer yet. */
  readout: Readout | null;
  fix: PositionFix | null;
  staleFix: boolean;
  relation: RelationData;
}

export interface QueryTimings {
  count: number;
  lastMs: number;
  meanMs: number;
  maxMs: number;
}

/** A new query is not needed until the phone has moved this far from the last one, in meters. */
export const REQUERY_MOVE_M = 0.5;

const EMPTY: TrackerState = { readout: null, fix: null, staleFix: false, relation: EMPTY_RELATION };

function moved(a: LngLat, b: LngLat): number {
  return Math.hypot(...new LocalFrame(a.lng, a.lat).toLocal(b.lng, b.lat));
}

export class ParcelTracker {
  private state: TrackerState = EMPTY;
  private query: PositionQuery | null = null;
  private here: HereOutline | null = null;
  private readonly subscribers = new Set<(s: TrackerState) => void>();
  private readonly queries: LatestOnly<LngLat, PositionQuery>;
  private readonly outlines: LatestOnly<{ pid: string; county: string; at: LngLat }, ParcelOutline | null>;
  private readonly times: number[] = [];

  constructor(
    private readonly source: OutlineSource,
    now?: () => number,
  ) {
    this.queries = new LatestOnly({
      run: (at, signal) => this.source.positionQuery(at, {}, signal),
      onResult: (_at, q, ms) => {
        this.times.push(ms);
        if (this.times.length > 600) this.times.shift();
        this.query = q;
        this.recompute();
      },
      onError: (_at, e) => console.warn('the parcel query failed:', e),
      same: (a, b) => moved(a, b) < REQUERY_MOVE_M,
      ...(now ? { now } : {}),
    });
    this.outlines = new LatestOnly({
      run: (p) => this.source.outline(p.pid, p.county, p.at),
      onResult: (p, outline) => {
        this.here = outline ? { pid: p.pid, county: p.county, lines: outline.lines } : null;
        this.recompute();
      },
      onError: (_p, e) => console.warn('the parcel outline could not be read:', e),
      same: (a, b) => a.pid === b.pid && a.county === b.county,
      ...(now ? { now } : {}),
    });
  }

  /** Svelte store contract. */
  subscribe(run: (s: TrackerState) => void): () => void {
    this.subscribers.add(run);
    run(this.state);
    return () => this.subscribers.delete(run);
  }

  get current(): TrackerState {
    return this.state;
  }

  /** A new fix, or null when position is off. */
  update(fix: PositionFix | null, staleFix = false): void {
    if (!fix) {
      this.queries.cancel();
      this.outlines.cancel();
      this.query = null;
      this.here = null;
      this.set(EMPTY);
      return;
    }
    this.state = { ...this.state, fix, staleFix };
    this.queries.push({ lng: fix.lng, lat: fix.lat });
    this.recompute();
  }

  /** How long the parcel queries took, for the performance check. */
  timings(): QueryTimings {
    const t = this.times;
    if (t.length === 0) return { count: 0, lastMs: 0, meanMs: 0, maxMs: 0 };
    return { count: t.length, lastMs: t[t.length - 1]!, meanMs: t.reduce((a, b) => a + b, 0) / t.length, maxMs: Math.max(...t) };
  }

  destroy(): void {
    this.update(null);
    this.subscribers.clear();
  }

  private recompute(): void {
    const { fix, staleFix } = this.state;
    if (!fix || !this.query) {
      this.set({ ...this.state, readout: null, relation: EMPTY_RELATION });
      return;
    }
    const readout = positionReadout(fix, this.query);
    if (readout.kind === 'inside') {
      this.outlines.push({ pid: readout.parcel.pid, county: readout.parcel.county, at: this.query.at });
    }
    this.set({ fix, staleFix, readout, relation: relationFeatures(readout, fix, this.here, staleFix) });
  }

  private set(s: TrackerState): void {
    this.state = s;
    for (const run of [...this.subscribers]) run(s);
  }
}
