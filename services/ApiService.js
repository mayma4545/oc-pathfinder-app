import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_ENDPOINTS } from '../config';
import OfflineService from './OfflineService';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear token on unauthorized
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// API Service functions
const ApiService = {
  // ============= Public APIs =============
  
  /**
   * Get list of all nodes with optional filtering
   * Falls back to offline cache if network unavailable
   */
  getNodes: async (params = {}, options = {}) => {
    const { offlineOnly = false } = options;
    
    // If offline only mode, use cached data
    if (offlineOnly) {
      const offlineNodes = await OfflineService.getNodes();
      if (offlineNodes) {
        return { success: true, nodes: offlineNodes, offline: true };
      }
      return { success: false, error: 'No offline data available', offline: true };
    }

    try {
      const response = await api.get(API_ENDPOINTS.NODES_LIST, { params });
      return { ...response.data, offline: false };
    } catch (error) {
      // Check if it's a network error - fallback to offline
      const isNetworkError = !error.response || 
                             error.code === 'ECONNABORTED' ||
                             error.code === 'ERR_NETWORK' ||
                             error.message?.includes('Network Error');
      
      if (isNetworkError) {
        console.log('Network unavailable, using cached nodes');
        const offlineNodes = await OfflineService.getNodes();
        if (offlineNodes && offlineNodes.length > 0) {
          return { success: true, nodes: offlineNodes, offline: true };
        }
      }
      throw error.response?.data || error;
    }
  },

  /**
   * Get detailed information about a specific node
   */
  getNodeDetail: async (nodeId) => {
    try {
      const response = await api.get(`${API_ENDPOINTS.NODE_DETAIL}${nodeId}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get list of all buildings
   * Falls back to extracting buildings from cached nodes if offline
   */
  getBuildings: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.BUILDINGS_LIST);
      return { ...response.data, offline: false };
    } catch (error) {
      // Check if it's a network error - extract buildings from cached nodes
      const isNetworkError = !error.response || 
                             error.code === 'ECONNABORTED' ||
                             error.code === 'ERR_NETWORK' ||
                             error.message?.includes('Network Error');
      
      if (isNetworkError) {
        const offlineNodes = await OfflineService.getNodes();
        if (offlineNodes && offlineNodes.length > 0) {
          // Extract unique buildings from nodes
          const buildingsSet = new Set(offlineNodes.map(n => n.building).filter(Boolean));
          const buildings = Array.from(buildingsSet).map(name => ({ name }));
          return { success: true, buildings, offline: true };
        }
      }
      throw error.response?.data || error;
    }
  },

  /**
   * Get campus map information
   * Falls back to cached campus map if offline
   */
  getCampusMap: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.CAMPUS_MAP);
      return { ...response.data, offline: false };
    } catch (error) {
      // Check if it's a network error - fallback to offline
      const isNetworkError = !error.response || 
                             error.code === 'ECONNABORTED' ||
                             error.code === 'ERR_NETWORK' ||
                             error.message?.includes('Network Error');
      
      if (isNetworkError) {
        const offlineMap = await OfflineService.getCampusMap();
        if (offlineMap) {
          return { success: true, map: offlineMap, offline: true };
        }
      }
      throw error.response?.data || error;
    }
  },

  /**
   * Find path between two nodes
   * Falls back to offline pathfinding if network is unavailable
   * @param {string} startCode - Starting node code
   * @param {string} goalCode - Destination node code
   * @param {boolean} avoidStairs - If true, avoid stairs
   * @param {Object} options - Optional configuration
   * @param {boolean} options.preferOffline - If true, use offline pathfinding first
   * @param {boolean} options.offlineOnly - If true, only use offline pathfinding
   * @returns {Object} Path result
   */
  findPath: async (startCode, goalCode, avoidStairs = false, options = {}) => {
    const { preferOffline = false, offlineOnly = false } = options;

    console.log('\n=== ApiService.findPath ===');
    console.log('Options:', { preferOffline, offlineOnly });

    // If offline only mode or prefer offline mode
    if (offlineOnly || preferOffline) {
      console.log('Using offline pathfinding...');
      const offlineResult = await OfflineService.findPath(startCode, goalCode, avoidStairs);
      
      console.log('Offline result:', { success: offlineResult.success, error: offlineResult.error });
      
      // If offline only or offline succeeded, return the result
      if (offlineOnly || offlineResult.success) {
        return offlineResult;
      }
      console.log('Offline failed, falling back to server...');
      // If prefer offline but failed, fall through to try server
    }

    // Try server-side pathfinding
    try {
      const response = await api.post(API_ENDPOINTS.FIND_PATH, {
        start_code: startCode,
        goal_code: goalCode,
        avoid_stairs: avoidStairs,
      });
      return { ...response.data, offline: false };
    } catch (error) {
      // Check if it's a network error
      const isNetworkError = !error.response || 
                             error.code === 'ECONNABORTED' ||
                             error.code === 'ERR_NETWORK' ||
                             error.message?.includes('Network Error') ||
                             error.message?.includes('timeout');

      // If network error, try offline fallback
      if (isNetworkError) {
        console.log('Network unavailable, attempting offline pathfinding...');
        const offlineResult = await OfflineService.findPath(startCode, goalCode, avoidStairs);
        
        if (offlineResult.success) {
          console.log('Offline pathfinding succeeded');
          return offlineResult;
        }
        
        // Both server and offline failed - provide helpful error message
        console.error('Offline pathfinding failed:', offlineResult.error);
        
        // Check if offline data exists
        const hasOfflineData = await OfflineService.isOfflineEnabled();
        const errorMessage = hasOfflineData 
          ? `No path found between the specified nodes. ${offlineResult.error || ''}`
          : 'No internet connection and no offline data available. Please connect to the internet or download offline maps from Settings > Offline Mode.';
        
        return {
          success: false,
          error: errorMessage,
          offline: true,
          hasOfflineData
        };
      }

      // Not a network error, throw the server error
      throw error.response?.data || error;
    }
  },

  /**
   * Get data version from server to check for updates
   */
  getDataVersion: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.DATA_VERSION);
      return response.data;
    } catch (error) {
      console.error('Failed to get data version:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Get list of all edges
   * Falls back to cached edges if offline
   */
  getEdges: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.EDGES_LIST);
      return { ...response.data, offline: false };
    } catch (error) {
      // Check if it's a network error - fallback to offline
      const isNetworkError = !error.response || 
                             error.code === 'ECONNABORTED' ||
                             error.code === 'ERR_NETWORK' ||
                             error.message?.includes('Network Error');
      
      if (isNetworkError) {
        console.log('Network unavailable, using cached edges');
        const offlineEdges = await OfflineService.getEdges();
        if (offlineEdges && offlineEdges.length > 0) {
          return { success: true, edges: offlineEdges, offline: true };
        }
      }
      throw error.response?.data || error;
    }
  },

  /**
   * Get annotations for a panorama
   */
  getAnnotations: async (panoramaId = null) => {
    try {
      const params = panoramaId ? { panorama_id: panoramaId } : {};
      const response = await api.get(API_ENDPOINTS.ANNOTATIONS_LIST, { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // ============= Admin Authentication =============

  /**
   * Admin login
   */
  adminLogin: async (username, password) => {
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN_LOGIN, {
        username,
        password,
      });
      
      if (response.data.success) {
        // Store auth token
        if (response.data.token) {
          await AsyncStorage.setItem('authToken', response.data.token);
        }
        // Store user info
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        await AsyncStorage.setItem('isAdmin', 'true');
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Admin logout
   */
  adminLogout: async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('isAdmin');
  },

  /**
   * Check if user is admin
   */
  isAdmin: async () => {
    const isAdmin = await AsyncStorage.getItem('isAdmin');
    return isAdmin === 'true';
  },

  // ============= Admin Node CRUD =============

  /**
   * Create new node
   */
  createNode: async (nodeData) => {
    try {
      const response = await api.post(API_ENDPOINTS.NODE_CREATE, nodeData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update existing node
   */
  updateNode: async (nodeId, nodeData) => {
    try {
      const response = await api.put(`${API_ENDPOINTS.NODE_UPDATE}${nodeId}/update/`, nodeData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Delete node
   */
  deleteNode: async (nodeId) => {
    try {
      const response = await api.delete(`${API_ENDPOINTS.NODE_DELETE}${nodeId}/delete/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // ============= Admin Edge CRUD =============

  /**
   * Create new edge
   */
  createEdge: async (edgeData) => {
    try {
      const response = await api.post(API_ENDPOINTS.EDGE_CREATE, edgeData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update existing edge
   */
  updateEdge: async (edgeId, edgeData) => {
    try {
      const response = await api.put(`${API_ENDPOINTS.EDGE_UPDATE}${edgeId}/update/`, edgeData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Delete edge
   */
  deleteEdge: async (edgeId) => {
    try {
      const response = await api.delete(`${API_ENDPOINTS.EDGE_DELETE}${edgeId}/delete/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // ============= Admin Annotation CRUD =============

  /**
   * Create new annotation
   */
  createAnnotation: async (annotationData) => {
    try {
      const response = await api.post(API_ENDPOINTS.ANNOTATION_CREATE, annotationData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update existing annotation
   */
  updateAnnotation: async (annotationId, annotationData) => {
    try {
      const response = await api.put(`${API_ENDPOINTS.ANNOTATION_UPDATE}${annotationId}/update/`, annotationData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Delete annotation
   */
  deleteAnnotation: async (annotationId) => {
    try {
      const response = await api.delete(`${API_ENDPOINTS.ANNOTATION_DELETE}${annotationId}/delete/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

export default ApiService;
