// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { readPublicLandSite, sourcesForSite } from './public-land';

const sources = [
  { name: 'USGS PAD-US 4.1' },
  { name: 'Champaign County Regional Planning Commission, Champaign County Greenways' },
];

describe('sourcesForSite', () => {
  it('credits a site to the dataset its shape came from', () => {
    expect(sourcesForSite({ source: 'padus' }, sources)).toEqual([sources[0]]);
    expect(sourcesForSite({ source: 'ccrpc' }, sources)).toEqual([sources[1]]);
  });

  it('keeps every credit when the dataset is not recognized', () => {
    expect(sourcesForSite({ source: '' }, sources)).toEqual(sources);
    expect(sourcesForSite({ source: 'something-new' }, sources)).toEqual(sources);
  });

  it('keeps every credit when the recognized dataset is not among the sources', () => {
    expect(sourcesForSite({ source: 'ccrpc' }, [sources[0]!])).toEqual([sources[0]]);
  });
});

describe('readPublicLandSite', () => {
  it('reads the source field', () => {
    expect(readPublicLandSite({ name: 'A', manager: 'B', category: 'state', access: 'open', acres: 12, source: 'padus' }).source).toBe('padus');
    expect(readPublicLandSite({ name: 'A' }).source).toBe('');
  });
});
