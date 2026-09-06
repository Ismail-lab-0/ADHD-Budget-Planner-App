#!/usr/bin/env node
// Inlines /src (JS + CSS) into a single self-contained HTML file:
// `--demo` -> docs/index.html (gated public demo), no flag ->
// docs/app-x7k2m9/index.html (full paid build). Output lives in docs/
// because GitHub Pages' "deploy from a branch" only offers / or /docs as
// the publish folder — putting the build there (and NOT at the repo
// root) is what keeps /src and /package.json off the live site. The paid
// build sits at an unguessable subpath — not a guessable filename — so
// it isn't trivially discoverable from the public demo's origin; buyers
// still get a real index.html (Add to Home Screen / offline install need
// that name). The two builds differ only by the DEMO_MODE flag rewrite
// below; see src/ui/demo-gate.js. See
// docs/ARCHITECTURE.md §2/§6 ("must eventually be distributable as one
// self-contained HTML file ... a small, dependency-free Node script").
//
// The demo IS that one self-contained file. The paid build is the same
// self-contained index.html plus PWA sidecars (manifest.json, sw.js, and
// three icon PNGs rasterised at build time — see build/pwa.js) so it can
// be installed to a home screen and opened offline; nothing PWA-related
// is emitted for the demo.
//
// This is a purpose-built bundler for this project's specific, small ES
// module graph — not a general one. It only understands the subset of
// module syntax the codebase actually uses: named imports/exports of
// functions, consts, and classes via relative paths, one per line. If the
// code starts using default exports, re-exports, or dynamic import(), this
// script fails loudly (see assertSupported) rather than silently producing
// a broken bundle.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePwaAssets, pwaHeadTags, pwaRegisterScript } from './pwa.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');
const ENTRY = join(SRC, 'main.js');
const OUT_DIR = join(ROOT, 'docs'); // GitHub Pages publish folder (only / or /docs are selectable)

// The ONLY thing that differs between the two shipping builds. With
// `--demo`, the bundled `const DEMO_MODE = false;` line (from
// src/ui/demo-gate.js) is rewritten to `= true` and the output is the
// gated public demo at docs/index.html; without it, DEMO_MODE stays
// false and the full/paid build is written to
// docs/app-x7k2m9/index.html (kept as index.html so buyers' Add to Home
// Screen / offline install works; the unguessable directory keeps it off
// a predictable public URL). See src/ui/demo-gate.js for what the flag
// gates. This path string lives only in the build script — it is never
// bundled into either output.
const DEMO = process.argv.slice(2).includes('--demo');
const PAID_BUILD_DIR = 'app-x7k2m9';
const OUT_FILE = DEMO ? join(OUT_DIR, 'index.html') : join(OUT_DIR, PAID_BUILD_DIR, 'index.html');
const DEMO_FLAG_FROM = 'const DEMO_MODE = false;';
const DEMO_FLAG_TO = 'const DEMO_MODE = true;';

/**
 * Flip the demo flag in the bundled JS for a `--demo` build. Asserts the
 * flag line appears exactly once (fail loudly, like the rest of this
 * bundler) and uses a function replacer so no `$` sequence in the
 * surrounding source is treated as a substitution pattern.
 */
function applyDemoFlag(js) {
  const occurrences = js.split(DEMO_FLAG_FROM).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `build/build.js: --demo expected exactly one "${DEMO_FLAG_FROM}" in the bundle, found ${occurrences}. ` +
        'src/ui/demo-gate.js must declare `export const DEMO_MODE = false;` verbatim on a single line.'
    );
  }
  return js.replace(DEMO_FLAG_FROM, () => DEMO_FLAG_TO);
}

