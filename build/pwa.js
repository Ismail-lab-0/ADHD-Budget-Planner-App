// build/pwa.js — the PWA sidecar files for the FULL / PAID build ONLY
// (docs/app-x7k2m9/). The demo build never calls anything in here, so
// nothing PWA-related — no manifest, no service worker, no icons, no
// <head> tags — ever reaches docs/index.html.
//
// Zero dependencies, no network access at build time (CLAUDE.md): the two
// icon PNGs (192 / 512) and the iOS apple-touch-icon (180) are rasterised
// here from the app's own brand mark — the `brand` glyph in
// src/ui/components/icons.js — on a solid #1F3D2B field, using a tiny
// self-contained PNG encoder (Node's built-in zlib for the pixel data,
// an inline CRC-32 for the chunk checksums).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const THEME = { r: 0x1f, g: 0x3d, b: 0x2b }; // #1F3D2B — icon field + theme_color
const MARK = { r: 0xf7, g: 0xf3, b: 0xec }; //  #F7F3EC — the brand mark (== background_color)

export const PWA_CACHE_VERSION = 'budget-planner-v1';

// ---------------------------------------------------------------------------
//  Minimal PNG encoder (truecolour RGB, no interlace, single IDAT)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/** @param {Buffer} rgb width*height*3 bytes, row-major */
function encodePng(width, height, rgb) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour (RGB)
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // per-scanline filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
//  Rasterise the brand mark (signed-distance fields, 1px anti-aliased)
// ---------------------------------------------------------------------------

function sdRoundBox(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - hx + r;
  const qy = Math.abs(py - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/**
 * One square icon: a solid #1F3D2B field with the brand mark (rounded
 * frame + check, the exact geometry of icons.js's `brand` glyph in its
 * 24-unit space) centred in #F7F3EC. Fully opaque — no alpha channel, so
 * iOS never composites it onto black.
 * @param {number} size edge length in pixels
 * @returns {Buffer} PNG bytes
 */
function renderIcon(size) {
  const S = size;
  const MARK_SCALE = 0.62; // the 24-unit glyph occupies ~62% of the icon — inside the maskable safe zone
  const k = (S * MARK_SCALE) / 24; // 24-space unit -> pixels
  const ox = S / 2 - 12 * k;
  const oy = S / 2 - 12 * k;
  const X = (u) => ox + u * k;
  const Y = (v) => oy + v * k;
  const half = (2.4 * k) / 2; // stroke a touch bolder than the 1.75 UI glyph
  const aa = Math.max(1, S / 256);

  // rect x=3 y=5.5 w=18 h=14 rx=4  ->  centre (12, 12.5), half (9, 7), r 4
  const fcx = X(12);
  const fcy = Y(12.5);
  const fhx = 9 * k;
  const fhy = 7 * k;
  const fr = 4 * k;
  // check path: M8 12.4 -> 10.6 15 -> 16.2 9.4
  const c1x = X(8);
  const c1y = Y(12.4);
  const c2x = X(10.6);
  const c2y = Y(15);
  const c3x = X(16.2);
  const c3y = Y(9.4);

  const rgb = Buffer.alloc(S * S * 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dFrame = Math.abs(sdRoundBox(px, py, fcx, fcy, fhx, fhy, fr)) - half;
      const dCheck =
        Math.min(
          sdSegment(px, py, c1x, c1y, c2x, c2y),
          sdSegment(px, py, c2x, c2y, c3x, c3y)
        ) - half;
      const d = Math.min(dFrame, dCheck);
      const cov = Math.min(1, Math.max(0, 0.5 - d / aa));
      const i = (y * S + x) * 3;
      rgb[i] = Math.round(THEME.r + (MARK.r - THEME.r) * cov);
      rgb[i + 1] = Math.round(THEME.g + (MARK.g - THEME.g) * cov);
      rgb[i + 2] = Math.round(THEME.b + (MARK.b - THEME.b) * cov);
    }
  }
  return encodePng(S, S, rgb);
}

// ---------------------------------------------------------------------------
//  manifest.json / sw.js / <head> injections
// ---------------------------------------------------------------------------

const MANIFEST = {
  name: 'Budget and Planner',
  short_name: 'Budget',
  display: 'standalone',
  theme_color: '#1F3D2B',
  background_color: '#F7F3EC',
  start_url: './',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};

function serviceWorkerSource() {
  return `// Generated by build/pwa.js for the full/paid build — absent from the demo.
// One versioned cache, filled on install, pruned on activate. The app
// shell is a single static HTML file, so once it's cached the app opens
// with no network at all.
const CACHE = '${PWA_CACHE_VERSION}';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
`;
}

/** The extra <head> lines spliced into the paid build's index.html. */
export function pwaHeadTags() {
  return [
    '<link rel="manifest" href="./manifest.json" />',
    '<link rel="apple-touch-icon" href="./apple-touch-icon.png" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    '<meta name="apple-mobile-web-app-title" content="Budget" />',
    '<meta name="theme-color" content="#1F3D2B" />',
  ]
    .map((line) => `    ${line}`)
    .join('\n');
}

/** The service-worker registration snippet spliced in before </body>. */
export function pwaRegisterScript() {
  return [
    '    <script>',
    "      if ('serviceWorker' in navigator) {",
    "        window.addEventListener('load', function () {",
    "          navigator.serviceWorker.register('./sw.js').catch(function () {});",
    '        });',
    '      }',
    '    </script>',
  ].join('\n');
}

/** Writes manifest.json, sw.js and the three icon PNGs into `outDir`. */
export function writePwaAssets(outDir) {
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(MANIFEST, null, 2)}\n`);
  writeFileSync(join(outDir, 'sw.js'), serviceWorkerSource());
  writeFileSync(join(outDir, 'icon-192.png'), renderIcon(192));
  writeFileSync(join(outDir, 'icon-512.png'), renderIcon(512));
  writeFileSync(join(outDir, 'apple-touch-icon.png'), renderIcon(180));
}
