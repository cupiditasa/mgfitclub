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
  assert.match(worker, /mg-fitclub-v20261012-doll-10stage-v1/);
  assert.match(worker, /site-tour\.css\?v=20261011-first-visit/);
  assert.match(worker, /site-tour\.js\?v=20261011-first-visit/);
  assert.match(worker, /panel-tour\.css\?v=20261012-role-tours-v1/);
  assert.match(worker, /panel-tour\.js\?v=20261012-role-tours-v1/);
});

test('private dashboards and work areas load role-specific guidance', () => {
  const api = read('mg-api.js');
  const tour = read('panel-tour.js');
  const css = read('panel-tour.css');
  const workouts = read('workouts.js');
  const nutrition = read('nutrition.js');
  for (const page of [
    'dashboard.html', 'coach-dashboard.html', 'coach.html', 'coach-programs.html',
    'coach-requests.html', 'nutrition-builder.html', 'admin.html', 'admin-dashboard.html',
    'admin-transactions.html', 'coach-market-log.html', 'access-center.html', 'club-attendance.html',
    'workout-view.html', 'nutrition-view.html', 'coach-offerings.html', 'coach-transactions.html',
    'admin-transactions.html', 'attendance-pilot.html', 'coach-directory.html', 'coach-food.html',
    'coach-profile.html', 'education.html', 'exercise-library.html', 'food-plan-view.html',
    'nutrition.html', 'secretary.html', 'support.html', 'training-request.html', 'workout-log.html',
    'device-verification.html',
  ]) {
    assert.ok(api.includes(`"${page}"`), `${page} receives the shared panel-tour loader`);
    assert.ok(tour.includes(`"${page}"`), `${page} has a contextual tour`);
  }
  for (const step of ['workout-title', 'workout-days', 'workout-add', 'workout-settings', 'workout-timer', 'workout-duration', 'workout-save', 'workout-program-list'])
    assert.ok(tour.includes(`data-panel-tour="${step}"`), `workout tutorial covers ${step}`);
  assert.match(nutrition, /empty\.dataset\.panelTour='nutrition-meal'/, 'nutrition guidance has a target before the first meal is added');
  assert.match(tour, /نسخهٔ مستقل/);
  assert.match(tour, /گزارش مدیریت/);
  assert.match(tour, /aria-modal="true"/);
  assert.match(tour, /Escape/);
  assert.match(tour, /prefers-reduced-motion/);
  assert.match(workouts, /titleField\.dataset\.panelTour='workout-title'/);
  assert.match(workouts, /days\.dataset\.panelTour='workout-days'/);
  assert.match(workouts, /add\.dataset\.panelTour='workout-add'/);
  assert.match(nutrition, /titleField\.dataset\.panelTour='nutrition-title'/);
  assert.match(nutrition, /add\.dataset\.panelTour='nutrition-add'/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /:focus-visible/);
});
