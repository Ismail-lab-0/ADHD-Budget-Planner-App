// Regression test for a real bug found during manual QA: build/build.js
// used to inline the bundled JS into index.html via
// `html.replace(scriptTagRe, stringValue)`. String.prototype.replace
// treats a *string* replacement's `$`-prefixed sequences ($$, $&, $1,
// etc.) as special substitution patterns — and the bundled JS is
// arbitrary application source that can legitimately contain one (at the
// time, src/core/money.js's `` `$${dollars}` `` — a literal "$"
// immediately before a `${...}` interpolation). That collapsed `$$` to a
// single `$`, silently deleting the dollar sign from every formatted
// money amount in every build, invisible to every other test in this
// suite because they all import the source modules directly and never
// exercise this string-replace step. Fixed by switching to a *function*
// replacer, whose return value is inserted verbatim with no
// special-pattern interpretation — see build/build.js's replace() call.
//
// money.js no longer contains that exact `$${...}` template (formatCents
// is now `Intl.NumberFormat`-based, for multi-currency support — see
// CLAUDE.md "Current status"), so this test no longer pattern-matches
// that specific source text — matching stale source would test nothing
// real. It instead verifies the actual fix directly: build.js's replacer
// is still a function, not a string, so this whole bug class stays fixed
// regardless of what any given module's source happens to contain later.
// The dynamic-execution check below (extract the real `formatCents` from
// the built bundle and call it) is unchanged and is the stronger of the
// two checks — it exercises the real build pipeline end-to-end and would
// fail on this bug (or any other output corruption) regardless of source
// syntax.
//
// This runs the real build as a subprocess (the same thing `npm run
// build` does) rather than re-implementing its logic, so it exercises the
// actual bug's exact mechanism, not a simplified stand-in for it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

// The build output lives in docs/ — GitHub Pages' "deploy from a branch"
// only offers / or /docs, and putting it under /docs keeps the repo root
// (src/, package.json, ...) off the published site.
const BUILD_JS = join(ROOT, 'build', 'build.js');
const DEMO_HTML = join(ROOT, 'docs', 'index.html');
const PAID_DIR = join(ROOT, 'docs', 'app-x7k2m9');
const PAID_HTML = join(PAID_DIR, 'index.html');

const buildDemo = () => execFileSync('node', [BUILD_JS, '--demo'], { cwd: ROOT, stdio: 'pipe' });
const buildFull = () => execFileSync('node', [BUILD_JS], { cwd: ROOT, stdio: 'pipe' });

describe('build/build.js', () => {
  test('the <script> tag is inlined via a function replacer, not a string one (the actual fix for the historic "$" bug)', () => {
    const buildSource = readFileSync(join(ROOT, 'build', 'build.js'), 'utf8');
    assert.match(
      buildSource,
      /html\s*=\s*html\.replace\(\s*scriptTagRe\s*,\s*\(\s*\)\s*=>/,
      'build.js must inline the bundled script via a function replacer — a string replacer here would silently mangle any "$" the bundle happens to contain, per this file\'s own header comment'
    );
  });

  // The full/paid build is written to an unguessable subdirectory of
  // docs/, still as index.html (buyers' Add to Home Screen / offline
  // install needs that filename). That subdir name must never leak into
  // the public demo bundle.
  const PAID_BUILD_FILE = PAID_HTML;

  test('a real dollar amount survives the actual build pipeline intact (full build -> docs/app-x7k2m9/index.html)', () => {
    buildFull();
    const html = readFileSync(PAID_BUILD_FILE, 'utf8');

    // Extracted and executed, not just string-matched — the bundle is an
    // IIFE with everything private, so unwrap just enough to pull
    // `formatCents` back out and call it directly, proving the built
    // bundle's actual runtime behavior, not a coincidental substring.
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'bundled <script> tag not found in the paid build');
    const bundleBody = scriptMatch[1].replace(/^\s*\(function \(\) \{\s*"use strict";/, '').replace(/\}\)\(\);\s*$/, '');
    const formatCents = new Function(`${bundleBody}\nreturn formatCents;`)();
    assert.equal(formatCents(150000), '$1,500.00');
  });

  // The demo gate (src/ui/demo-gate.js): the ONLY difference between the
  // two shipping builds is the DEMO_MODE flag, flipped by `--demo`. These
  // two tests lock that contract in — the exact thing the feature brief
  // asks to be able to `grep` for.
  test('the full build (no flag) writes the paid build with DEMO_MODE = false', () => {
    buildFull();
    const html = readFileSync(PAID_HTML, 'utf8');
    assert.match(html, /const DEMO_MODE = false;/, 'full build must keep DEMO_MODE = false');
    assert.doesNotMatch(html, /const DEMO_MODE = true;/, 'full build must not contain DEMO_MODE = true');
  });

  test('the --demo build writes docs/index.html with DEMO_MODE = true and still builds cleanly', () => {
    buildDemo();
    const html = readFileSync(DEMO_HTML, 'utf8');
    assert.match(html, /const DEMO_MODE = true;/, '--demo build must flip DEMO_MODE to true');
    assert.doesNotMatch(html, /const DEMO_MODE = false;/, '--demo build must not leave a DEMO_MODE = false line');
    // The flag flip must not have corrupted the bundle.
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'bundled <script> tag not found in docs/index.html');
    const bundleBody = scriptMatch[1].replace(/^\s*\(function \(\) \{\s*"use strict";/, '').replace(/\}\)\(\);\s*$/, '');
    const formatCents = new Function(`${bundleBody}\nreturn formatCents;`)();
    assert.equal(formatCents(150000), '$1,500.00');
    // The demo copy the user must see verbatim at the limit.
    assert.match(html, /that's the demo limit/, 'demo build must carry the limit-modal message');
    assert.match(html, /Get the full app/, 'demo build must carry the CTA label');
  });

  test('the public demo bundle contains no reference to the paid build path', () => {
    buildDemo();
    const html = readFileSync(DEMO_HTML, 'utf8');
    assert.doesNotMatch(html, /app-x7k2m9/, 'the unguessable paid-build path must never appear in the public demo');
  });
});

