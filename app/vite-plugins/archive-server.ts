// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Serves the built tile archives to the web app in a browser, during
// development (vite) and preview (vite preview). This is the browser side of
// the archive reader in DECISIONS D5: ordinary HTTP Range requests against
// /_tiles/<county-id>/<layer>.pmtiles, plus an index of what is installed at
// /_tiles/index.json. The Android shell answers the same paths natively.
//
// The folder is read on every index request, so an archive that the pipeline
// finishes while the server runs shows up on the next page load.

import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { ARCHIVE_ID_PATTERN, parseArchiveMeta, parseArchivePath, type ArchiveEntry } from '../src/platform/archive-meta.ts';

type Next = (err?: unknown) => void;

/** Lists every <county>/<layer>.pmtiles that has a valid <layer>.meta.json beside it. */
export function scanArchives(root: string, warn: (msg: string) => void = () => {}): ArchiveEntry[] {
  const out: ArchiveEntry[] = [];
  let counties: string[];
  try {
    counties = readdirSync(root).sort();
  } catch {
    return out;
  }
  for (const county of counties) {
    if (!ARCHIVE_ID_PATTERN.test(county)) continue;
    const dir = join(root, county);
    let files: string[];
    try {
      if (!statSync(dir).isDirectory()) continue;
      files = readdirSync(dir).sort();
    } catch {
      continue;
    }
    for (const file of files) {
      const m = /^(.+)\.pmtiles$/.exec(file);
      const layer = m?.[1];
      if (!layer || !ARCHIVE_ID_PATTERN.test(layer)) continue;
      const metaFile = join(dir, `${layer}.meta.json`);
      try {
        const meta = parseArchiveMeta(JSON.parse(readFileSync(metaFile, 'utf8')));
        if (meta.county !== county || meta.layer !== layer) {
          warn(`${county}/${layer}: metadata names ${meta.county}/${meta.layer}, skipped`);
          continue;
        }
        out.push({ county, layer, meta });
      } catch (e) {
        warn(`${county}/${layer}: ${(e as Error).message}, skipped`);
      }
    }
  }
  return out;
}

function send(res: ServerResponse, status: number, body = ''): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

function handler(root: string, warn: (msg: string) => void) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/_tiles/')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405);

    const archives = scanArchives(root, warn);

    if (url.pathname === '/_tiles/index.json') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ archives }));
      return;
    }

    // Only paths of known archives are served. The pattern check in
    // parseArchivePath already refuses "..", slashes and odd characters.
    const ref = parseArchivePath(url.pathname);
    if (!ref || !archives.some((a) => a.county === ref.county && a.layer === ref.layer)) {
      return send(res, 404, 'No such archive');
    }
    const file = join(root, ref.county, `${ref.layer}.pmtiles`);
    const size = statSync(file).size;

    const range = req.headers.range;
    let start = 0;
    let end = size - 1;
    let partial = false;
    if (range !== undefined) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!m) return send(res, 416);
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start >= size || end < start) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return send(res, 416);
      }
      partial = true;
    }
    res.statusCode = partial ? 206 : 200;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(end - start + 1));
    if (partial) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file, { start, end }).pipe(res);
  };
}

/** The Vite plugin. `root` is the folder holding <county-id>/<layer>.pmtiles. */
export function archiveServer(root: string): Plugin {
  return {
    name: 'mapapp-archive-server',
    configureServer(server) {
      const warn = (msg: string) => server.config.logger.warn(`[archives] ${msg}`);
      server.middlewares.use(handler(root, warn));
    },
    configurePreviewServer(server) {
      const warn = (msg: string) => server.config.logger.warn(`[archives] ${msg}`);
      server.middlewares.use(handler(root, warn));
    },
  };
}
