// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Development only: lets the page read hosted map files that send no
// cross-origin headers, as GitHub's release downloads do not. The page asks
// for /_remote?url=<address>; the development server fetches that address,
// following redirects, with the page's Range header, and passes the answer
// back. On a phone the shell makes these reads instead (contract.ts
// RemoteFiles), so nothing like this exists in a built app.
//
// Only a few hosts are passed through: GitHub's (where the files will be
// hosted, D15) and this laptop's release test server
// (scripts/release-test-server.mjs). The test server's catalog names the
// address the emulator uses for this laptop, 10.0.2.2, which the laptop itself
// reaches as 127.0.0.1, so that address is rewritten.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { Plugin } from 'vite';

const ROUTE = '/_remote';

const GITHUB_HOSTS = new Set(['github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']);
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '10.0.2.2']);

/** The address to fetch for a page's request, or null when it is not one this route passes through. */
export function passThroughTarget(raw: string | null): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === 'https:' && GITHUB_HOSTS.has(url.hostname)) return url;
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) {
    if (url.hostname === '10.0.2.2') url.hostname = '127.0.0.1';
    return url;
  }
  return null;
}

const PASSED_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];

function handler() {
  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): void => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== ROUTE) return next();
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end();
      return;
    }
    const target = passThroughTarget(url.searchParams.get('url'));
    if (!target) {
      res.statusCode = 403;
      res.end('Not a host this route passes through');
      return;
    }
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const headers: Record<string, string> = {};
    if (typeof req.headers.range === 'string') headers['Range'] = req.headers.range;
    fetch(target, { headers, redirect: 'follow', signal: controller.signal })
      .then((up) => {
        res.statusCode = up.status;
        for (const h of PASSED_HEADERS) {
          const v = up.headers.get(h);
          if (v !== null) res.setHeader(h, v);
        }
        res.setHeader('Cache-Control', 'no-store');
        if (!up.body) return void res.end();
        Readable.fromWeb(up.body as unknown as NodeReadableStream).on('error', () => res.destroy()).pipe(res);
      })
      .catch(() => {
        if (res.headersSent) return void res.destroy();
        res.statusCode = 502;
        res.end('The hosted file could not be reached');
      });
  };
}

/** The Vite plugin. It adds the route to the development server only, never to a build or a preview. */
export function remotePassThrough(): Plugin {
  return {
    name: 'mapapp-remote-pass-through',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(handler());
    },
  };
}
