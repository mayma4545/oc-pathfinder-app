/**
 * Sync Manager - Handles automatic syncing when network changes
 * Features:
 * - Auto-sync when coming back online
 * - Background sync scheduling
 * - Conflict detection
 * - Sync status tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import OfflineService from '../services/OfflineService';
import ApiService from '../services/ApiService';

const SYNC_KEYS = {
  LAST_SYNC_ATTEMPT: '@sync_last_attempt',
  SYNC_FAILURES: '@sync_failures',
  AUTO_SYNC_ENABLED: '@sync_auto_enabled',
  SYNC_ON_WIFI_ONLY: '@sync_wifi_only',
};

class SyncManager {
  constructor() {
    this.syncInProgress = false;
    this.listeners = [];
    this.unsubscribeNetInfo = null;
    this.syncStatus = {
      lastSync: null,
      status: 'idle', // 'idle', 'syncing', 'success', 'error'
      message: '',
      hasUpdates: false,
    };
  }

  /**
   * Initialize sync manager and start listening for network changes
   */
  async initialize() {
    // Listen for network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && state.isInternetReachable) {
        await this.onNetworkReconnect(state);
      }
    });

    // Load last sync time
    const lastSync = await OfflineService.getLastSyncTime();
    this.syncStatus.lastSync = lastSync;
    
    return true;
  }

  /**
   * Cleanup listeners
   */
  cleanup() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners of status change
   */
  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb({ ...this.syncStatus });
      } catch (e) {
        console.error('Sync listener error:', e);
      }
    });
  }

  /**
   * Update sync status
   */
  updateStatus(updates) {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this.notifyListeners();
  }

  /**
   * Handle network reconnection
   */
  async onNetworkReconnect(networkState) {
    const autoSyncEnabled = await this.isAutoSyncEnabled();
    if (!autoSyncEnabled) return;

    const wifiOnly = await this.isWifiOnlySync();
    if (wifiOnly && networkState.type !== 'wifi') {
      console.log('Skipping auto-sync: WiFi only mode and not on WiFi');
      return;
    }

    // Check if we have offline data
    const offlineEnabled = await OfflineService.isOfflineEnabled();
    if (!offlineEnabled) return;

    // Check for updates
    await this.checkForUpdates();
  }

  /**
   * Check if auto-sync is enabled
   */
  async isAutoSyncEnabled() {
    try {
      const enabled = await AsyncStorage.getItem(SYNC_KEYS.AUTO_SYNC_ENABLED);
      return enabled !== 'false'; // Default to true
    } catch {
      return true;
    }
  }

  /**
   * Set auto-sync enabled/disabled
   */
  async setAutoSyncEnabled(enabled) {
    await AsyncStorage.setItem(SYNC_KEYS.AUTO_SYNC_ENABLED, enabled ? 'true' : 'false');
  }

  /**
   * Check if sync should only happen on WiFi
   */
  async isWifiOnlySync() {
    try {
      const wifiOnly = await AsyncStorage.getItem(SYNC_KEYS.SYNC_ON_WIFI_ONLY);
      return wifiOnly === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Set WiFi-only sync preference
   */
  async setWifiOnlySync(enabled) {
    await AsyncStorage.setItem(SYNC_KEYS.SYNC_ON_WIFI_ONLY, enabled ? 'true' : 'false');
  }

  /**
   * Check for updates from server
   */
  async checkForUpdates() {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return { success: false, reason: 'Sync in progress' };
    }

    this.syncInProgress = true;
    this.updateStatus({ status: 'syncing', message: 'Checking for updates...' });

    try {
      const result = await OfflineService.checkAndUpdateResources(ApiService);
      
      if (result.success) {
        this.updateStatus({
          status: 'success',
          lastSync: new Date(),
          hasUpdates: result.hasUpdates,
          message: result.hasUpdates 
            ? `Updated: ${result.newNodes || 0} nodes, ${result.newImages || 0} images`
            : 'All data is up to date',
        });

        // Reset pathfinder if data changed
        if (result.hasUpdates) {
          OfflineService.resetPathfinder();
        }
      } else {
        this.updateStatus({
          status: 'error',
          message: result.error || 'Sync failed',
        });
      }

      this.syncInProgress = false;
      return result;
    } catch (error) {
      console.error('Sync error:', error);
      this.updateStatus({
        status: 'error',
        message: error.message || 'Sync failed',
      });
      this.syncInProgress = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Force a full re-download of all resources
   */
  async forceFullSync() {
    if (this.syncInProgress) {
      return { success: false, reason: 'Sync in progress' };
    }

    this.syncInProgress = true;
    this.updateStatus({ status: 'syncing', message: 'Downloading all resources...' });

    try {
      const result = await OfflineService.downloadAllResources(ApiService);
      
      if (result.success) {
        this.updateStatus({
          status: 'success',
          lastSync: new Date(),
          hasUpdates: true,
          message: `Downloaded: ${result.nodesCount} nodes, ${result.imagesCount} images`,
        });
        OfflineService.resetPathfinder();
      } else {
        this.updateStatus({
          status: 'error',
          message: result.error || 'Download failed',
        });
      }

      this.syncInProgress = false;
      return result;
    } catch (error) {
      this.updateStatus({
        status: 'error',
        message: error.message || 'Download failed',
      });
      this.syncInProgress = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Get time since last sync in human-readable format
   */
  getTimeSinceSync() {
    if (!this.syncStatus.lastSync) return 'Never synced';

    const now = new Date();
    const diff = now - new Date(this.syncStatus.lastSync);
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  /**
   * Check if sync is recommended (e.g., data is stale)
   */
  async shouldSync() {
    const lastSync = await OfflineService.getLastSyncTime();
    if (!lastSync) return true;

    const hoursSinceSync = (Date.now() - new Date(lastSync).getTime()) / 3600000;
    return hoursSinceSync > 24; // Recommend sync if older than 24 hours
  }
}

// Export singleton instance
export default new SyncManager();
