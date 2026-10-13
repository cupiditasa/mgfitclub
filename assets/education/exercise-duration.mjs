const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function asciiDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, char => String(DIGITS.indexOf(char)))
    .replace(/[٠-٩]/g, char => String(ARABIC_DIGITS.indexOf(char)));
}

function rangeIn(value) {
  const text = asciiDigits(value).replace(/٫/g, '.');
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:تا|–|—|-)\s*(\d+(?:\.\d+)?)/);
  if (match) return [+match[1], +match[2]];
  const one = text.match(/\d+(?:\.\d+)?/);
  return one ? [+one[0], +one[0]] : null;
}

function prescriptionSets(text) {
  const match = asciiDigits(text).match(/(\d+)\s*(?:تا|–|—|-)\s*(\d+)\s*(?:ست|دور)|(\d+)\s*(?:ست|دور)/);
  if (!match) return null;
  return match[1] ? [+match[1], +match[2]] : [+match[3], +match[3]];
}

function timeRange(text) {
  const normalized = asciiDigits(text).replace(/٫/g, '.');
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:تا|–|—|-)\s*(\d+(?:\.\d+)?)\s*(دقیقه|ثانیه|ثانی)|(\d+(?:\.\d+)?)\s*(دقیقه|ثانیه|ثانی)/);
  if (!match) return null;
  const values = match[1] ? [+match[1], +match[2]] : [+match[4], +match[4]];
  const unit = match[3] || match[5];
  const factor = unit === 'دقیقه' ? 60 : 1;
  return values.map(value => value * factor);
}

function restRange(text) {
  if (!text || /بدون استراحت|—/.test(text)) return [0, 0];
  return timeRange(text) || [0, 0];
}

function repetitionTempo(text) {
  const normalized = asciiDigits(text);
  const phases = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(?:تا|–|—|-)\s*(\d+(?:\.\d+)?)\s*ثانیه|(\d+(?:\.\d+)?)\s*ثانیه/g)];
  if (!phases.length) return [2.5, 4.5];
  let min = 0, max = 0;
  for (const phase of phases) {
    if (phase[1]) { min += +phase[1]; max += +phase[2]; }
    else { min += +phase[3]; max += +phase[3]; }
  }
  return min > 0 ? [min, max] : [2.5, 4.5];
}

const PER_SET_OVERRIDES = {
  hundred: [60, 90],
  bearcrawl: [18, 35],
  bottomsupcarry: [36, 70],
  farmerwalk: [25, 45],
  gobletcarry: [25, 45],
  lateralshuffle: [36, 70],
  overheadcarry: [18, 35],
  sledpush: [10, 22],
  sprintfunc: [5, 9],
  suitcasecarry: [50, 90],
  turkishgetup: [80, 150],
};

export function usesIndependentTiming(exercise) {
  if (!exercise) return false;
  const text = String(exercise.sets || '');
  return Boolean(PER_SET_OVERRIDES[exercise.k] || timeRange(text) || /متر/.test(text));
}

function sideFactor(text) {
  return /هر\s*(?:پا|دست|طرف|سمت)/.test(asciiDigits(text)) ? 2 : 1;
}

/**
 * Estimate active time plus between-set rest from the movement's written
 * prescription. Returns null when the prescription cannot be interpreted.
 * Optional plan values replace the set/repetition prescription for that item.
 */
