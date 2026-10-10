import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateCameraFitDistance } from '../../assets/education/model-camera-fit.mjs';

test('camera fit leaves a margin around the full model at landscape and portrait ratios', () => {
  const dimensions = { width: 1.65, height: 2.1, depth: 0.42 };
  const landscape = calculateCameraFitDistance({ ...dimensions, aspect: 1.5 });
  const portrait = calculateCameraFitDistance({ ...dimensions, aspect: 0.55 });
  assert.ok(landscape > 3.5, 'the prior 3.5-unit framing was too tight for this body bound');
  assert.ok(portrait > landscape, 'portrait layouts need additional horizontal fit distance');
  assert.ok(Number.isFinite(landscape) && Number.isFinite(portrait));
});

test('camera fit rejects incomplete model or viewport dimensions', () => {
  assert.throws(() => calculateCameraFitDistance({ width: 1, height: 2, depth: 0, aspect: 1 }), /dimensions/);
  assert.throws(() => calculateCameraFitDistance({ width: 1, height: 2, depth: 1, aspect: 0 }), /aspect/);
});

test('review page uses responsive fit, preserves attribution, and exposes only bundled candidates', () => {
  const html = fs.readFileSync(new URL('../../assets/education/blender-review/model-compare.html', import.meta.url), 'utf8');
  assert.match(html, /calculateCameraFitDistance/);
  assert.match(html, /male-full-body-ecorche-ab11ebff89224f03bd75efede1164cf6/);
  assert.match(html, /CC BY 4\.0/);
  assert.match(html, /candidate-fullbody-ecorche-phase23c-decimate90-ccby-meshopt\.glb/);
  assert.doesNotMatch(html, /candidate-fullbody-ecorche-phase10-decimate75-meshopt\.glb/);
});

test('phase 23 candidate stays smaller and keeps the source credit in its GLB metadata', () => {
  const report = JSON.parse(fs.readFileSync(new URL('../../assets/education/blender-review/phase23c-decimate-report.json', import.meta.url), 'utf8'));
  const candidate = fs.readFileSync(new URL('../../assets/education/blender-review/candidate-fullbody-ecorche-phase23c-decimate90-ccby-meshopt.glb', import.meta.url));
  assert.equal(candidate.toString('ascii', 0, 4), 'glTF');
  assert.ok(report.after.bytes < report.before.bytes);
  assert.equal(report.after.triangle_count, 432286);
  assert.equal(report.license_attribution_preserved, true);
  assert.match(report.after.asset_copyright, /Diego Lujan Garcia.*CC BY 4\.0.*ab11ebff89224f03bd75efede1164cf6/);
});
