jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-file-system
jest.mock('expo-file-system', () => {
  return {
    Directory: jest.fn().mockImplementation(() => ({
      exists: true,
      create: jest.fn(),
    })),
    File: jest.fn().mockImplementation(() => ({
      exists: true,
      readAsString: jest.fn(),
      writeAsString: jest.fn(),
    })),
    Paths: {
      document: 'mock-document-path',
      cache: 'mock-cache-path',
    },
  };
});

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));
