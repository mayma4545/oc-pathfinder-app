/**
 * Transforms a database coordinate to the SVG coordinate system.
 * 
 * @param {Object} point - The point to transform {x, y}.
 * @param {Object} config - The calibration configuration.
 * @param {number} [config.scale=1] - The scale factor.
 * @param {number} [config.offsetX=0] - The x-axis offset.
 * @param {number} [config.offsetY=0] - The y-axis offset.
 * @returns {Object} The transformed point {x, y}.
 */
export const transformCoordinate = (point, config = {}) => {
  const scale = config.scale ?? 1;
  const offsetX = config.offsetX ?? 0;
  const offsetY = config.offsetY ?? 0;

  return {
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  };
};
