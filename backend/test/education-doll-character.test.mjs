import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blinkEnvelope, dollCameraKeyboardInput, dollIdleMotion, dollBreathingMotion, dollGazeMotion, dollHeadCounterTilt, dollGripMotion, dollEffortMotion } from '../../assets/education/doll-character-math.mjs';

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

test('camera keyboard controls rotate, zoom within bounds, reset and ignore unrelated keys', () => {
  const camera = { yaw: 0, pitch: 0.16, dist: 3.65 };
  assert.ok(Math.abs(dollCameraKeyboardInput('ArrowLeft', camera).yaw + 0.16) < 1e-9);
  assert.ok(Math.abs(dollCameraKeyboardInput('ArrowUp', camera).pitch - 0.28) < 1e-9);
  assert.ok(Math.abs(dollCameraKeyboardInput('+', camera).dist - 3.41) < 1e-9);
  assert.deepEqual(dollCameraKeyboardInput('Home', { yaw: 1, pitch: 0.9, dist: 5 }, 4.2), { yaw: 0, pitch: 0.16, dist: 4.2 });
  assert.equal(dollCameraKeyboardInput('Space', camera), null);
  assert.equal(dollCameraKeyboardInput('ArrowUp', { pitch: 1.15 }).pitch, 1.15);
  assert.equal(dollCameraKeyboardInput('ArrowDown', { pitch: 0.02 }).pitch, 0.02);
  assert.equal(dollCameraKeyboardInput('+', { dist: 2.7 }).dist, 2.7);
  assert.equal(dollCameraKeyboardInput('-', { dist: 7.2 }).dist, 7.2);
  assert.equal(dollCameraKeyboardInput('ArrowRight', null), null);
});

test('breathing cadence and opposing chest/abdomen response scale safely with effort', () => {
  const rest = dollBreathingMotion(1.7, 0);
  const exertion = dollBreathingMotion(1.7, 1);
  assert.ok(exertion.rate > rest.rate);
  assert.ok(Math.abs(exertion.chest) > Math.abs(rest.chest));
  assert.equal(dollBreathingMotion(1.7, 0, 0).chest, 0);
  for (let effort = 0; effort <= 1; effort += 0.05) {
    const breath = dollBreathingMotion(3.2, effort);
    assert.ok(Object.values(breath).every(Number.isFinite));
    assert.ok(Math.abs(breath.chest) <= 0.0091);
    assert.ok(Math.abs(breath.abdomen) <= 0.0046);
    assert.ok(Math.abs(breath.shoulder) <= 0.00181);
    assert.ok(breath.chest === 0 || Math.sign(breath.abdomen) === -Math.sign(breath.chest));
  }
  assert.deepEqual(dollBreathingMotion(Number.NaN, Number.NaN), dollBreathingMotion(0, 0));
});

test('gaze settles under load and remains subtle for reduced motion', () => {
  const free = dollGazeMotion(4.1, 0);
  const focused = dollGazeMotion(4.1, 1);
  assert.ok(Math.abs(focused.x) < Math.abs(free.x));
  assert.ok(Math.abs(focused.y) < Math.abs(free.y));
  assert.deepEqual(dollGazeMotion(4.1, 0, 0), { x: 0, y: 0 });
  assert.ok(Math.abs(free.x) <= 0.0014 && Math.abs(free.y) <= 0.0009);
});

test('head counter-tilt is bounded and offsets forward torso lean', () => {
  assert.ok(dollHeadCounterTilt(0.5, 0.2) < 0);
  assert.equal(dollHeadCounterTilt(0, 0), 0);
  assert.equal(dollHeadCounterTilt(100, 100), -0.09);
  assert.equal(dollHeadCounterTilt(Number.NaN, Number.NaN), 0);
});

