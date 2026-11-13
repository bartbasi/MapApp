// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { defineConfig } from 'vitest/config';

// Unit tests cover plain TypeScript logic only, so they run in Node with no
// Svelte plugin and no browser.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
