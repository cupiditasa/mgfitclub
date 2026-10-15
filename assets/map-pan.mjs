export const MAP_METERS_PER_UNIT = 12;
// Keep the reference camera locked while allowing 400m of travel in either direction.
export const LOCKED_STREET_TRAVEL_METERS = 800;
export const LOCKED_STREET_LIMIT_UNITS = LOCKED_STREET_TRAVEL_METERS / (2 * MAP_METERS_PER_UNIT);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createPolylineNavigator(points) {
  if (!Array.isArray(points) || points.length < 2 || points.some((point) => (
    !Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite)
  ))) {
    throw new TypeError("A route needs at least two finite [x, z] points.");
  }

  const segments = [];
  let length = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index].slice(0, 2);
    const end = points[index + 1].slice(0, 2);
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const segmentLength = Math.hypot(dx, dz);
    if (!segmentLength) continue;
    segments.push({ start, dx, dz, length: segmentLength, from: length, to: length + segmentLength });
    length += segmentLength;
  }
  if (!segments.length) throw new TypeError("A route cannot contain only duplicate points.");

  const at = (station) => {
    const distance = clamp(station, 0, length);
    const segment = segments.find((item) => distance <= item.to) || segments.at(-1);
    const ratio = clamp((distance - segment.from) / segment.length, 0, 1);
    return {
      point: [segment.start[0] + segment.dx * ratio, segment.start[1] + segment.dz * ratio],
      tangent: [segment.dx / segment.length, segment.dz / segment.length],
      station: distance,
    };
  };

  const closestStation = ([x, z]) => {
    let closest = { distance: Infinity, station: 0 };
    for (const segment of segments) {
      const lengthSquared = segment.length * segment.length;
      const ratio = clamp(((x - segment.start[0]) * segment.dx + (z - segment.start[1]) * segment.dz) / lengthSquared, 0, 1);
      const pointX = segment.start[0] + segment.dx * ratio;
      const pointZ = segment.start[1] + segment.dz * ratio;
      const distance = Math.hypot(x - pointX, z - pointZ);
      if (distance < closest.distance) closest = { distance, station: segment.from + ratio * segment.length };
    }
    return closest.station;
  };

  return { length, at, closestStation };
}

export function offsetFromStreetDrag({
  currentOffsetUnits,
  deltaX,
  deltaY,
  axisScreenX,
  axisScreenY,
  pixelsPerWorldUnit,
  limitUnits = LOCKED_STREET_LIMIT_UNITS,
}) {
  const axisLength = Math.hypot(axisScreenX, axisScreenY);
  if (!axisLength || !Number.isFinite(pixelsPerWorldUnit) || pixelsPerWorldUnit <= 0) {
    return currentOffsetUnits;
  }

  const projectedDrag = (deltaX * axisScreenX + deltaY * axisScreenY) / axisLength;
  return clamp(currentOffsetUnits - projectedDrag / pixelsPerWorldUnit, -limitUnits, limitUnits);
}
