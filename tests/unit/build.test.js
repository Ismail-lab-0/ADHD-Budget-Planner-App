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
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

describe('build/build.js', () => {
  test('the <script> tag is inlined via a function replacer, not a string one (the actual fix for the historic "$" bug)', () => {
    const buildSource = readFileSync(join(ROOT, 'build', 'build.js'), 'utf8');
    assert.match(
      buildSource,
      /html\s*=\s*html\.replace\(\s*scriptTagRe\s*,\s*\(\s*\)\s*=>/,
      'build.js must inline the bundled script via a function replacer — a string replacer here would silently mangle any "$" the bundle happens to contain, per this file\'s own header comment'
    );
  });

  test('a real dollar amount survives the actual build pipeline intact', () => {
    execFileSync('node', [join(ROOT, 'build', 'build.js')], { cwd: ROOT, stdio: 'pipe' });
    const html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');

    // Extracted and executed, not just string-matched — the bundle is an
    // IIFE with everything private, so unwrap just enough to pull
    // `formatCents` back out and call it directly, proving the built
    // bundle's actual runtime behavior, not a coincidental substring.
    const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
    assert.ok(scriptMatch, 'bundled <script> tag not found in dist/index.html');
    const bundleBody = scriptMatch[1].replace(/^\s*\(function \(\) \{\s*"use strict";/, '').replace(/\}\)\(\);\s*$/, '');
    const formatCents = new Function(`${bundleBody}\nreturn formatCents;`)();
    assert.equal(formatCents(150000), '$1,500.00');
  });
});
