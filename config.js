// Configuration for the app
// Update the API_BASE_URL to match your Django backend URL

// IMPORTANT: Replace YOUR_IP with your actual local IP address
// To find your IP: Run 'ipconfig' on Windows and look for IPv4 Address
// export const API_BASE_URL = 'http://192.168.0.8:3000'; // For physical device (Expo Go)
// export const API_BASE_URL = 'https://schizocarpic-tanya-precorrectly.ngrok-free.dev'; // For Android emulator
// export const API_BASE_URL = 'https://prorestoration-enrico-worrisome.ngrok-free.dev'; // For Android emulator
export const API_BASE_URL = 'https://express-path-api.onrender.com'; // For production
// export const API_BASE_URL = 'http://localhost:8000'; // For iOS simulator
// export const API_BASE_URL = 'http://localhost:3000'; // For iOS simulator
// console.log("hi")
export const API_ENDPOINTS = {
  // Public endpoints
  NODES_LIST: '/api/mobile/nodes/',
  NODE_DETAIL: '/api/mobile/nodes/',
  BUILDINGS_LIST: '/api/mobile/buildings/',
  CAMPUS_MAP: '/api/mobile/campus-map/',
  FIND_PATH: '/api/mobile/find-path/',
  EDGES_LIST: '/api/mobile/edges/',
  ANNOTATIONS_LIST: '/api/mobile/annotations/',
  DATA_VERSION: '/api/mobile/data-version/',
  
  // Admin endpoints
  ADMIN_LOGIN: '/api/mobile/admin/login/',
  NODE_CREATE: '/api/mobile/admin/nodes/create/',
  NODE_UPDATE: '/api/mobile/admin/nodes/',
  NODE_DELETE: '/api/mobile/admin/nodes/',
  EDGE_CREATE: '/api/mobile/admin/edges/create/',
  EDGE_UPDATE: '/api/mobile/admin/edges/',
  EDGE_DELETE: '/api/mobile/admin/edges/',
  ANNOTATION_CREATE: '/api/mobile/admin/annotations/create/',
  ANNOTATION_UPDATE: '/api/mobile/admin/annotations/',
  ANNOTATION_DELETE: '/api/mobile/admin/annotations/',
};

export const THEME_COLORS = {
  primary: '#1976D2',
  secondary: '#FFC107',
  accent: '#FF5722',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  error: '#D32F2F',
  success: '#388E3C',
  warning: '#F57C00',
};

export const APP_CONFIG = {
  APP_NAME: 'OC Pathfinder',
  VERSION: '1.0.0',
  ADMIN_SECRET_TAPS: 5, // Number of taps to reveal admin login
};
