// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { fromBase64, toBase64 } from './base64';

describe('base64 for the bridge', () => {
  it('round trips every byte value and large buffers', () => {
    const all = new Uint8Array(256).map((_, i) => i);
    expect(fromBase64(toBase64(all))).toEqual(all);
    const big = new Uint8Array(300_001).map((_, i) => (i * 7919) & 255);
    const text = toBase64(big);
    expect(text.length).toBe(Math.ceil(big.length / 3) * 4);
    expect(toBase64(new TextEncoder().encode('Macon'))).toBe('TWFjb24=');
    expect(fromBase64(text)).toEqual(big);
  });

  it('handles nothing', () => {
    expect(toBase64(new Uint8Array(0))).toBe('');
    expect(fromBase64('')).toEqual(new Uint8Array(0));
  });
});
