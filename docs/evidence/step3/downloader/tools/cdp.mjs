// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Evaluates JavaScript in the app's WebView on the emulator through the
// DevTools protocol over adb, and prints the result as JSON. Used to drive
// window.__mapappDownloads in a test build (VITE_MAPAPP_DOWNLOAD_HOOK=1).
//
//   node cdp.mjs <adb serial> '<expression>'      (the expression may be async)

import { execFileSync } from 'node:child_process';

const [serial, expression] = process.argv.slice(2);
if (!serial || !expression) {
  console.error("usage: node cdp.mjs <serial> '<expression>'");
  process.exit(2);
}
const adb = (...a) => execFileSync('adb', ['-s', serial, ...a], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });

const sockets = adb('shell', 'cat', '/proc/net/unix')
  .split('\n')
  .map((l) => /@(webview_devtools_remote_\d+)/.exec(l)?.[1])
  .filter(Boolean);
if (sockets.length === 0) throw new Error('no WebView DevTools socket: is the app running?');
const socket = sockets[sockets.length - 1];
const port = 9333;
adb('forward', `tcp:${port}`, `localabstract:${socket}`);
const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = pages.find((p) => p.type === 'page' && p.url.startsWith('https://localhost'));
if (!page) throw new Error(`no app page among ${pages.map((p) => p.url).join(', ')}`);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const result = await new Promise((resolve, reject) => {
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id === 1) resolve(msg);
  };
  ws.onerror = reject;
  ws.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: `(async () => (${expression}))()`, awaitPromise: true, returnByValue: true, timeout: 600000 },
    }),
  );
});
ws.close();
if (result.result?.exceptionDetails) {
  console.error(JSON.stringify(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails));
  process.exit(1);
}
console.log(JSON.stringify(result.result?.result?.value ?? null));
process.exit(0);
