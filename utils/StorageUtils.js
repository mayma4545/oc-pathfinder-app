/**
 * Storage Utilities - Check storage space and data freshness
 */

import * as FileSystem from 'expo-file-system';
import OfflineService from '../services/OfflineService';

/**
 * Check available storage space on the device
 * @returns {Object} { available, total, used } in bytes
 */
export const checkStorageSpace = async () => {
  try {
    const freeSpace = await FileSystem.getFreeDiskStorageAsync();
    const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
    
    return {
      available: freeSpace,
      total: totalSpace,
      used: totalSpace - freeSpace,
      availableFormatted: formatBytes(freeSpace),
      totalFormatted: formatBytes(totalSpace),
    };
  } catch (error) {
    console.error('Error checking storage:', error);
    return null;
  }
};

/**
 * Check if there's enough space for offline download
 * @param {number} estimatedSize - Estimated download size in bytes
 * @returns {Object} { hasSpace, available, required }
 */
export const hasEnoughSpace = async (estimatedSize) => {
  const storage = await checkStorageSpace();
  if (!storage) {
    return { hasSpace: true, message: 'Could not check storage' };
  }
  
  // Add 20% buffer for safety
  const requiredSpace = estimatedSize * 1.2;
  const hasSpace = storage.available > requiredSpace;
  
  return {
    hasSpace,
    available: storage.available,
    availableFormatted: storage.availableFormatted,
    required: requiredSpace,
    requiredFormatted: formatBytes(requiredSpace),
    message: hasSpace 
      ? `${storage.availableFormatted} available` 
      : `Not enough space. Need ${formatBytes(requiredSpace)}, have ${storage.availableFormatted}`,
  };
};

/**
 * Check data freshness
 * @returns {Object} { isFresh, daysSinceSync, message, shouldSync }
 */
export const checkDataFreshness = async () => {
  const lastSync = await OfflineService.getLastSyncTime();
  
  if (!lastSync) {
    return {
      isFresh: false,
      daysSinceSync: null,
      message: 'Never synced',
      shouldSync: true,
      severity: 'high',
    };
  }
  
  const now = new Date();
  const syncDate = new Date(lastSync);
  const diffMs = now - syncDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  let message, severity, shouldSync;
  
  if (diffHours < 1) {
    message = 'Just synced';
    severity = 'none';
    shouldSync = false;
  } else if (diffHours < 24) {
    message = `Synced ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    severity = 'none';
    shouldSync = false;
  } else if (diffDays < 3) {
    message = `Synced ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    severity = 'low';
    shouldSync = false;
  } else if (diffDays < 7) {
    message = `Synced ${diffDays} days ago`;
    severity = 'medium';
    shouldSync = true;
  } else {
    message = `Synced ${diffDays} days ago - data may be outdated`;
    severity = 'high';
    shouldSync = true;
  }
  
  return {
    isFresh: diffDays < 3,
    daysSinceSync: diffDays,
    hoursSinceSync: diffHours,
    message,
    severity,
    shouldSync,
    lastSync: syncDate,
  };
};

/**
 * Estimate download size based on node count
 * @param {number} nodeCount - Number of nodes
 * @returns {number} Estimated size in bytes
 */
export const estimateDownloadSize = (nodeCount) => {
  // Average 360° image size is about 500KB-2MB
  // We'll estimate 800KB per image on average
  const avgImageSize = 800 * 1024; // 800KB
  
  // Assume about 70% of nodes have images
  const imagesCount = Math.ceil(nodeCount * 0.7);
  
  // Add some overhead for JSON data (about 1KB per node)
  const dataSize = nodeCount * 1024;
  
  return (imagesCount * avgImageSize) + dataSize;
};

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get comprehensive offline status
 * @returns {Object} Full offline status
 */
export const getOfflineStatus = async () => {
  const stats = await OfflineService.getOfflineStats();
  const freshness = await checkDataFreshness();
  const storage = await checkStorageSpace();
  const pathfindingAvailable = await OfflineService.isPathfindingAvailable();
  
  return {
    isEnabled: stats.offlineEnabled,
    pathfindingAvailable,
    stats,
    freshness,
    storage,
    summary: getSummaryMessage(stats, freshness, pathfindingAvailable),
  };
};

/**
 * Get a summary message for offline status
 */
const getSummaryMessage = (stats, freshness, pathfindingAvailable) => {
  if (!stats.offlineEnabled) {
    return {
      text: 'Offline mode not set up',
      type: 'warning',
      action: 'Download offline data to use the app without internet',
    };
  }
  
  if (!pathfindingAvailable) {
    return {
      text: 'Offline navigation unavailable',
      type: 'warning',
      action: 'Download data to enable offline pathfinding',
    };
  }
  
  if (freshness.severity === 'high') {
    return {
      text: 'Offline data may be outdated',
      type: 'warning',
      action: 'Sync now to get the latest map updates',
    };
  }
  
  return {
    text: 'Offline mode ready',
    type: 'success',
    action: null,
  };
};

export default {
  checkStorageSpace,
  hasEnoughSpace,
  checkDataFreshness,
  estimateDownloadSize,
  formatBytes,
  getOfflineStatus,
};
