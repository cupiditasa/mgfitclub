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
