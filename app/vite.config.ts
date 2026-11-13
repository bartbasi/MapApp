// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { delimiter, resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { archiveServer } from './vite-plugins/archive-server.ts';

// Built archives from the pipeline. MAPAPP_ARCHIVES overrides this with one
// or more folders, separated by ";" on Windows and ":" elsewhere; the first
// folder that has a county and layer wins. For example, to add the stand-in
// aerial imagery made by scripts/make-standin-aerial.py:
//   MAPAPP_ARCHIVES="../data/build;../data/fixtures/aerial-standin" npm run dev
const archiveDirs = (process.env['MAPAPP_ARCHIVES'] ?? '../data/build')
  .split(delimiter)
  .filter(Boolean)
  .map((d) => resolve(import.meta.dirname, d));

export default defineConfig({
  plugins: [svelte(), archiveServer(archiveDirs)],
  build: {
    target: 'es2022',
    // MapLibre is one large module. Splitting it gains nothing offline.
    chunkSizeWarningLimit: 1500,
  },
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
});
