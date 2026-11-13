// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { archiveServer } from './vite-plugins/archive-server.ts';

// Built archives from the pipeline. Override with MAPAPP_ARCHIVES to test
// against another folder (for example one with a layer missing).
const archivesDir = process.env['MAPAPP_ARCHIVES'] ?? resolve(import.meta.dirname, '../data/build');

export default defineConfig({
  plugins: [svelte(), archiveServer(archivesDir)],
  build: {
    target: 'es2022',
    // MapLibre is one large module. Splitting it gains nothing offline.
    chunkSizeWarningLimit: 1500,
  },
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
});
