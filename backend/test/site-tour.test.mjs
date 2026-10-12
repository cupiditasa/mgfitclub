import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

test('public homepage has a first-visit tour and a persistent restart entry', () => {
  const html = read('index.html');
  assert.match(html, /site-tour\.css\?v=20261011-first-visit/);
  assert.match(html, /site-tour\.js\?v=20261011-first-visit/);
  assert.match(html, /data-site-tour-start/);
  assert.equal((html.match(/data-site-tour-start/g) || []).length, 2);
  assert.match(html, /راهنمای سایت/);
});

test('site tour explains key public destinations with skippable, accessible controls', () => {
  const script = read('site-tour.js');
  const css = read('site-tour.css');
  const steps = script.match(/selector: /g) || [];
  assert.equal(steps.length, 7);
  assert.match(script, /role="dialog" aria-modal="true"/);
  assert.match(script, /data-tour-skip/);
  assert.match(script, /data-tour-back/);
  assert.match(script, /data-tour-next/);
  assert.match(script, /siteTourCopy/);
  assert.match(script, /Escape/);
  assert.match(script, /localStorage\.getItem\(seenKey\)/);
  assert.match(script, /localStorage\.setItem\(seenKey, "1"\)/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /z-index: 2147482501/);
  assert.ok(2147482501 > 2147482000, 'the tour must remain above the shared theme picker');
});

test('service worker refreshes its shell cache and includes the versioned tour assets', () => {
  const worker = read('sw.js');
  assert.match(worker, /mg-fitclub-v20261011-studio-theme/);
  assert.match(worker, /site-tour\.css\?v=20261011-first-visit/);
  assert.match(worker, /site-tour\.js\?v=20261011-first-visit/);
});
