const clamp01 = value => Math.max(0, Math.min(1, value));

/** Smoothly closes and opens the eyes around a countdown to the next blink. */
export function blinkEnvelope(secondsUntilBlink, closeSeconds = 0.075, openSeconds = 0.115) {
  if (!Number.isFinite(secondsUntilBlink) || closeSeconds <= 0 || openSeconds <= 0) return 0;
  if (secondsUntilBlink >= 0) return clamp01(1 - secondsUntilBlink / closeSeconds);
  return clamp01(1 + secondsUntilBlink / openSeconds);
}

/** Stable, small idle movement so the character feels present without wobbling. */
export function dollIdleMotion(timeSeconds, intensity = 1) {
  const amount = clamp01(intensity);
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  return {
    headTilt: Math.sin(time * 0.72) * 0.014 * amount,
    headTurn: Math.sin(time * 0.43 + 0.8) * 0.018 * amount,
    shoulderLift: Math.sin(time * 0.95) * 0.006 * amount,
    gaze: Math.sin(time * 0.58 + 1.2) * 0.0014 * amount
  };
}

/** Effort-aware breathing with a small, opposing abdominal response. */
export function dollBreathingMotion(timeSeconds, effort = 0, intensity = 1) {
  const amount = clamp01(Number.isFinite(effort) ? effort : 0);
  const scale = clamp01(Number.isFinite(intensity) ? intensity : 0);
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  const phase = time * (1.20 + amount * 1.35) - 0.38;
  const wave = Math.sin(phase) * scale;
  return {
    rate: 1.20 + amount * 1.35,
    chest: wave * (0.006 + amount * 0.003),
    abdomen: -wave * (0.003 + amount * 0.0015),
    shoulder: wave * (0.001 + amount * 0.0008)
  };
}

/** Tiny eye movements settle under effort instead of wandering during a lift. */
export function dollGazeMotion(timeSeconds, effort = 0, intensity = 1) {
  const amount = clamp01(Number.isFinite(effort) ? effort : 0);
  const scale = clamp01(Number.isFinite(intensity) ? intensity : 0) * (1 - amount * 0.55);
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  return {
    x: Math.sin(time * 0.58 + 1.2) * 0.0014 * scale || 0,
    y: Math.sin(time * 0.41 + 0.3) * 0.0009 * scale || 0
  };
}

/** Keeps the head closer to level when the torso hinges forward. */
export function dollHeadCounterTilt(spineLean = 0, chestLean = 0) {
  const spine = Number.isFinite(spineLean) ? spineLean : 0;
  const chest = Number.isFinite(chestLean) ? chestLean : 0;
  const tilt = Math.max(-0.09, Math.min(0.09, -(spine * 0.08 + chest * 0.18)));
  return tilt || 0;
}

/** Firm, bounded finger curl with less visible tremor while gripping hard. */
export function dollGripMotion(timeSeconds, effort = 0, digitIndex = 0) {
  const amount = clamp01(Number.isFinite(effort) ? effort : 0);
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  const index = Number.isFinite(digitIndex) ? digitIndex : 0;
  const tremor = Math.sin(time * 1.7 + index * 0.72) * 0.004 * (1 - amount * 0.82);
  const curl = amount * 0.018 * (1 + (index - 1.5) * 0.035) + tremor;
  return Math.max(-0.004, Math.min(0.022, curl));
}

/** Smooths effort-driven facial cues so the training doll never snaps expressions. */
export function dollEffortMotion(effort) {
  const amount = clamp01(Number.isFinite(effort) ? effort : 0);
  const eased = amount * amount * (3 - 2 * amount);
  return {
    mouthOpen: clamp01((eased - 0.56) / 0.34),
    browTension: eased * 0.045,
    cheekFlush: 0.10 + eased * 0.14
  };
}
