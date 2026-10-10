export function calculateCameraFitDistance({
  width,
  height,
  depth,
  aspect,
  fovDegrees = 34,
  margin = 1.08,
}) {
  const dimensions = [width, height, depth];
  if (dimensions.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new TypeError('Model dimensions must be finite positive numbers.');
  }
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new TypeError('Camera aspect ratio must be a finite positive number.');
  }
  if (!Number.isFinite(fovDegrees) || fovDegrees <= 0 || fovDegrees >= 180) {
    throw new TypeError('Camera field of view must be between 0 and 180 degrees.');
  }
  if (!Number.isFinite(margin) || margin < 1) {
    throw new TypeError('Camera fit margin must be a finite number of at least 1.');
  }

  const radius = Math.hypot(width, height, depth) / 2;
  const verticalHalfAngle = fovDegrees * Math.PI / 360;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * aspect);
  const limitingHalfAngle = Math.min(verticalHalfAngle, horizontalHalfAngle);
  return radius / Math.sin(limitingHalfAngle) * margin;
}
