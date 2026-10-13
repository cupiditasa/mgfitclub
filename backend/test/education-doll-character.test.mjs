import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blinkEnvelope, dollIdleMotion, dollEffortMotion } from '../../assets/education/doll-character-math.mjs';

const html = fs.readFileSync(new URL('../../education-studio.html', import.meta.url), 'utf8');
const serviceWorker = fs.readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');

test('doll blink eases through open, close, and reopen states', () => {
  assert.equal(blinkEnvelope(0.2), 0);
  assert.ok(Math.abs(blinkEnvelope(0.0375) - 0.5) < 1e-9);
  assert.equal(blinkEnvelope(0), 1);
  assert.ok(Math.abs(blinkEnvelope(-0.0575) - 0.5) < 1e-9);
  assert.equal(blinkEnvelope(-0.2), 0);
  assert.equal(blinkEnvelope(Number.NaN), 0);
});

test('doll idle motion stays subtle, finite, and can be disabled', () => {
  const still = dollIdleMotion(2, 0);
  assert.deepEqual(still, { headTilt: 0, headTurn: 0, shoulderLift: 0, gaze: 0 });
  const moving = dollIdleMotion(2);
  assert.ok(Object.values(moving).every(Number.isFinite));
  assert.ok(Math.abs(moving.headTilt) <= 0.014);
  assert.ok(Math.abs(moving.headTurn) <= 0.018);
  assert.ok(Math.abs(moving.shoulderLift) <= 0.006);
  assert.ok(Math.abs(moving.gaze) <= 0.0014);
});

test('effort expressions blend smoothly and stay within visual bounds', () => {
  const rested = dollEffortMotion(0);
  const strained = dollEffortMotion(1);
  assert.equal(rested.mouthOpen, 0);
  assert.equal(strained.mouthOpen, 1);
  assert.ok(strained.browTension > rested.browTension);
  assert.ok(strained.cheekFlush > rested.cheekFlush);
  assert.deepEqual(dollEffortMotion(Number.NaN), rested);
  for (let effort = 0; effort <= 1; effort += 0.05) {
    const cues = Object.values(dollEffortMotion(effort));
    assert.ok(cues.every(Number.isFinite));
    assert.ok(cues[0] >= 0 && cues[0] <= 1);
  }
});

test('animated doll details stay rigged and the mobile model uses a lighter geometry profile', () => {
  assert.match(html, /const compact3D=matchMedia\('\(max-width: 720px\)'\)/);
  assert.match(html, /parent\.add\(m\);return m/);
  assert.match(html, /headG\.scale\.setScalar\(1\.11\)/);
  assert.match(html, /this\.eyeLids=\[\]/);
  assert.match(html, /new T\.TorusGeometry\(\.094,\.0038,8,40\)/);
  assert.match(html, /const neck=lathe\(\[\[\.027,-\.070\]/);
  assert.match(html, /this\.gripDigits\.push/);
  assert.match(html, /expressionMaterials\.smile\.opacity=1-expression\.mouthOpen/);
  assert.match(html, /toeCap=sph\(\.024,sneakerSoleM\)/);
  assert.match(html, /sneakerSoleM/);
  assert.match(html, /doll-character-math\.mjs\?v=20261012-doll-20stage/);
  assert.match(serviceWorker, /mg-fitclub-v20261012-doll-20stage-v1/);
  assert.match(serviceWorker, /doll-character-math\.mjs\?v=20261012-doll-20stage/);
});
