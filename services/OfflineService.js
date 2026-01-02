/**
 * Offline Service - Handles local caching of nodes, edges, and images
 * Uses AsyncStorage for data and expo-file-system (new API) for images
 * Includes offline pathfinding support using client-side A* algorithm
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { API_BASE_URL } from '../config';
import { getPathfinder, resetPathfinder } from '../utils/pathfinding';

// Storage keys
const STORAGE_KEYS = {
  NODES: '@offline_nodes',
  EDGES: '@offline_edges',
  CAMPUS_MAP: '@offline_campus_map',
  LAST_SYNC: '@offline_last_sync',
  DATA_VERSION: '@offline_data_version',
  OFFLINE_ENABLED: '@offline_enabled',
  DOWNLOAD_PROGRESS: '@offline_download_progress',
};

// Directory instances for cached images
const IMAGE_CACHE_DIR = new Directory(Paths.document, 'offline_images');
const IMAGE_360_DIR = new Directory(IMAGE_CACHE_DIR, '360');
const CAMPUS_MAP_DIR = new Directory(IMAGE_CACHE_DIR, 'maps');

class OfflineService {
  constructor() {
    this.downloadCallbacks = [];
    this.isDownloading = false;
    this.downloadProgress = {
      status: 'idle', // 'idle', 'downloading', 'completed', 'error'
      totalItems: 0,
      completedItems: 0,
      currentItem: '',
      percentage: 0,
      error: null,
    };
  }

  /**
   * Initialize offline directories
   */
  async initialize() {
    try {
      // Create directories if they don't exist using the new API
      const dirsToCreate = [IMAGE_CACHE_DIR, IMAGE_360_DIR, CAMPUS_MAP_DIR];
      for (const dir of dirsToCreate) {
        if (!dir.exists) {
          dir.create({ intermediates: true });
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize offline directories:', error);
      return false;
    }
  }

  /**
   * Subscribe to download progress updates
   */
  subscribeToProgress(callback) {
    this.downloadCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.downloadCallbacks = this.downloadCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all subscribers of progress update
   */
  notifyProgress() {
    this.downloadCallbacks.forEach(callback => {
      try {
        callback({ ...this.downloadProgress });
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  /**
   * Update download progress
   */
  updateProgress(updates) {
    this.downloadProgress = { ...this.downloadProgress, ...updates };
    if (this.downloadProgress.totalItems > 0) {
      this.downloadProgress.percentage = Math.round(
        (this.downloadProgress.completedItems / this.downloadProgress.totalItems) * 100
      );
    }
    this.notifyProgress();
    // Save progress to storage for persistence
    this.saveProgress();
  }

  /**
   * Save progress to AsyncStorage
   */
  async saveProgress() {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.DOWNLOAD_PROGRESS,
        JSON.stringify(this.downloadProgress)
      );
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }

  /**
   * Load progress from AsyncStorage
   */
  async loadProgress() {
    try {
      const savedProgress = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOAD_PROGRESS);
      if (savedProgress) {
        this.downloadProgress = JSON.parse(savedProgress);
      }
      return this.downloadProgress;
    } catch (error) {
      console.error('Failed to load progress:', error);
      return this.downloadProgress;
    }
  }

  /**
   * Check if offline mode is enabled
   */
  async isOfflineEnabled() {
    try {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_ENABLED);
      return enabled === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Set offline mode enabled/disabled
   */
  async setOfflineEnabled(enabled) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_ENABLED, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to set offline enabled:', error);
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime() {
    try {
      const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a safe filename from URL
   */
  getImageFilename(url, nodeId) {
    if (!url) return null;
    const extension = url.split('.').pop().split('?')[0] || 'jpg';
    return `node_${nodeId}.${extension}`;
  }

  /**
   * Get local path for a 360 image
   */
  getLocal360ImagePath(nodeId) {
    return new File(IMAGE_360_DIR, `node_${nodeId}.jpg`);
  }

  /**
   * Get local path for campus map
   */
  getLocalCampusMapPath(mapId) {
    return new File(CAMPUS_MAP_DIR, `map_${mapId}.jpg`);
  }

  /**
   * Check if an image is cached locally
   */
  async isImageCached(nodeId) {
    try {
      const localFile = this.getLocal360ImagePath(nodeId);
      return localFile.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get image URL - returns local path if cached, otherwise remote URL
   * ALWAYS prefers cached version if available, even when online
   */
  async getImageUrl(node) {
    // Handle both image360_url and image360 property names
    const imageUrl = node?.image360_url || node?.image360;
    if (!node || !imageUrl) return null;
    
    try {
      // Always check for cached image first, regardless of online/offline status
      const localFile = this.getLocal360ImagePath(node.node_id);
      
      if (localFile.exists) {
        console.log(`📦 Using cached image for node ${node.node_id}: ${localFile.uri}`);
        return localFile.uri;
      } else {
        console.log(`🌐 No cache for node ${node.node_id}, using remote: ${imageUrl}`);
      }
      
      // Fall back to remote URL if not cached
      return imageUrl;
    } catch (error) {
      console.error('Error checking cached image:', error);
      return imageUrl;
    }
  }

  /**
   * Get campus map image URL - returns local path if cached, otherwise remote URL
   * ALWAYS prefers cached version if available, even when online
   */
  async getCampusMapImageUrl(mapImageUrl, mapId = 'main') {
    if (!mapImageUrl) return null;
    
    try {
      // Always check for cached map first, regardless of online/offline status
      const localFile = this.getLocalCampusMapPath(mapId);
      
      if (localFile.exists) {
        console.log(`📦 Using cached campus map image: ${localFile.uri}`);
        return localFile.uri;
      } else {
        console.log(`🌐 No cached map, using remote: ${mapImageUrl}`);
      }
      
      // Fall back to remote URL if not cached
      return mapImageUrl;
    } catch (error) {
      console.error('Error checking cached map image:', error);
      return mapImageUrl;
    }
  }

  /**
   * Download a single image
   */
  async downloadImage(url, filename) {
    try {
      if (!url) {
        console.warn('No URL provided for image download');
        return false;
      }

      console.log(`Downloading image: ${filename}`);
      const localFile = new File(IMAGE_360_DIR, filename);
      
      // Download using fetch and get as blob
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get response as blob, then convert to base64
      const blob = await response.blob();
      
      // Use FileReader to convert blob to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result;
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Extract the base64 data (remove data:image/jpeg;base64, prefix)
      const base64Data = base64.split(',')[1];
      
      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Write to file
      await localFile.write(bytes);
      
      console.log(`✅ Downloaded: ${filename} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to download image: ${url}`, error.message);
      return false;
    }
  }

  /**
   * Save nodes to local storage
   */
  async saveNodes(nodes) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodes));
      return true;
    } catch (error) {
      console.error('Failed to save nodes:', error);
      return false;
    }
  }

  /**
   * Get nodes from local storage
   */
  async getNodes() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NODES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get nodes:', error);
      return null;
    }
  }

  /**
   * Save edges to local storage
   */
  async saveEdges(edges) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EDGES, JSON.stringify(edges));
      return true;
    } catch (error) {
      console.error('Failed to save edges:', error);
      return false;
    }
  }

  /**
   * Get edges from local storage
   */
  async getEdges() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EDGES);
      const edges = data ? JSON.parse(data) : null;
      console.log('Retrieved edges from storage, count:', edges?.length || 0);
      return edges;
    } catch (error) {
      console.error('Failed to get edges:', error);
      return null;
    }
  }

  /**
   * Save campus map to local storage
   */
  async saveCampusMap(map) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CAMPUS_MAP, JSON.stringify(map));
      return true;
    } catch (error) {
      console.error('Failed to save campus map:', error);
      return false;
    }
  }

  /**
   * Get campus map from local storage
   */
  async getCampusMap() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CAMPUS_MAP);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get campus map:', error);
      return null;
    }
  }

  /**
   * Download all resources for offline use
   */
  async downloadAllResources(apiService) {
    if (this.isDownloading) {
      console.log('Download already in progress');
      return { success: false, error: 'Download already in progress' };
    }

    this.isDownloading = true;
    await this.initialize();

    try {
      // Reset progress
      this.updateProgress({
        status: 'downloading',
        totalItems: 0,
        completedItems: 0,
        currentItem: 'Fetching data...',
        percentage: 0,
        error: null,
      });

      // Step 1: Fetch all data from API
      this.updateProgress({ currentItem: 'Fetching nodes...' });
      const nodesResponse = await apiService.getNodes();
      if (!nodesResponse.success) {
        throw new Error('Failed to fetch nodes');
      }
      const nodes = nodesResponse.nodes || [];

      this.updateProgress({ currentItem: 'Fetching edges...' });
      const edgesResponse = await apiService.getEdges();
      console.log('Edges API Response:', {
        success: edgesResponse.success,
        edgesCount: edgesResponse.edges?.length || 0,
        offline: edgesResponse.offline
      });
      if (!edgesResponse.success) {
        throw new Error('Failed to fetch edges');
      }
      const edges = edgesResponse.edges || [];
      console.log('Downloaded edges count:', edges.length);
      if (edges.length > 0) {
        console.log('Sample edge:', edges[0]);
      } else {
        console.warn('⚠️ WARNING: No edges downloaded! Pathfinding will not work.');
      }

      this.updateProgress({ currentItem: 'Fetching campus map...' });
      const mapResponse = await apiService.getCampusMap();
      const campusMap = mapResponse.success ? mapResponse.map : null;

      // Calculate total items to download
      const nodesWithImages = nodes.filter(n => n.image360_url || n.image360);
      console.log(`📋 Nodes with images: ${nodesWithImages.length}/${nodes.length}`);
      
      const totalItems = 3 + nodesWithImages.length + (campusMap?.image_url ? 1 : 0);
      // 3 = save nodes + save edges + save campus map data

      this.updateProgress({
        totalItems,
        completedItems: 0,
      });

      // Step 2: Save data to local storage
      this.updateProgress({ currentItem: 'Saving nodes data...', completedItems: 1 });
      await this.saveNodes(nodes);

      this.updateProgress({ currentItem: 'Saving edges data...', completedItems: 2 });
      const savedEdges = await this.saveEdges(edges);
      console.log('Saved edges to storage:', savedEdges ? 'SUCCESS' : 'FAILED');
      console.log('Edges saved count:', edges.length);
      
      // Verify edges were saved
      const verifyEdges = await this.getEdges();
      console.log('Verified edges in storage:', verifyEdges?.length || 0);

      this.updateProgress({ currentItem: 'Saving campus map data...', completedItems: 3 });
      if (campusMap) {
        await this.saveCampusMap(campusMap);
      }

      let completedItems = 3;

      // Step 3: Download campus map image
      if (campusMap?.image_url) {
        this.updateProgress({ currentItem: 'Downloading campus map image...' });
        const mapId = campusMap.id || 'main';
        await this.downloadImage(campusMap.image_url, `map_${mapId}.jpg`);
        completedItems++;
        this.updateProgress({ completedItems });
      }

      // Step 4: Download all 360° images
      console.log(`\n📸 Starting image download for ${nodesWithImages.length} nodes...`);
      
      for (let i = 0; i < nodesWithImages.length; i++) {
        const node = nodesWithImages[i];
        const imageUrl = node.image360_url || node.image360;
        
        this.updateProgress({
          currentItem: `Downloading image ${i + 1}/${nodesWithImages.length}: ${node.name}`,
        });

        const localFile = this.getLocal360ImagePath(node.node_id);
        
        // Check if already cached
        if (!localFile.exists) {
          console.log(`  Downloading node ${node.node_id}: ${node.name}`);
          const success = await this.downloadImage(imageUrl, `node_${node.node_id}.jpg`);
          if (!success) {
            console.warn(`  ⚠️ Failed to download image for node ${node.node_id}`);
          }
        } else {
          console.log(`  ✅ Already cached: node ${node.node_id}`);
        }

        completedItems++;
        this.updateProgress({ completedItems });
      }
      
      console.log(`✅ Image download complete`);

      // Step 5: Initialize pathfinder with downloaded data
      this.updateProgress({
        currentItem: 'Initializing pathfinding engine...',
        completedItems,
      });
      
      try {
        // Reset any existing pathfinder instance
        resetPathfinder();
        
        // Pre-initialize the pathfinder to verify data is valid
        const pathfinderInitialized = await this.initializePathfinder();
        if (pathfinderInitialized) {
          console.log('✅ Pathfinder initialized successfully after download');
        } else {
          console.warn('⚠️ Pathfinder initialization failed after download');
        }
      } catch (error) {
        console.error('Error initializing pathfinder:', error);
      }

      // Step 6: Update sync timestamp
      const syncTime = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, syncTime);
      await this.setOfflineEnabled(true);

      this.updateProgress({
        status: 'completed',
        currentItem: 'All resources downloaded!',
        percentage: 100,
      });

      this.isDownloading = false;
      return {
        success: true,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        imagesCount: nodesWithImages.length,
      };

    } catch (error) {
      console.error('Download failed:', error);
      this.updateProgress({
        status: 'error',
        error: error.message || 'Download failed',
      });
      this.isDownloading = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for updates and download only new/changed items
   */
  async checkAndUpdateResources(apiService) {
    try {
      console.log('\n=== Checking for Updates ===');
      const offlineEnabled = await this.isOfflineEnabled();
      if (!offlineEnabled) {
        console.log('Offline mode not enabled, skipping update check');
        return { success: true, hasUpdates: false };
      }

      // Get current local data
      const localNodes = await this.getNodes();
      const localEdges = await this.getEdges();

      console.log('Current offline data:');
      console.log('  - Nodes:', localNodes?.length || 0);
      console.log('  - Edges:', localEdges?.length || 0);

      // Fetch latest from server
      const nodesResponse = await apiService.getNodes();
      const edgesResponse = await apiService.getEdges();

      if (!nodesResponse.success || !edgesResponse.success) {
        return { success: false, error: 'Failed to check for updates' };
      }

      const serverNodes = nodesResponse.nodes || [];
      const serverEdges = edgesResponse.edges || [];

      console.log('Server data:');
      console.log('  - Nodes:', serverNodes.length);
      console.log('  - Edges:', serverEdges.length);

      // Check if data has changed
      const nodesChanged = !localNodes || localNodes.length !== serverNodes.length;
      const edgesChanged = !localEdges || localEdges.length !== serverEdges.length;
      
      // Calculate new nodes
      const localNodeIds = new Set((localNodes || []).map(n => n.node_id));
      const newNodesAdded = serverNodes.filter(n => !localNodeIds.has(n.node_id));
      
      // Find nodes with new/updated images
      const localNodeMap = new Map((localNodes || []).map(n => [n.node_id, n]));
      const nodesNeedingImages = serverNodes.filter(serverNode => {
        const imageUrl = serverNode.image360_url || serverNode.image360;
        if (!imageUrl) return false;
        
        const localNode = localNodeMap.get(serverNode.node_id);
        // Download if: new node OR image URL changed
        return !localNode || localNode.image360_url !== imageUrl || localNode.image360 !== imageUrl;
      });

      console.log('Changes detected:');
      console.log('  - Nodes changed:', nodesChanged);
      console.log('  - Edges changed:', edgesChanged);
      console.log('  - New nodes:', newNodesAdded.length);
      console.log('  - Images to download:', nodesNeedingImages.length);

      // Always update nodes and edges data (they're small)
      await this.saveNodes(serverNodes);
      await this.saveEdges(serverEdges);
      console.log('✅ Updated nodes and edges in cache');

      if (nodesNeedingImages.length === 0) {
        // Just data update, no images
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        
        // Reset pathfinder if data changed
        if (nodesChanged || edgesChanged) {
          resetPathfinder();
          console.log('✅ Pathfinder reset due to data changes');
        }
        
        return { 
          success: true, 
          hasUpdates: nodesChanged || edgesChanged,
          newNodes: 0,
          newImages: 0
        };
      }

      // Download new/updated resources
      this.isDownloading = true;
      this.updateProgress({
        status: 'downloading',
        totalItems: nodesNeedingImages.length + 2,
        completedItems: 0,
        currentItem: 'Updating data...',
        percentage: 0,
        error: null,
      });

      // Save updated data
      await this.saveNodes(serverNodes);
      this.updateProgress({ completedItems: 1, currentItem: 'Saving updated data...' });
      
      await this.saveEdges(serverEdges);
      this.updateProgress({ completedItems: 2 });

      // Download new images
      for (let i = 0; i < nodesNeedingImages.length; i++) {
        const node = nodesNeedingImages[i];
        const imageUrl = node.image360_url || node.image360;
        
        this.updateProgress({
          currentItem: `Downloading new image: ${node.name}`,
          completedItems: i + 2,
        });

        await this.downloadImage(imageUrl, `node_${node.node_id}.jpg`);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      
      // Reset pathfinder after updating
      resetPathfinder();

      this.updateProgress({
        status: 'completed',
        currentItem: 'Update complete!',
        percentage: 100,
        completedItems: nodesNeedingImages.length + 2,
      });

      this.isDownloading = false;
      return {
        success: true,
        hasUpdates: true,
        newNodes: newNodesAdded.length,
        newImages: nodesNeedingImages.length,
      };

    } catch (error) {
      console.error('Update check failed:', error);
      this.isDownloading = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    try {
      // Clear AsyncStorage
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.NODES,
        STORAGE_KEYS.EDGES,
        STORAGE_KEYS.CAMPUS_MAP,
        STORAGE_KEYS.LAST_SYNC,
        STORAGE_KEYS.DATA_VERSION,
        STORAGE_KEYS.DOWNLOAD_PROGRESS,
      ]);

      // Clear image directories using new API
      const dirs = [IMAGE_360_DIR, CAMPUS_MAP_DIR];
      for (const dir of dirs) {
        if (dir.exists) {
          dir.delete();
        }
      }

      // Re-create directories
      await this.initialize();

      this.downloadProgress = {
        status: 'idle',
        totalItems: 0,
        completedItems: 0,
        currentItem: '',
        percentage: 0,
        error: null,
      };
      this.notifyProgress();

      return { success: true };
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cache size in bytes
   */
  async getCacheSize() {
    try {
      let totalSize = 0;

      const calculateDirSize = async (dir) => {
        if (!dir.exists) return 0;

        let size = 0;
        const entries = dir.list();
        for (const entry of entries) {
          if (entry instanceof File) {
            size += entry.size || 0;
          }
        }
        return size;
      };

      totalSize += await calculateDirSize(IMAGE_360_DIR);
      totalSize += await calculateDirSize(CAMPUS_MAP_DIR);

      return totalSize;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get offline statistics
   */
  async getOfflineStats() {
    try {
      const nodes = await this.getNodes();
      const edges = await this.getEdges();
      const lastSync = await this.getLastSyncTime();
      const cacheSize = await this.getCacheSize();
      const offlineEnabled = await this.isOfflineEnabled();

      // Count cached images
      let cachedImagesCount = 0;
      try {
        if (IMAGE_360_DIR.exists) {
          const entries = IMAGE_360_DIR.list();
          cachedImagesCount = entries.length;
        }
      } catch (e) {
        // Directory might not exist
      }

      return {
        nodesCount: nodes?.length || 0,
        edgesCount: edges?.length || 0,
        imagesCount: cachedImagesCount,
        cacheSize: this.formatBytes(cacheSize),
        cacheSizeBytes: cacheSize,
        lastSync: lastSync,
        offlineEnabled,
      };
    } catch (error) {
      console.error('Failed to get offline stats:', error);
      return {
        nodesCount: 0,
        edgesCount: 0,
        imagesCount: 0,
        cacheSize: '0 B',
        cacheSizeBytes: 0,
        lastSync: null,
        offlineEnabled: false,
      };
    }
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload() {
    if (this.isDownloading) {
      this.isDownloading = false;
      this.updateProgress({
        status: 'idle',
        currentItem: 'Download cancelled',
        error: null,
      });
      return true;
    }
    return false;
  }

  /**
   * Initialize pathfinder with cached data
   * @returns {boolean} True if successfully initialized
   */
  async initializePathfinder() {
    try {
      const nodes = await this.getNodes();
      const edges = await this.getEdges();

      console.log('\n=== Initializing Pathfinder ===');
      console.log('Nodes count:', nodes?.length || 0);
      console.log('Edges count:', edges?.length || 0);
      
      if (edges && edges.length > 0) {
        console.log('Sample edge structure:', edges[0]);
      }

      if (!nodes || !edges || nodes.length === 0) {
        console.warn('⚠️ No cached data available for pathfinding');
        return false;
      }

      if (edges.length === 0) {
        console.error('❌ No edges available - pathfinding will fail!');
        console.error('This means either:');
        console.error('  1. No edges exist in the database');
        console.error('  2. Edges download failed');
        console.error('  3. Edges were not saved to AsyncStorage');
        return false;
      }

      const pathfinder = getPathfinder();
      pathfinder.buildGraph(nodes, edges);
      
      console.log('Pathfinder initialized successfully');
      console.log('Graph stats:', pathfinder.getStats());
      
      return true;
    } catch (error) {
      console.error('Failed to initialize pathfinder:', error);
      return false;
    }
  }

  /**
   * Find path offline using cached nodes and edges
   * @param {string} startCode - Starting node code
   * @param {string} goalCode - Destination node code
   * @param {boolean} avoidStairs - If true, avoid edges with is_staircase=true
   * @returns {Object} Path result with success flag, path array, or error message
   */
  async findPath(startCode, goalCode, avoidStairs = false) {
    try {
      console.log('\n=== Offline Pathfinding Request ===');
      console.log('Start Code:', startCode);
      console.log('Goal Code:', goalCode);
      console.log('Avoid Stairs:', avoidStairs);
      
      const pathfinder = getPathfinder();

      // Initialize pathfinder if not already done
      if (!pathfinder.isInitialized()) {
        console.log('Pathfinder not initialized, initializing now...');
        const initialized = await this.initializePathfinder();
        if (!initialized) {
          console.error('Failed to initialize pathfinder');
          
          // Check what data is missing
          const nodes = await this.getNodes();
          const edges = await this.getEdges();
          
          console.log('Offline data check:');
          console.log('  - Nodes:', nodes ? nodes.length : 0);
          console.log('  - Edges:', edges ? edges.length : 0);
          
          let errorDetail = '';
          if (!nodes || nodes.length === 0) {
            errorDetail = 'No nodes data downloaded.';
          } else if (!edges || edges.length === 0) {
            errorDetail = 'No edges data downloaded.';
          } else {
            errorDetail = 'Graph initialization failed.';
          }
          
          return {
            success: false,
            error: `Offline map data not available. ${errorDetail} Please download offline maps from Settings.`,
            offline: true
          };
        }
        console.log('Pathfinder initialized successfully');
      } else {
        console.log('Pathfinder already initialized');
      }

      console.log('Finding path using A* algorithm...');
      // Find path using client-side A* algorithm
      const result = pathfinder.findPath(startCode, goalCode, avoidStairs);
      
      console.log('Pathfinding result:', result.success ? 'Success' : 'Failed');
      if (result.success) {
        console.log('Path length:', result.path?.length || 0);
        console.log('Total distance:', result.total_distance);
      } else {
        console.error('Pathfinding error:', result.error);
      }
      
      // Add offline indicator to result
      result.offline = true;
      
      return result;
    } catch (error) {
      console.error('Offline pathfinding failed with exception:', error);
      return {
        success: false,
        error: error.message || 'Offline pathfinding failed',
        offline: true
      };
    }
  }

  /**
   * Get turn-by-turn directions offline
   * @param {string} startCode - Starting node code
   * @param {string} goalCode - Destination node code
   * @param {boolean} avoidStairs - If true, avoid stairs
   * @returns {Object} Path with human-readable directions
   */
  async getDirections(startCode, goalCode, avoidStairs = false) {
    try {
      const pathfinder = getPathfinder();

      // Initialize pathfinder if not already done
      if (!pathfinder.isInitialized()) {
        const initialized = await this.initializePathfinder();
        if (!initialized) {
          return {
            success: false,
            error: 'Offline pathfinding unavailable - no cached data',
            offline: true
          };
        }
      }

      // Get directions using client-side algorithm
      const result = pathfinder.getDirections(startCode, goalCode, avoidStairs);
      
      // Add offline indicator to result
      result.offline = true;
      
      return result;
    } catch (error) {
      console.error('Offline directions failed:', error);
      return {
        success: false,
        error: error.message || 'Offline directions failed',
        offline: true
      };
    }
  }

  /**
   * Reset pathfinder (useful when cached data changes)
   */
  resetPathfinder() {
    resetPathfinder();
  }

  /**
   * Diagnostic function to check offline data status
   * @returns {Object} Detailed status of offline data
   */
  async diagnoseOfflineData() {
    try {
      const nodes = await this.getNodes();
      const edges = await this.getEdges();
      const campusMap = await this.getCampusMap();
      const offlineEnabled = await this.isOfflineEnabled();

      const diagnosis = {
        offlineEnabled,
        nodesCount: nodes?.length || 0,
        edgesCount: edges?.length || 0,
        hasCampusMap: !!campusMap,
        issues: []
      };

      if (!offlineEnabled) {
        diagnosis.issues.push('Offline mode not enabled');
      }
      if (!nodes || nodes.length === 0) {
        diagnosis.issues.push('No nodes data');
      }
      if (!edges || edges.length === 0) {
        diagnosis.issues.push('⚠️ CRITICAL: No edges data - pathfinding will fail!');
      }
      if (!campusMap) {
        diagnosis.issues.push('No campus map data');
      }

      if (edges && edges.length > 0) {
        diagnosis.sampleEdge = edges[0];
      }

      return diagnosis;
    } catch (error) {
      return {
        error: error.message,
        issues: ['Failed to diagnose offline data']
      };
    }
  }

  /**
   * Check if offline pathfinding is available
   * @returns {boolean} True if cached data is available for pathfinding
   */
  async isPathfindingAvailable() {
    try {
      const nodes = await this.getNodes();
      const edges = await this.getEdges();
      return nodes && edges && nodes.length > 0 && edges.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify offline pathfinding is working by testing the pathfinder
   * @returns {Object} Verification result with status and details
   */
  async verifyPathfinding() {
    try {
      const nodes = await this.getNodes();
      const edges = await this.getEdges();

      if (!nodes || nodes.length === 0) {
        return {
          success: false,
          error: 'No nodes data available',
          nodesCount: 0,
          edgesCount: 0
        };
      }

      if (!edges || edges.length === 0) {
        return {
          success: false,
          error: 'No edges data available',
          nodesCount: nodes.length,
          edgesCount: 0
        };
      }

      // Try to initialize pathfinder
      const pathfinder = getPathfinder();
      if (!pathfinder.isInitialized()) {
        const initialized = await this.initializePathfinder();
        if (!initialized) {
          return {
            success: false,
            error: 'Failed to initialize pathfinder',
            nodesCount: nodes.length,
            edgesCount: edges.length
          };
        }
      }

      const stats = pathfinder.getStats();

      return {
        success: true,
        message: 'Offline pathfinding is ready',
        nodesCount: stats.nodes,
        edgesCount: stats.edges,
        initialized: stats.initialized
      };
    } catch (error) {
      console.error('Pathfinding verification failed:', error);
      return {
        success: false,
        error: error.message || 'Verification failed'
      };
    }
  }
}

// Export singleton instance
export default new OfflineService();
