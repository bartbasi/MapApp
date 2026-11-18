// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// What the system back gesture or button does, for every panel, in one place.
// Back steps out of the screen the user is in, one level at a time; with no
// panel open it is left to the system (on Android, the app goes to the
// background). It never leaves the app from inside a panel.
//
// The Android shell asks the page by calling window.mapappBack(), which runs
// the step and returns true when the page used the back press, or false when
// the system should have it. In a browser the Escape key does the same.

export type PanelName = 'layers' | 'details' | 'sources' | 'diagnostics' | 'downloads';

export type BackStep =
  /** Picking an area: back to the list of downloads. */
  | { kind: 'downloads-list' }
  /** A page opened from another panel: back to that panel. */
  | { kind: 'open'; panel: PanelName }
  /** A panel at its first page: close it, back to the map. */
  | { kind: 'close' }
  /** Nothing open: the system has the back press. */
  | { kind: 'system' };

export function backStep(panel: PanelName | null, downloadsMode: 'list' | 'pick'): BackStep {
  switch (panel) {
    case null:
      return { kind: 'system' };
    case 'downloads':
      return downloadsMode === 'pick' ? { kind: 'downloads-list' } : { kind: 'close' };
    case 'sources':
      return { kind: 'open', panel: 'layers' };
    case 'diagnostics':
      return { kind: 'open', panel: 'sources' };
    case 'layers':
    case 'details':
      return { kind: 'close' };
  }
}
