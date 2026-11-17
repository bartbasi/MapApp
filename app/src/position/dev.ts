// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Development only: a handle on window.__mapapp.position to play a route
// through the real store, marker and button, from the browser console or a
// test script. App.svelte loads this module only in a development build.
//
//   __mapapp.position.walkUrbana()          walk the Urbana demo route
//   __mapapp.position.replay(points, opts)  play any list of timed points
//   __mapapp.position.real()                back to the browser's own location
//   __mapapp.position.off()                 position off
//   __mapapp.position.snapshot()            the store's current state

import type { Platform } from '../platform/platform';
import { urbanaWalk, walkRoute, type RouteOptions } from './demo-route';
import { createPositionSource } from './index';
import { ReplayPositionSource, type ReplayOptions, type ReplayPoint } from './replay-source';
import type { PositionStore } from './store';

export function devPositionHandle(store: PositionStore, kind: Platform['kind']) {
  const play = (points: ReplayPoint[], options?: ReplayOptions) => {
    const source = new ReplayPositionSource(points, options);
    store.useSource(source);
    if (!store.snapshot.on) store.tapLocate();
    return source;
  };
  return {
    store,
    replay: play,
    walkUrbana: (route?: RouteOptions, options?: ReplayOptions) => play(urbanaWalk(route), options),
    walk: (corners: [number, number][], route?: RouteOptions, options?: ReplayOptions) => play(walkRoute(corners, route), options),
    real: () => store.useSource(createPositionSource(kind)),
    off: () => store.turnOff(),
    snapshot: () => store.snapshot,
  };
}
