import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom } from '../../assets/education/seeded-random.mjs';

function sequence(seed, length = 32) {
  const random = createSeededRandom(seed);
  return Array.from({ length }, random);
}

test('procedural anatomy texture randomness is stable for a given seed', () => {
  assert.deepEqual(sequence(0x4d474d47), sequence(0x4d474d47));
  assert.notDeepEqual(sequence(1), sequence(2));
  assert.ok(sequence(0).every(value => value >= 0 && value < 1));
});
