#!/usr/bin/env node
// Trivial zero-dependency static file server for local development. See
// docs/ARCHITECTURE.md §8 — the dev index.html loads native ES modules,
// which some browsers (Chrome) block from file://, so serving over
// http://localhost avoids that friction. Not required for the built
// docs/index.html, which is a single self-contained file that works
// directly from file://.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 5173;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // So the paid build's PWA sidecars (docs/app-x7k2m9/) serve with the
  // right MIME type when checked locally via `npm start`.
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = normalize(join(ROOT, urlPath === '/' ? 'index.html' : urlPath));

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
      // Without this, a browser can keep serving an old cached copy of a
      // JS module after the file it imports has been deleted/renamed on
      // disk — the import 404s and the app fails to start, looking like a
      // real app bug when it's actually a stale local dev cache. This is
      // a local dev server for fast-changing source files; every response
      // must always be a fresh read from disk, never cached across reloads.
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}`);
});
