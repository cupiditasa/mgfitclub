import test from 'node:test';
import assert from 'node:assert/strict';
import { ANATOMY_REGION_INFO, ANATOMY_REGIONS_BY_VIEW, ANATOMY_REGION_RADII, anatomyFaceAtYaw, pickAnatomyRegion } from '../../assets/education/anatomy-region-map.mjs';

const regions = ANATOMY_REGION_INFO;

test('selects each region at its labeled front/back anchor', () => {
  for (const [key, info] of Object.entries(regions)) {
    for (const [face, point] of Object.entries(info.anchors)) {
      assert.equal(pickAnatomyRegion({ x: point[0], y: point[1], z: point[2] }, face, regions), key);
    }
  }
});

test('uses the nearest region rather than a fixed height band', () => {
  assert.equal(pickAnatomyRegion({ x: 0, y: 1.64, z: 0.13 }, 'front', regions), 'chest');
  assert.equal(pickAnatomyRegion({ x: 0.31, y: 1.52, z: 0.055 }, 'front', regions), 'biceps');
  assert.equal(pickAnatomyRegion({ x: 0.14, y: 1.45, z: -0.09 }, 'back', regions), 'lats');
});

test('supports finer named landmarks for major muscle subdivisions', () => {
  for (const [key, info] of Object.entries(regions)) {
    assert.ok(ANATOMY_REGION_RADII[key], `missing hit radius for ${key}`);
    for (const [face, point] of Object.entries(info.anchors)) {
      assert.equal(pickAnatomyRegion({ x: point[0], y: point[1], z: point[2] }, face, regions), key);
    }
  }
});

test('rejects invalid views, non-finite points and distant off-body points', () => {
  assert.equal(pickAnatomyRegion({ x: 0, y: 1.65, z: 0.13 }, 'side', regions), null);
  assert.equal(pickAnatomyRegion({ x: NaN, y: 1.65, z: 0.13 }, 'front', regions), null);
  assert.equal(pickAnatomyRegion({ x: 0, y: 2.8, z: 0.13 }, 'front', regions), null);
});

test('every visible anatomy region has tested hit radii and valid exercise mappings', () => {
  for (const [key, info] of Object.entries(regions)) {
    assert.ok(ANATOMY_REGION_RADII[key], `missing hit radius for ${key}`);
    assert.ok(info.name && info.description, `missing display metadata for ${key}`);
    assert.ok(Array.isArray(info.muscles) && info.muscles.length, `missing exercise mapping for ${key}`);
    const anchors = Object.entries(info.anchors || {});
    assert.ok(anchors.length, `missing click anchor for ${key}`);
    for (const [face, point] of anchors) {
      assert.ok(['front', 'back'].includes(face), `invalid face for ${key}`);
      assert.equal(point.length, 3, `invalid anchor dimensions for ${key}`);
      assert.ok(point.every(Number.isFinite), `non-finite anchor for ${key}`);
      assert.equal(pickAnatomyRegion({ x: point[0], y: point[1], z: point[2] }, face, regions), key);
    }
  }
  for (const [face, keys] of Object.entries(ANATOMY_REGIONS_BY_VIEW)) {
    assert.ok(['front', 'back'].includes(face));
    for (const key of keys) assert.ok(regions[key], `unknown ${face} region ${key}`);
  }
});

test('side-on and oblique views do not get mislabeled as front or back', () => {
  assert.equal(anatomyFaceAtYaw(0), 'front');
  assert.equal(anatomyFaceAtYaw(Math.PI), 'back');
  assert.equal(anatomyFaceAtYaw(-Math.PI), 'back');
  assert.equal(anatomyFaceAtYaw(Math.PI / 2), null);
  assert.equal(anatomyFaceAtYaw(-Math.PI / 2), null);
  assert.equal(anatomyFaceAtYaw(Math.PI / 3), null);
  assert.equal(anatomyFaceAtYaw(Infinity), null);
  assert.equal(anatomyFaceAtYaw(0, 2), null);
});
