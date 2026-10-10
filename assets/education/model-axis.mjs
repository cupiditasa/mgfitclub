// Normalize imported model roots to the Y-up axis used by the education viewer.
export function alignModelUpAxis(modelRoot, dimensions) {
  const extents = [dimensions.x, dimensions.y, dimensions.z];
  const axisNames = ['x', 'y', 'z'];
  const maxExtent = Math.max(...extents);
  if (!Number.isFinite(maxExtent) || maxExtent <= 0 || extents.some(value => !Number.isFinite(value))) {
    throw new TypeError('Model bounds must contain finite, positive dimensions.');
  }

  const verticalAxis = axisNames[extents.indexOf(maxExtent)];
  if (verticalAxis === 'z') modelRoot.rotation.x = -Math.PI / 2;
  else if (verticalAxis === 'x') modelRoot.rotation.z = Math.PI / 2;
  return verticalAxis;
}
