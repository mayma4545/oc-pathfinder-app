/**
 * Download Context - Provides global download state management
 * Allows download progress to be visible across all screens
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import OfflineService from '../services/OfflineService';
import ApiService from '../services/ApiService';

const DownloadContext = createContext();

export const DownloadProvider = ({ children }) => {
  const [downloadProgress, setDownloadProgress] = useState({
    status: 'idle',
    totalItems: 0,
    completedItems: 0,
    currentItem: '',
    percentage: 0,
    error: null,
  });
  
  const [offlineStats, setOfflineStats] = useState({
    nodesCount: 0,
    edgesCount: 0,
    imagesCount: 0,
    cacheSize: '0 B',
    cacheSizeBytes: 0,
    lastSync: null,
    offlineEnabled: false,
  });

  // Subscribe to progress updates and initialize
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize offline service directories
        await OfflineService.initialize();
        // Load initial state
        await loadInitialState();
      } catch (error) {
        console.error('Failed to initialize download context:', error);
      }
    };

    const unsubscribe = OfflineService.subscribeToProgress((progress) => {
      setDownloadProgress(progress);
    });

    init();

    return unsubscribe;
  }, []);

  const loadInitialState = async () => {
    try {
      await OfflineService.loadProgress();
      const stats = await OfflineService.getOfflineStats();
      setOfflineStats(stats);
    } catch (error) {
      console.error('Failed to load initial state:', error);
    }
  };

  const refreshStats = useCallback(async () => {
    try {
      const stats = await OfflineService.getOfflineStats();
      setOfflineStats(stats);
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }, []);

  const startDownload = useCallback(async () => {
    try {
      // Use metadata-only download for initial setup
      const result = await OfflineService.downloadMetadataOnly(ApiService);
      if (result.success) {
        await refreshStats();
      }
      return result;
    } catch (error) {
      console.error('Download failed:', error);
      return { success: false, error: error.message };
    }
  }, [refreshStats]);

  const startFullDownload = useCallback(async () => {
    try {
      // Full download with all images
      const result = await OfflineService.downloadAllResources(ApiService);
      if (result.success) {
        await refreshStats();
      }
      return result;
    } catch (error) {
      console.error('Full download failed:', error);
      return { success: false, error: error.message };
    }
  }, [refreshStats]);

  const checkForUpdates = useCallback(async () => {
    try {
      const result = await OfflineService.checkAndUpdateResources(ApiService);
      if (result.success) {
        await refreshStats();
      }
      return result;
    } catch (error) {
      console.error('Update check failed:', error);
      return { success: false, error: error.message };
    }
  }, [refreshStats]);

  const clearCache = useCallback(async () => {
    try {
      const result = await OfflineService.clearCache();
      if (result.success) {
        await refreshStats();
      }
      return result;
    } catch (error) {
      console.error('Clear cache failed:', error);
      return { success: false, error: error.message };
    }
  }, [refreshStats]);

  const cancelDownload = useCallback(() => {
    return OfflineService.cancelDownload();
  }, []);

  const isDownloading = downloadProgress.status === 'downloading';

  const value = {
    downloadProgress,
    offlineStats,
    isDownloading,
    startDownload,
    startFullDownload,
    checkForUpdates,
    clearCache,
    cancelDownload,
    refreshStats,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownload = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
};

export default DownloadContext;
