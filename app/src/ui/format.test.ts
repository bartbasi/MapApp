// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { splitIds } from './format';

describe('splitIds', () => {
  it('picks out parcel IDs so they are kept on one line', () => {
    expect(splitIds('OWNER NAME, parcel 08-06-23-100-005')).toEqual([
      { text: 'OWNER NAME, parcel ', id: false },
      { text: '08-06-23-100-005', id: true },
    ]);
    expect(splitIds('Parcel 12345 · GPS accurate to about 13 ft (4 m)')).toEqual([
      { text: 'Parcel ', id: false },
      { text: '12345', id: true },
      { text: ' · GPS accurate to about 13 ft (4 m)', id: false },
    ]);
    expect(splitIds('No numbers here')).toEqual([{ text: 'No numbers here', id: false }]);
  });
});
