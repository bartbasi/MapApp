// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A file server on this laptop that behaves like GitHub's release downloads,
// for testing the downloader with nothing published.
//
//   node scripts/release-test-server.mjs <folder> [--port 8765] [--expire 20]
//        [--expire-status 403] [--kbps 0] [--drop-every 0] [--drop-after 300000]
//
// The folder is one made by `pipeline/publish.py stage <tag> --base
// http://10.0.2.2:8765/dl/` (the emulator reaches this laptop at 10.0.2.2).
//
// What it copies from the real thing:
//   /dl/<file>              answers 302 to /signed/<token>/<file>, as GitHub
//                           redirects a release download to a signed address.
//   /signed/<token>/<file>  serves the file with byte ranges. The token stops
//                           working after --expire seconds and then answers
//                           403, as a signed address does when it runs out
//                           (--expire-status gives another status, such as 400
//                           or 404, which some hosts answer instead).
//   /<file>                 serves the file directly, with byte ranges.
//
// What it adds, to test a download that is interrupted:
//   --kbps N         limits the speed, so there is time to kill the app.
//   --drop-every K   cuts the connection in the middle of every Kth file
//                    response, after --drop-after bytes.
//
// Every request is printed as one line: time (UTC), status, method, path, range, bytes sent.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const folder = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const port = opt('port', 8765);
const expireSeconds = opt('expire', 20);
const expireStatus = opt('expire-status', 403);
const kbps = opt('kbps', 0);
const dropEvery = opt('drop-every', 0);
const dropAfter = opt('drop-after', 300_000);

/** token -> time it stops working */
const tokens = new Map();
let fileResponses = 0;

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : 'bad';
}

function serveFile(req, res, name, note) {
  if (name !== basename(name) || name.startsWith('.')) return finish(req, res, 400, note);
  const path = join(folder, name);
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return finish(req, res, 404, note);
  }
  if (!stat.isFile()) return finish(req, res, 404, note);
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const range = parseRange(req.headers.range, stat.size);
  if (range === 'bad') {
    res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
    res.end();
    return log(req, 416, note, 0);
  }
  const start = range ? range.start : 0;
  const end = range ? range.end : stat.size - 1;
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes',
    ETag: etag,
  };
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  const status = range ? 206 : 200;
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || stat.size === 0) {
    res.end();
    return log(req, status, note, 0);
  }
  fileResponses += 1;
  const cutAt = dropEvery > 0 && fileResponses % dropEvery === 0 ? dropAfter : Infinity;
  let sent = 0;
  let logged = false;
  const stream = createReadStream(path, { start, end, highWaterMark: 64 * 1024 });
  stream.on('data', (chunk) => {
    if (sent + chunk.length > cutAt) {
      logged = true;
      stream.destroy();
      res.destroy();
      return log(req, status, `${note} CUT`, sent);
    }
    sent += chunk.length;
    const ok = res.write(chunk);
    if (kbps > 0) {
      stream.pause();
      setTimeout(() => stream.resume(), (chunk.length / (kbps * 1000)) * 1000);
    } else if (!ok) {
      stream.pause();
      res.once('drain', () => stream.resume());
    }
  });
  stream.on('end', () => {
    res.end();
    if (logged) return;
    logged = true;
    log(req, status, note, sent);
  });
  stream.on('error', () => res.destroy());
  res.on('close', () => {
    stream.destroy();
    // A response the client or the server cut short is printed too.
    if (!logged) {
      logged = true;
      log(req, status, sent < end - start + 1 ? `${note} CLOSED EARLY` : note, sent);
    }
  });
}

function finish(req, res, status, note) {
  res.writeHead(status);
  res.end();
  log(req, status, note, 0);
}

function log(req, status, note, sent) {
  console.log(`${new Date().toISOString()} ${status} ${req.method} ${req.url} ${req.headers.range ?? '-'} sent=${sent}${note ? ` ${note}` : ''}`);
}

createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return finish(req, res, 405, '');
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const dl = /^\/dl\/([^/]+)$/.exec(path);
  if (dl) {
    const token = randomBytes(12).toString('hex');
    tokens.set(token, Date.now() + expireSeconds * 1000);
    res.writeHead(302, { Location: `/signed/${token}/${encodeURIComponent(dl[1])}` });
    res.end();
    return log(req, 302, '', 0);
  }
  const signed = /^\/signed\/([0-9a-f]+)\/([^/]+)$/.exec(path);
  if (signed) {
    const until = tokens.get(signed[1]);
    if (until === undefined || Date.now() > until) return finish(req, res, expireStatus, 'expired');
    return serveFile(req, res, signed[2], 'signed');
  }
  const plain = /^\/([^/]+)$/.exec(path);
  if (plain) return serveFile(req, res, plain[1], '');
  return finish(req, res, 404, '');
}).listen(port, '0.0.0.0', () => {
  console.log(`serving ${folder} on port ${port}; signed addresses last ${expireSeconds} s, then answer ${expireStatus}`);
});
