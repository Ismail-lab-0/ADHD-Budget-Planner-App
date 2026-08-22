// Regression test for a real bug found during manual QA: build/build.js
// inlined the bundled JS into index.html via `html.replace(scriptTagRe,
// stringValue)`. String.prototype.replace treats a *string* replacement's
// `$`-prefixed sequences ($$, $&, $1, etc.) as special substitution
// patterns — and the bundled JS is arbitrary application source that can
// legitimately contain one (src/core/money.js's `` `$${dollars}` `` — a
// literal "$" immediately before a `${...}` interpolation). That collapsed
// `$$` to a single `$`, silently deleting the dollar sign from every
// formatted money amount in every build, invisible to every other test in
// this suite because they all import the source modules directly and
// never exercise this string-replace step. Fixed by switching to a
// function replacer, whose return value is inserted verbatim with no
// special-pattern interpretation — see build/build.js's replace() call.
//
// This runs the real build as a subprocess (the same thing `npm run
// build` does) rather than re-implementing its logic, so it exercises the
// actual bug's exact mechanism, not a simplified stand-in for it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

describe('build/build.js', () => {
  test('the built bundle preserves a literal "$" immediately before a template interpolation', () => {
    execFileSync('node', [join(ROOT, 'build', 'build.js')], { cwd: ROOT, stdio: 'pipe' });
    const html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');

    // The exact pattern that was previously corrupted: money.js's
    // formatCents template literal, verbatim, inside the bundled <script>
    // — `${sign}` followed by a literal "$" then `${dollars...}` (three
    // "$" characters total; the bug collapsed the middle one away).
    assert.match(html, /\$\{sign\}\$\$\{dollars\.toLocaleString\('en-US'\)\}/);

    // And the actual function, when extracted and executed, must produce
    // a real dollar sign — not just a string-match coincidence. The
    // bundle is an IIFE with everything private, so unwrap just enough to
    // pull `formatCents` back out and call it directly.
    const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
    assert.ok(scriptMatch, 'bundled <script> tag not found in dist/index.html');
    const bundleBody = scriptMatch[1].replace(/^\s*\(function \(\) \{\s*"use strict";/, '').replace(/\}\)\(\);\s*$/, '');
    const formatCents = new Function(`${bundleBody}\nreturn formatCents;`)();
    assert.equal(formatCents(150000), '$1,500.00');
  });
});
