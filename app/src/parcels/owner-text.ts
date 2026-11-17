// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// How a parcel's owner, acreage and ID are written on screen, and the
// development-only owner mask.
//
// Owner names of private people must not appear in committed screenshots,
// logs or reports (CLAUDE.md rule 1). In a development build the mask
// replaces every owner name the screens show with OWNER_MASK_TEXT, so
// evidence screenshots can be kept. A production build cannot turn it on:
// OwnerMask ignores every request unless it was created as allowed, and the
// app creates it allowed only when import.meta.env.DEV is true.

/** What a masked owner name reads as. */
export const OWNER_MASK_TEXT = 'OWNER NAME';

/** The query flag that starts a development build with owners masked: ?maskOwners */
export const MASK_OWNERS_FLAG = 'maskOwners';

export function maskRequested(search: string): boolean {
  return new URLSearchParams(search).has(MASK_OWNERS_FLAG);
}

/** Whether owner names are masked. Follows the Svelte store contract. */
export class OwnerMask {
  private value: boolean;
  private readonly subscribers = new Set<(on: boolean) => void>();

  /**
   * @param allowed true only in a development build; otherwise the mask stays off whatever is asked
   * @param initial whether to start masked (ignored when not allowed)
   */
  constructor(
    readonly allowed: boolean,
    initial = false,
  ) {
    this.value = allowed && initial;
  }

  get on(): boolean {
    return this.value;
  }

  set(on: boolean): void {
    const next = this.allowed && on;
    if (next === this.value) return;
    this.value = next;
    for (const s of [...this.subscribers]) s(next);
  }

  subscribe(run: (on: boolean) => void): () => void {
    this.subscribers.add(run);
    run(this.value);
    return () => this.subscribers.delete(run);
  }
}

/** How long a missing owner may be said: the short form fits the position readout. */
export type OwnerForm = 'short' | 'full';

/** The owner name to show: as the county wrote it, masked, or a plain note when the county gives none. */
export function ownerText(owner: string, masked: boolean, form: OwnerForm = 'full'): string {
  const name = owner.trim();
  if (!name) return form === 'short' ? 'Owner not listed' : 'Owner not listed in the county record';
  return masked ? OWNER_MASK_TEXT : name;
}

/** Acreage to one decimal, or a plain note when the county gives none (it records 0 for many town lots). */
export function acresText(acres: number | null): string {
  if (acres === null || !Number.isFinite(acres) || acres <= 0) return 'Acreage not listed in the county record';
  const fixed = acres.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${fixed} ${fixed === '1.0' ? 'acre' : 'acres'}`;
}
