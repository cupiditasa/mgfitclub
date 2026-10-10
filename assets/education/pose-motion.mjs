export function samplePoseMotion(previous, exercise, y, delta) {
  if (!exercise || !Number.isFinite(y)) return { state: null, velocity: 0 };

  const state = { exercise, y };
  if (previous?.exercise !== exercise || !Number.isFinite(previous.y)) {
    return { state, velocity: 0 };
  }

  const step = Number.isFinite(delta) && delta > 0 ? delta : 1 / 60;
  return { state, velocity: (y - previous.y) / step };
}
