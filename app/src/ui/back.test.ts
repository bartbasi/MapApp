// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { backStep, type PanelName } from './back';

describe('backStep', () => {
  it('goes from picking an area back to the list, and from the list to the map', () => {
    expect(backStep('downloads', 'pick')).toEqual({ kind: 'downloads-list' });
    expect(backStep('downloads', 'list')).toEqual({ kind: 'close' });
  });

  it('never leaves the app from inside a panel', () => {
    const panels: PanelName[] = ['layers', 'details', 'sources', 'diagnostics', 'downloads'];
    for (const p of panels) {
      for (const mode of ['list', 'pick'] as const) expect(backStep(p, mode).kind, `${p} ${mode}`).not.toBe('system');
    }
  });

  it('steps out of a page opened from another panel, as its own back arrow does', () => {
    expect(backStep('sources', 'list')).toEqual({ kind: 'open', panel: 'layers' });
    expect(backStep('diagnostics', 'list')).toEqual({ kind: 'open', panel: 'sources' });
    expect(backStep('layers', 'list')).toEqual({ kind: 'close' });
    expect(backStep('details', 'pick')).toEqual({ kind: 'close' });
  });

  it('leaves the back press to the system with nothing open', () => {
    expect(backStep(null, 'list')).toEqual({ kind: 'system' });
    expect(backStep(null, 'pick')).toEqual({ kind: 'system' });
  });
});
