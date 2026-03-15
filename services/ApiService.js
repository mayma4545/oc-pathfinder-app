import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_ENDPOINTS } from '../config';
import OfflineService from './OfflineService';
import { isNetworkError } from '../utils/networkUtils';

// Generate a UUID v4 string with no external dependencies
const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// Get or create a unique, persistent install ID for this app installation.
// Stored in AsyncStorage so it survives app restarts but is unique per install.
const getInstallId = async () => {
  let id = await AsyncStorage.getItem('appInstallId');
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem('appInstallId', id);
  }
  return id;
};

// Public / read-only requests — 5 s timeout is fine (no large payloads)
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Admin mutation requests — 30 s timeout to handle base64 image uploads on slow networks
const adminApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token + unique install ID to every request for both instances
const attachRequestInterceptor = (instance) => {
  instance.interceptors.request.use(
    async (config) => {
      const [token, installId] = await Promise.all([
        AsyncStorage.getItem('authToken'),
        getInstallId(),
      ]);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      // Rate limiter uses this to apply 5 req/sec per install (not per IP)
      config.headers['X-App-Install-ID'] = installId;
      return config;
    },
    (error) => Promise.reject(error),
  );
};

attachRequestInterceptor(api);
attachRequestInterceptor(adminApi);

// Response interceptor for error handling
let logoutCallback = null;
// Guard against duplicate logout calls when multiple concurrent requests all get 401
// (e.g. two requests in-flight when the token expires simultaneously)
let isLoggingOut = false;

// Attach response interceptor to both api and adminApi
const attachResponseInterceptor = (instance) => {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        const serverError = error.response.data || {};
        // Tag the error so screens can display a specific "session expired" message
        // rather than a generic failure, and distinguish expiry from wrong credentials
        error.sessionExpired = serverError.error === 'Session expired';

        if (!isLoggingOut) {
          isLoggingOut = true;
          await AsyncStorage.multiRemove(['authToken', 'user', 'isAdmin']);
          if (logoutCallback) logoutCallback(error.sessionExpired);
        }
      }
      return Promise.reject(error);
    },
  );
};

attachResponseInterceptor(api);
attachResponseInterceptor(adminApi);

