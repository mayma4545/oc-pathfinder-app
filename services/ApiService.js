import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_ENDPOINTS } from '../config';

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
   */
  getNodes: async (params = {}) => {
    try {
      const response = await api.get(API_ENDPOINTS.NODES_LIST, { params });
      return response.data;
    } catch (error) {
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
   */
  getBuildings: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.BUILDINGS_LIST);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get campus map information
   */
  getCampusMap: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.CAMPUS_MAP);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Find path between two nodes
   */
  findPath: async (startCode, goalCode, avoidStairs = false) => {
    try {
      const response = await api.post(API_ENDPOINTS.FIND_PATH, {
        start_code: startCode,
        goal_code: goalCode,
        avoid_stairs: avoidStairs,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get list of all edges
   */
  getEdges: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.EDGES_LIST);
      return response.data;
    } catch (error) {
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
