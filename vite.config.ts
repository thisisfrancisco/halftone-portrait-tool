import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * Dev-only: lets the harness POST a rendered frame to disk so it can be
 * inspected outside the browser. Never part of a production build.
 */
function snapshotPlugin(): Plugin {
  return {
    name: 'halftone-snapshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__snap', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('POST only');
        }
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c as Buffer));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const b64 = String(body.data).replace(/^data:image\/\w+;base64,/, '');
            mkdirSync('.snap', { recursive: true });
            const file = `.snap/${String(body.name || 'frame').replace(/[^\w.-]/g, '_')}`;
            writeFileSync(file, Buffer.from(b64, 'base64'));
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, file, bytes: b64.length }));
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build works both at a domain root and under a GitHub
  // Pages project path (/halftone-portrait-tool/) without hardcoding either.
  base: './',
  plugins: [react(), snapshotPlugin()],
  server: { port: 5173 },
});
