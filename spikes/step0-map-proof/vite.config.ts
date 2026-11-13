import { defineConfig } from 'vite';
import { createReadStream, statSync } from 'node:fs';
import { resolve } from 'node:path';

// In a desktop browser the dev server answers /_tiles/<file> from data/spike
// with byte ranges, the same contract the Android shell provides on the device.
const tilesDir = resolve(import.meta.dirname, '../../data/spike');

export default defineConfig({
  build: { target: 'es2022' },
  worker: { format: 'es' },
  plugins: [
    {
      name: 'local-tiles',
      configureServer(server) {
        server.middlewares.use('/_tiles', (req, res) => {
          const file = resolve(tilesDir, decodeURIComponent((req.url ?? '/').slice(1).split('?')[0]));
          if (!file.startsWith(tilesDir)) { res.statusCode = 403; return res.end(); }
          let size: number;
          try { size = statSync(file).size; } catch { res.statusCode = 404; return res.end(); }
          const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
          const start = m ? Number(m[1]) : 0;
          const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
          res.statusCode = m ? 206 : 200;
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', end - start + 1);
          if (m) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          createReadStream(file, { start, end }).pipe(res);
        });
      },
    },
  ],
});
