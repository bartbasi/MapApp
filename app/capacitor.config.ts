// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.bartbasi.mapapp',
  appName: 'MapApp',
  webDir: 'dist',
  android: {
    // The web app is served from https://localhost inside the WebView.
    // Tile archives are read through /_tiles/ on that same origin (D5).
    allowMixedContent: false,
  },
};

export default config;