// API Service functions
const ApiService = {
  setLogoutCallback: (callback) => {
    logoutCallback = callback;
    isLoggingOut = false; // Reset when a new callback is registered (on app startup / after login)
  },
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

      // Always keep cached nodes fresh so offline fallback does not serve stale data.
      // Normalize image fields so both image360 and image360_url are always present.
      if (response.data?.success && Array.isArray(response.data.nodes)) {
        const normalized = response.data.nodes.map(ApiService.normalizeNodeImageFields);
        OfflineService.saveNodes(normalized)
          .catch((err) => console.warn('Background cache update failed:', err));
      }

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
    isLoggingOut = false; // Reset on any new login attempt so the next 401 re-triggers logout
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

  normalizeNodeImageFields: (node = {}) => {
    const imageUrl = node.image360_url || node.image360 || null;
    return {
      ...node,
      image360_url: imageUrl,
      image360: imageUrl,
      has_360_image: !!(imageUrl && String(imageUrl).trim() !== ''),
    };
  },

  refreshNodesCacheFromServer: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.NODES_LIST, { params: { _ts: Date.now() } });
      if (response.data?.success && Array.isArray(response.data.nodes)) {
        const normalizedNodes = response.data.nodes.map(ApiService.normalizeNodeImageFields);
        await OfflineService.saveNodes(normalizedNodes);
      }
    } catch (error) {
      // Do not block mutation success if refresh fails; screens will still reload on focus.
      console.warn('Failed to refresh node cache from server:', error.message);
    }
  },

  // Keep offline cache in sync after admin node mutations so UI immediately reflects image changes.
  syncUpdatedNodeInCache: async (updatedNode) => {
    if (!updatedNode || !updatedNode.node_id) return;

    try {
      const cachedNodes = await OfflineService.getNodes();
      if (!Array.isArray(cachedNodes) || cachedNodes.length === 0) return;
      const normalizedNode = ApiService.normalizeNodeImageFields(updatedNode);
      const updatedNodeId = Number(normalizedNode.node_id);

      const nextNodes = cachedNodes.map((node) => {
        if (Number(node.node_id) !== updatedNodeId) return node;
        return ApiService.normalizeNodeImageFields({ ...node, ...normalizedNode });
      });

      await OfflineService.saveNodes(nextNodes);
    } catch (cacheError) {
      console.warn('Failed to sync updated node in offline cache:', cacheError.message);
    }
  },

  removeDeletedNodeFromCache: async (nodeId) => {
    if (!nodeId) return;

    try {
      const cachedNodes = await OfflineService.getNodes();
      if (!Array.isArray(cachedNodes) || cachedNodes.length === 0) return;

      const nextNodes = cachedNodes.filter((node) => node.node_id !== nodeId);
      await OfflineService.saveNodes(nextNodes);
    } catch (cacheError) {
      console.warn('Failed to remove deleted node from offline cache:', cacheError.message);
    }
  },

  // ============= Admin Node CRUD =============

  /**
   * Create new node
   */
  createNode: async (nodeData) => {
    try {
      const response = await adminApi.post(API_ENDPOINTS.NODE_CREATE, nodeData);
      if (response.data?.success) {
        await ApiService.refreshNodesCacheFromServer();
      }
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
      const response = await adminApi.put(`${API_ENDPOINTS.NODE_UPDATE}${nodeId}/update/`, nodeData);
      if (response.data?.success) {
        if (response.data.node) {
          await ApiService.syncUpdatedNodeInCache(response.data.node);
        } else {
          try {
            const detail = await ApiService.getNodeDetail(nodeId);
            if (detail?.success && detail.node) {
              await ApiService.syncUpdatedNodeInCache(detail.node);
            }
          } catch (detailError) {
            console.warn('Failed to fetch updated node detail for cache sync:', detailError.message);
          }
        }
        await ApiService.refreshNodesCacheFromServer();
      }
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
      const response = await adminApi.delete(`${API_ENDPOINTS.NODE_DELETE}${nodeId}/delete/`);
      if (response.data?.success) {
        await ApiService.removeDeletedNodeFromCache(nodeId);
        await ApiService.refreshNodesCacheFromServer();
      }
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
      const response = await adminApi.post(API_ENDPOINTS.EDGE_CREATE, edgeData);
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
      const response = await adminApi.put(`${API_ENDPOINTS.EDGE_UPDATE}${edgeId}/update/`, edgeData);
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
      const response = await adminApi.delete(`${API_ENDPOINTS.EDGE_DELETE}${edgeId}/delete/`);
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
      const response = await adminApi.post(API_ENDPOINTS.ANNOTATION_CREATE, annotationData);
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
      const response = await adminApi.put(`${API_ENDPOINTS.ANNOTATION_UPDATE}${annotationId}/update/`, annotationData);
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
      const response = await adminApi.delete(`${API_ENDPOINTS.ANNOTATION_DELETE}${annotationId}/delete/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // ============= Event APIs =============

  /**
   * Get active/upcoming events with optional filtering
   * Falls back to offline cache if network unavailable
   */
  getEvents: async (params = {}, options = {}) => {
    const { offlineOnly = false } = options;

    // If offline only mode, use cached data
    if (offlineOnly) {
      const offlineEvents = await OfflineService.getEvents();
      if (offlineEvents) {
        return { success: true, events: offlineEvents, offline: true };
      }
      return { success: false, error: 'No offline data available', offline: true };
    }

    try {
      const response = await api.get(API_ENDPOINTS.EVENTS_LIST, { params });

      // Background sync: Update offline cache if enabled
      OfflineService.isOfflineEnabled().then(async (enabled) => {
        if (enabled && response.data.success) {
          console.log('📥 Background sync: Updating cached events...');
          await OfflineService.saveEvents(response.data.events);
        }
      }).catch(err => console.warn('Background event cache update failed:', err));

      return { ...response.data, offline: false };
    } catch (error) {
      // Check if it's a network error - fallback to offline
      const isNetworkError = !error.response ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ERR_NETWORK' ||
        error.message?.includes('Network Error');

      if (isNetworkError) {
        console.log('Network unavailable, using cached events');
        const offlineEvents = await OfflineService.getEvents();
        if (offlineEvents && offlineEvents.length > 0) {
          return { success: true, events: offlineEvents, offline: true };
        }
      }
      throw error.response?.data || error;
    }
  },

  /**
   * Get event details by ID
   */
  getEventDetail: async (eventId) => {
    try {
      const response = await api.get(`${API_ENDPOINTS.EVENT_DETAIL}${eventId}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Combined search for events and nodes
   * Falls back to offline search if network unavailable
   */
  combinedSearch: async (query, options = {}) => {
    const { offlineOnly = false } = options;

    if (offlineOnly) {
      const results = await OfflineService.combinedSearch(query);
      return { success: true, ...results, offline: true };
    }

    try {
      const response = await api.get(API_ENDPOINTS.EVENTS_SEARCH, { params: { query } });
      return { ...response.data, offline: false };
    } catch (error) {
      const isNetworkError = !error.response ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ERR_NETWORK' ||
        error.message?.includes('Network Error');

      if (isNetworkError) {
        console.log('Network unavailable, using offline combined search');
        const results = await OfflineService.combinedSearch(query);
        return { success: true, ...results, offline: true };
      }
      throw error.response?.data || error;
    }
  },

  // ============= Admin Event CRUD =============

  /**
   * Get all events (admin only)
   */
  getAllEvents: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.EVENTS_ALL);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Create new event (admin only)
   */
  createEvent: async (eventData) => {
    try {
      const response = await adminApi.post(API_ENDPOINTS.EVENT_CREATE, eventData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update existing event (admin only)
   */
  updateEvent: async (eventId, eventData) => {
    try {
      const response = await adminApi.put(`${API_ENDPOINTS.EVENT_UPDATE}${eventId}/update/`, eventData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Delete event (admin only)
   */
  deleteEvent: async (eventId) => {
    try {
      const response = await adminApi.delete(`${API_ENDPOINTS.EVENT_DELETE}${eventId}/delete/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

export default ApiService;
