import { MAP_ASSETS } from '../../config';

describe('App Configuration', () => {
  test('should have Mahogany_building.svg as the default campus map', () => {
    expect(MAP_ASSETS.DEFAULT_CAMPUS_MAP).toBe('Mahogany_building.svg');
  });
});
