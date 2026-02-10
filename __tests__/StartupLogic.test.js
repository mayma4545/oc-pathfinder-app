import OfflineService from '../services/OfflineService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('../services/OfflineService', () => ({
  isPathfindingAvailable: jest.fn(),
  downloadMetadataOnly: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// We'll test a logic that we'll implement in a component or service
const checkFirstRun = async () => {
  const hasData = await OfflineService.isPathfindingAvailable();
  const initialDownloadDone = await AsyncStorage.getItem('HAS_INITIAL_DOWNLOAD');
  
  if (!hasData || initialDownloadDone !== 'true') {
    await OfflineService.downloadMetadataOnly();
    await AsyncStorage.setItem('HAS_INITIAL_DOWNLOAD', 'true');
    return 'downloaded';
  }
  
  return 'skipped';
};

describe('Startup Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should trigger download if hasData returns false', async () => {
    OfflineService.isPathfindingAvailable.mockResolvedValue(false);
    AsyncStorage.getItem.mockResolvedValue(null);

    const result = await checkFirstRun();

    expect(OfflineService.downloadMetadataOnly).toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('HAS_INITIAL_DOWNLOAD', 'true');
    expect(result).toBe('downloaded');
  });

  test('should trigger download if HAS_INITIAL_DOWNLOAD flag is missing even if hasData is true (safety)', async () => {
    OfflineService.isPathfindingAvailable.mockResolvedValue(true);
    AsyncStorage.getItem.mockResolvedValue(null);

    const result = await checkFirstRun();

    expect(OfflineService.downloadMetadataOnly).toHaveBeenCalled();
    expect(result).toBe('downloaded');
  });

  test('should SKIP download if hasData returns true and flag is set', async () => {
    OfflineService.isPathfindingAvailable.mockResolvedValue(true);
    AsyncStorage.getItem.mockResolvedValue('true');

    const result = await checkFirstRun();

    expect(OfflineService.downloadMetadataOnly).not.toHaveBeenCalled();
    expect(result).toBe('skipped');
  });
});