export function estimateExerciseDuration(exercise, options = {}) {
  if (!exercise || typeof exercise !== 'object') return null;
  const prescribed = String(exercise.sets || '');
  const countText = options.sets == null ? prescribed : `${options.sets} ست`;
  const sets = prescriptionSets(countText);
  const sides = sideFactor(prescribed);
  const override = PER_SET_OVERRIDES[exercise.k];
  const rests = restRange(exercise.rest);
  const multiply = (range, n) => range.map(value => value * n);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

  if (override && sets) {
    const work = multiply(override, sets[0]);
    const maxWork = override[1] * sets[1];
    const rest = [(sets[0] - 1) * rests[0], (sets[1] - 1) * rests[1]];
    return { minSeconds: work[0] + rest[0], maxSeconds: maxWork + rest[1], includesSetRest: true, confidence: 'range' };
  }

  const times = timeRange(prescribed);
  if (times) {
    const stepCount = rangeIn(asciiDigits(prescribed).match(/(\d+(?:\.\d+)?\s*(?:تا|–|—|-)\s*\d+(?:\.\d+)?|\d+)\s*حرکت/)?.[1] || '');
    const rounds = sets || stepCount;
    if (!rounds) return { minSeconds: times[0], maxSeconds: times[1], includesSetRest: false, confidence: 'range' };
    const side = sideFactor(prescribed);
    const work = [rounds[0] * times[0] * side, rounds[1] * times[1] * side];
    const rest = sets ? [(sets[0] - 1) * rests[0], (sets[1] - 1) * rests[1]] : [0, 0];
    return { minSeconds: work[0] + rest[0], maxSeconds: work[1] + rest[1], includesSetRest: Boolean(sets), confidence: 'range' };
  }

  const normalized = asciiDigits(prescribed);
  const workToken = normalized.match(/×\s*(\d+(?:\.\d+)?)\s*(?:تا|–|—|-)\s*(\d+(?:\.\d+)?)\s*(متر|تکرار|بار|ضربه)?|×\s*(\d+(?:\.\d+)?)\s*(متر|تکرار|بار|ضربه)?/);
  if (!sets || !workToken) return null;
  const workRange = workToken[1] ? [+workToken[1], +workToken[2]] : [+workToken[4], +workToken[4]];
  const unit = workToken[3] || workToken[5] || '';

  if (unit === 'متر') return null;
  if (!unit || /تکرار|بار|ضربه/.test(unit)) {
    const repsOverride = options.reps == null ? null : rangeIn(options.reps);
    const reps = repsOverride || workRange;
    const tempo = repetitionTempo(exercise.tempo);
    const work = [sets[0] * reps[0] * tempo[0] * sides, sets[1] * reps[1] * tempo[1] * sides];
    const rest = [(sets[0] - 1) * rests[0], (sets[1] - 1) * rests[1]];
    return { minSeconds: work[0] + rest[0], maxSeconds: work[1] + rest[1], includesSetRest: true, confidence: tempo[0] === tempo[1] ? 'range' : 'approximate' };
  }
  return null;
}

function faNumber(value) {
  return String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[+digit]);
}

function roundedRange(estimate) {
  if (!estimate) return null;
  const low = Math.max(0, estimate.minSeconds), high = Math.max(low, estimate.maxSeconds);
  if (high < 60) {
    const roundedLow = Math.floor(low / 5) * 5, roundedHigh = Math.ceil(high / 5) * 5;
    return roundedLow === roundedHigh ? `${faNumber(roundedLow)} ثانیه` : `${faNumber(roundedLow)} تا ${faNumber(roundedHigh)} ثانیه`;
  }
  const lowHalfMinutes = Math.floor(low / 30) / 2;
  const highHalfMinutes = Math.ceil(high / 30) / 2;
  const format = value => faNumber(Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', '٫'));
  return lowHalfMinutes === highHalfMinutes
    ? `${format(lowHalfMinutes)} دقیقه`
    : `${format(lowHalfMinutes)} تا ${format(highHalfMinutes)} دقیقه`;
}

export function formatExerciseDuration(estimate) {
  const range = roundedRange(estimate);
  return range ? `حدود ${range}` : 'قابل برآورد نیست';
}

export function sumExerciseDurations(items, byKey, optionsForItem = () => ({})) {
  const estimates = items.map(item => {
    const exercise = byKey(item.k);
    return exercise ? estimateExerciseDuration(exercise, optionsForItem(item)) : null;
  });
  if (estimates.some(value => !value)) return null;
  return estimates.reduce((sum, value) => ({
    minSeconds: sum.minSeconds + value.minSeconds,
    maxSeconds: sum.maxSeconds + value.maxSeconds,
    includesSetRest: sum.includesSetRest && value.includesSetRest,
    confidence: sum.confidence === 'approximate' || value.confidence === 'approximate' ? 'approximate' : 'range',
  }), { minSeconds: 0, maxSeconds: 0, includesSetRest: true, confidence: 'range' });
}
