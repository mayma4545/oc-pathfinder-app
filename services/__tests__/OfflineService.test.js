
import OfflineService from '../OfflineService';
import { getPathfinder } from '../../utils/pathfinding';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  Directory: jest.fn().mockImplementation(() => ({
    exists: true,
    create: jest.fn(),
    list: jest.fn(),
  })),
  File: jest.fn().mockImplementation(() => ({
    exists: false,
    write: jest.fn(),
  })),
  Paths: { document: '/doc/' },
}));

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://test.com',
}));

jest.mock('../../utils/pathfinding', () => ({
  getPathfinder: jest.fn(),
  resetPathfinder: jest.fn(),
}));

describe('OfflineService - Predictive Cache', () => {
  let mockPathfinder;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPathfinder = {
      getNearbyNodeIds: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
    };
    getPathfinder.mockReturnValue(mockPathfinder);
    
    // We need to spy on the instance methods since we are testing the instance
    jest.spyOn(OfflineService, 'isImageCached').mockResolvedValue(false);
    jest.spyOn(OfflineService, 'downloadImage').mockResolvedValue(true);
    jest.spyOn(OfflineService, 'getNodes').mockResolvedValue([
        { node_id: 1, image360_url: 'http://img1.jpg' },
        { node_id: 2, image360_url: 'http://img2.jpg' }
    ]);
  });

  test('predictiveCache should download images for nearby nodes not in cache', async () => {
    mockPathfinder.getNearbyNodeIds.mockReturnValue([2]);
    
    await OfflineService.predictiveCache(1);

    expect(mockPathfinder.getNearbyNodeIds).toHaveBeenCalledWith(1, 1);
    expect(OfflineService.isImageCached).toHaveBeenCalledWith(2);
    expect(OfflineService.downloadImage).toHaveBeenCalledWith('http://img2.jpg', 'node_2.jpg');
  });

  test('predictiveCache should skip images that are already cached', async () => {
    mockPathfinder.getNearbyNodeIds.mockReturnValue([2]);
    OfflineService.isImageCached.mockResolvedValue(true);

    await OfflineService.predictiveCache(1);

    expect(OfflineService.downloadImage).not.toHaveBeenCalled();
  });
});