describe('PWA (full/paid build only — build/pwa.js)', () => {
  // Reads the big-endian uint32 width/height from a PNG's IHDR chunk
  // (bytes 16-24), and asserts the 8-byte PNG signature.
  function pngSize(path) {
    const buf = readFileSync(path);
    assert.deepEqual(
      [...buf.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      `${path} is not a PNG`
    );
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  test('the paid build emits manifest.json, sw.js and three icon PNGs beside index.html', () => {
    buildFull();
    for (const name of ['manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
      assert.ok(existsSync(join(PAID_DIR, name)), `docs/app-x7k2m9/${name} should exist`);
    }
    assert.deepEqual(pngSize(join(PAID_DIR, 'icon-192.png')), { width: 192, height: 192 });
    assert.deepEqual(pngSize(join(PAID_DIR, 'icon-512.png')), { width: 512, height: 512 });
    assert.deepEqual(pngSize(join(PAID_DIR, 'apple-touch-icon.png')), { width: 180, height: 180 });
  });

  test('manifest.json has exactly the specified fields', () => {
    buildFull();
    const m = JSON.parse(readFileSync(join(PAID_DIR, 'manifest.json'), 'utf8'));
    assert.equal(m.name, 'Budget and Planner');
    assert.equal(m.short_name, 'Budget');
    assert.equal(m.display, 'standalone');
    assert.equal(m.theme_color, '#1F3D2B');
    assert.equal(m.background_color, '#F7F3EC');
    assert.equal(m.start_url, './');
    assert.deepEqual(
      m.icons.map((i) => `${i.sizes} ${i.type}`),
      ['192x192 image/png', '512x512 image/png']
    );
  });

  test('paid index.html links the manifest + apple-touch-icon and carries the iOS meta tags', () => {
    buildFull();
    const html = readFileSync(PAID_HTML, 'utf8');
    assert.match(html, /<link rel="manifest" href="\.\/manifest\.json"/);
    assert.match(html, /<link rel="apple-touch-icon" href="\.\/apple-touch-icon\.png"/);
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
    assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="default"/);
    assert.match(html, /<meta name="theme-color" content="#1F3D2B"/);
    assert.match(html, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  });

  test('sw.js is one versioned cache, filled on install, pruned on activate', () => {
    buildFull();
    const sw = readFileSync(join(PAID_DIR, 'sw.js'), 'utf8');
    assert.match(sw, /const CACHE = 'budget-planner-v1';/);
    assert.match(sw, /addEventListener\('install'[\s\S]*caches\.open\(CACHE\)[\s\S]*addAll\(ASSETS\)/);
    assert.match(sw, /addEventListener\('activate'[\s\S]*caches\.keys\(\)[\s\S]*key !== CACHE[\s\S]*caches\.delete/);
    assert.match(sw, /addEventListener\('fetch'[\s\S]*caches\.match\(request\)/);
  });

  test('the demo build emits NOTHING PWA-related', () => {
    buildDemo();
    const html = readFileSync(DEMO_HTML, 'utf8');
    for (const marker of [
      /rel="manifest"/,
      /manifest\.json/,
      /serviceWorker/,
      /sw\.js/,
      /apple-touch-icon/,
      /apple-mobile-web-app/,
      /mobile-web-app-capable/,
      /name="theme-color"/,
      /icon-192|icon-512/,
    ]) {
      assert.doesNotMatch(html, marker, `demo build must not contain ${marker}`);
    }
    for (const name of ['manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
      assert.ok(!existsSync(join(ROOT, 'docs', name)), `docs/${name} must not be generated for the demo`);
    }
  });

  // Leave docs/ in the canonical state the repo tracks: demo at
  // docs/index.html, paid + PWA sidecars under docs/app-x7k2m9/.
  test('(cleanup) rebuild both', () => {
    buildDemo();
    buildFull();
  });
});
