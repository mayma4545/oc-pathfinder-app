import { transformCoordinate } from '../MapCoordinateUtils';

describe('MapCoordinateUtils', () => {
  describe('transformCoordinate', () => {
    it('should transform coordinates with scale and offset', () => {
      const point = { x: 100, y: 200 };
      const config = {
        scale: 1.5,
        offsetX: 10,
        offsetY: -20,
      };

      // Expected:
      // x = 100 * 1.5 + 10 = 150 + 10 = 160
      // y = 200 * 1.5 - 20 = 300 - 20 = 280
      const result = transformCoordinate(point, config);

      expect(result).toEqual({ x: 160, y: 280 });
    });

    it('should handle zero scale and offset', () => {
      const point = { x: 50, y: 50 };
      const config = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const result = transformCoordinate(point, config);

      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should handle missing config values by using defaults', () => {
        const point = { x: 100, y: 100 };
        // Assuming default scale 1, offset 0
        const result = transformCoordinate(point, {});
        expect(result).toEqual({ x: 100, y: 100 });
    });
  });
});