const IMPORT_RE = /^import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"];?\s*$/;
// A module's public-interface index.js re-exporting its internals, e.g.
// `export { a, b } from './actions.js';` — treated like an import for
// traversal purposes (visit the dependency), and dropped from the output
// (the names are already available after concatenation in the shared IIFE
// scope, same reasoning as a stripped `import`).
const REEXPORT_RE = /^export\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"];?\s*$/;
const UNSUPPORTED_RE = /^(export\s+default\b|import\s+[^{])/m;

function assertSupported(source, filePath) {
  const match = UNSUPPORTED_RE.exec(source);
  if (match) {
    throw new Error(
      `build/build.js: unsupported module syntax "${match[0]}" in ${filePath}. ` +
        'This bundler only supports single-line named imports/exports/re-exports via relative paths.'
    );
  }
  // A bare `export { ... };` (no `from`) isn't supported — doesn't fit
  // cleanly into a single top-level regex alongside the (supported)
  // `export { ... } from '...'` re-export form, so checked per line.
  for (const line of source.split('\n')) {
    if (/^export\s*\{/.test(line) && !REEXPORT_RE.test(line)) {
      throw new Error(`build/build.js: unsupported bare "export { ... }" (without "from") in ${filePath}: "${line.trim()}"`);
    }
  }
}

function transformModule(source) {
  return source
    .split('\n')
    .map((line) => {
      if (IMPORT_RE.test(line)) return null; // dependency order is handled by the resolver below
      if (REEXPORT_RE.test(line)) return null;
      if (/^export\s+(async\s+function|function|const|class)\b/.test(line)) {
        return line.replace(/^export\s+/, '');
      }
      return line;
    })
    .filter((line) => line !== null)
    .join('\n');
}

/** Depth-first traversal of the import graph, entry point last (dependencies first). */
function collectModules(entryPath) {
  const order = [];
  const visited = new Set();

  function visit(filePath) {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const source = readFileSync(filePath, 'utf8');
    assertSupported(source, filePath);

    for (const line of source.split('\n')) {
      const importMatch = IMPORT_RE.exec(line);
      if (importMatch) visit(resolve(dirname(filePath), importMatch[2]));
      const reexportMatch = REEXPORT_RE.exec(line);
      if (reexportMatch) visit(resolve(dirname(filePath), reexportMatch[2]));
    }

    order.push({ path: filePath, source });
  }

  visit(entryPath);
  return order;
}

/** Top-level `function`/`const`/`class` names a module declares (export keyword ignored). */
function collectTopLevelNames(source) {
  const names = [];
  const re = /^(?:export\s+)?(?:function|const|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
  let match;
  while ((match = re.exec(source))) names.push(match[1]);
  return names;
}

// Every module is concatenated into one shared scope (see bundleJs) — there
// is no per-module namespacing. Two modules declaring the same top-level
// name would silently shadow or (for `const`/`class`) throw a
// SyntaxError at runtime, so this is checked at build time instead, with a
// message that points at exactly which two files collided.
function assertNoNameCollisions(modules) {
  const owner = new Map();
  for (const { path, source } of modules) {
    for (const name of collectTopLevelNames(source)) {
      const existing = owner.get(name);
      if (existing && existing !== path) {
        throw new Error(
          `build/build.js: top-level name "${name}" is declared in both ${existing} and ${path}. ` +
            'This bundler concatenates all modules into one scope, so top-level names must be unique across src/.'
        );
      }
      owner.set(name, path);
    }
  }
}

function bundleJs() {
  const modules = collectModules(ENTRY);
  assertNoNameCollisions(modules);
  const body = modules
    .map(({ path, source }) => `// ---- ${path.slice(ROOT.length + 1)} ----\n${transformModule(source)}`)
    .join('\n\n');
  const wrapped = `(function () {\n"use strict";\n${body}\n})();`;
  return DEMO ? applyDemoFlag(wrapped) : wrapped;
}

function bundleCss() {
  return ['base.css', 'components.css', 'responsive.css']
    .map((name) => `/* ---- src/styles/${name} ---- */\n${readFileSync(join(SRC, 'styles', name), 'utf8')}`)
    .join('\n\n');
}

function build() {
  const template = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const css = bundleCss();
  const js = bundleJs();

  const styleLinkRe = /^\s*<link rel="stylesheet" href="\.\/src\/styles\/[\w.-]+\.css">\s*$/;
  const lines = template.split('\n');
  const keptLines = [];
  let firstStyleLineIndex = -1;
  for (const line of lines) {
    if (styleLinkRe.test(line)) {
      if (firstStyleLineIndex === -1) firstStyleLineIndex = keptLines.length;
      continue;
    }
    keptLines.push(line);
  }
  if (firstStyleLineIndex === -1) {
    throw new Error('build/build.js: no <link rel="stylesheet" href="./src/styles/*.css"> tags found in index.html');
  }
  keptLines.splice(firstStyleLineIndex, 0, `    <style>\n${css}\n    </style>`);
  let html = keptLines.join('\n');

  const scriptTagRe = /<script type="module" src="\.\/src\/main\.js"><\/script>/;
  if (!scriptTagRe.test(html)) {
    throw new Error('build/build.js: <script type="module" src="./src/main.js"></script> not found in index.html');
  }
  // A *function* replacer, not a string one — String.replace(pattern,
  // stringValue) treats `$`-prefixed sequences in stringValue as special
  // substitution patterns ($$, $&, $1, etc.), and the bundled JS is
  // arbitrary application source that can and does legitimately contain
  // a literal `$$` (e.g. src/core/money.js's `` `$${dollars}` `` — a
  // literal "$" immediately before a `${...}` interpolation). A string
  // replacement silently collapsed that to a single character, dropping
  // the dollar sign from every formatted amount in every build. A
  // function replacer's return value is inserted verbatim, with no
  // special-pattern interpretation, so this class of corruption can't
  // happen regardless of what the bundled source contains.
  html = html.replace(scriptTagRe, () => `<script>\n${js}\n    </script>`);

  // PWA support is added to the full/paid build ONLY — never the demo, so
  // `grep`-ing docs/index.html for anything PWA-related (manifest,
  // serviceWorker, apple-mobile-web-app, sw.js) comes back empty. The
  // manifest/service-worker/icons are written as sidecar files next to
  // the paid index.html by build/pwa.js.
  if (!DEMO) {
    if (!/^\s*<\/head>\s*$/m.test(html) || !/^\s*<\/body>\s*$/m.test(html)) {
      throw new Error('build/build.js: index.html must have <head>/<body> closing tags on their own lines for the PWA head/register injection');
    }
    html = html
      .replace(/^(\s*)<\/head>\s*$/m, () => `${pwaHeadTags()}\n  </head>`)
      .replace(/^(\s*)<\/body>\s*$/m, () => `${pwaRegisterScript()}\n  </body>`);
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, html);
  if (!DEMO) writePwaAssets(dirname(OUT_FILE));
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  const rel = OUT_FILE.slice(ROOT.length + 1);
  const suffix = DEMO ? 'DEMO build (gated)' : 'full build (no limits) + PWA sidecars';
  console.log(`Built ${rel} (${kb} KB) — ${suffix}`);
}

build();
