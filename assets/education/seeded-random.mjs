// Small reproducible PRNG for procedural visual assets. It is intentionally
// independent of Math.random so other animation/particle effects stay varied.
export function createSeededRandom(seed = 0x4d474d47) {
  let state = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0x4d474d47;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
