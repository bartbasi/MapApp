// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The locate button's three states and what moves between them.
//
// - off: position is not being read. No marker.
// - free: position is on and the marker shows, but the map stays where the user put it.
// - following: position is on and the map keeps the phone in the middle.
//
// A tap on the button always ends in following. Moving the map by hand
// (a drag, a pinch, a rotate) ends following but keeps the position on.
// Turning position off, or the phone refusing it, ends in off.

export type FollowMode = 'off' | 'free' | 'following';

export type FollowEvent = 'tap' | 'user-move' | 'turn-off' | 'failed';

export function nextFollowMode(mode: FollowMode, event: FollowEvent): FollowMode {
  switch (event) {
    case 'tap':
      return 'following';
    case 'user-move':
      return mode === 'following' ? 'free' : mode;
    case 'turn-off':
    case 'failed':
      return 'off';
  }
}

/** The zoom the map goes to on the first fix after position is turned on: 17, or closer if the map already is. */
export const LOCATE_ZOOM = 17;

export function locateZoom(currentZoom: number): number {
  return Math.max(currentZoom, LOCATE_ZOOM);
}