test('grip firms up under effort while finger tremor decreases and remains bounded', () => {
  const resting = Array.from({ length: 8 }, (_, i) => dollGripMotion((i * Math.PI) / 3, 0, i % 4));
  const loaded = Array.from({ length: 8 }, (_, i) => dollGripMotion((i * Math.PI) / 3, 1, i % 4));
  assert.ok(Math.max(...loaded) > Math.max(...resting));
  assert.ok(Math.max(...loaded) - Math.min(...loaded) < Math.max(...resting) - Math.min(...resting));
  for (const value of [...resting, ...loaded]) assert.ok(value >= -0.004 && value <= 0.022);
  assert.equal(dollGripMotion(Number.NaN, Number.NaN, Number.NaN), dollGripMotion(0, 0, 0));
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
  assert.match(html, /const compact3D=matchMedia\('\(max-width: 720px\), \(pointer: coarse\)'\)/);
  assert.match(html, /R\.setPixelRatio\(Math\.min\(devicePixelRatio,compact3D\?1\.5:2\)\)/);
  assert.match(html, /key\.shadow\.mapSize\.set\(compact3D\?512:1024,compact3D\?512:1024\)/);
  assert.match(html, /const compact3D=this\.compact3D/);
  assert.match(html, /parent\.add\(m\);return m/);
  assert.match(html, /headG\.scale\.setScalar\(\.99\)/);
  assert.match(html, /this\.eyeLids=\[\]/);
  assert.match(html, /new T\.TorusGeometry\(\.094,\.0038,8,40\)/);
  assert.match(html, /const neck=lathe\(\[\[\.027,-\.070\]/);
  assert.match(html, /this\.gripDigits\.push/);
  assert.match(html, /dollBreathingMotion\(time,ef/);
  assert.match(html, /dollHeadCounterTilt\(p\.spine\|\|0,p\.chest\|\|0\)/);
  assert.match(html, /dollGazeMotion\(time,ef,motionScale\)/);
  assert.match(html, /dollGripMotion\(time,ef,digit\.index\)/);
  assert.match(html, /const ambientMotion=REDUCED\?0:1/);
  assert.match(html, /R\.abdomen=abdomenG/);
  assert.match(html, /expressionMaterials\.smile\.opacity=1-expression\.mouthOpen/);
  assert.match(html, /toeCap=sph\(\.024,sneakerSoleM\)/);
  assert.match(html, /sneakerSoleM/);
  assert.match(html, /doll-character-math\.mjs\?v=20261012-doll-coach-v3/);
  assert.match(serviceWorker, /mg-fitclub-v20261013-tailored-garments-v1/);
  assert.match(serviceWorker, /doll-character-math\.mjs\?v=20261012-doll-coach-v3/);
});

test('training doll uses restrained fitted clothing with fabric detail and rigged separate shorts', () => {
  assert.match(html, /const trainingTop=clothLathe\(/);
  assert.match(html, /fabricM\.bumpMap=weaveTexture/);
  assert.match(html, /clothSeam\(\[\[side\*\.132,-\.280/);
  assert.match(html, /const trainingShorts=clothLathe\(/);
  assert.match(html, /shortsLeg=clothLathe\(/);
  assert.match(html, /leg\.tg\.add\(shortsLeg\)/);
  assert.match(html, /brandCtx\.fillText\('MG'/);
  assert.doesNotMatch(html, /brandCtx\.fillRect\(/);
  assert.match(html, /let muscleOn=false,labelsOn=false,deepMode=false/);
  assert.match(html, /canvas\.setAttribute\('role','group'\)/);
  assert.match(html, /canvas\.tabIndex=0/);
  assert.match(html, /canvas\.setAttribute\('aria-keyshortcuts'/);
  assert.match(html, /canvas\.title=/);
  assert.match(html, /e\.stopPropagation\(\)/);
  assert.match(html, /canvas\.setAttribute\('aria-label'/);
  assert.match(html, /this\.setAttribute\('aria-pressed',String\(muscleOn\)\)/);
});

test('every exercise marked animated has a matching doll pose with start and end states', () => {
  const dataLine = html.split(/\r?\n/).find(line => line.startsWith('const DATA='));
  assert.ok(dataLine, 'exercise catalog is present as a JSON line');
  const movements = JSON.parse(dataLine.slice('const DATA='.length, -1));
  const poseSource = html.slice(html.indexOf('const POSES={'), html.indexOf('const IDLE='));
  const poseKeys = [...poseSource.matchAll(/^\s{2}([A-Za-z0-9_]+):\{/gm)].map(match => match[1]);
  const animatedKeys = movements.filter(movement => movement.anim).map(movement => movement.k);
  assert.ok(animatedKeys.length > 0, 'at least one exercise is animated');
  assert.deepEqual(animatedKeys.filter(key => !poseKeys.includes(key)), []);
  for (const key of animatedKeys) {
    assert.match(poseSource, new RegExp(`\\b${key}:\\{eq:'[^']+',A:\\{[\\s\\S]*?\\},\\s*B:\\{`));
  }
});
