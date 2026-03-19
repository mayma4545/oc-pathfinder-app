// Configuration for the app
// Update the API_BASE_URL to match your Django backend URL

// IMPORTANT: Replace YOUR_IP with your actual local IP address
// To find your IP: Run 'ipconfig' on Windows and look for IPv4 Address
// export const API_BASE_URL = 'http://192.168.1.57:3000'; // For physical device (Expo Go)
// export const API_BASE_URL = 'https://schizocarpic-tanya-precorrectly.ngrok-free.dev'; // For Android emulator
// export const API_BASE_URL = 'https://prorestoration-enrico-worrisome.ngrok-free.dev'; // For Android emulator
export const API_BASE_URL = 'https://express-path-api.onrender.com'; // For production
// export const API_BASE_URL = 'http://localhost:8000'; // For iOS simulator
// export const API_BASE_URL = 'http://localhost:3000'; // For iOS simulator
// console.log("hi")
export const API_ENDPOINTS = {
  // Connectivity check — returns { isOnline: true } immediately with no DB hit
  PING: '/api/mobile/ping/',

  // Public endpoints
  NODES_LIST: '/api/mobile/nodes/',
  NODE_DETAIL: '/api/mobile/nodes/',
  BUILDINGS_LIST: '/api/mobile/buildings/',
  CAMPUS_MAP: '/api/mobile/campus-map/',
  FIND_PATH: '/api/mobile/find-path/',
  EDGES_LIST: '/api/mobile/edges/',
  ANNOTATIONS_LIST: '/api/mobile/annotations/',
  DATA_VERSION: '/api/mobile/data-version/',

  // Event endpoints
  EVENTS_LIST: '/api/mobile/events/',
  EVENT_DETAIL: '/api/mobile/events/',
  EVENTS_SEARCH: '/api/mobile/events/search/',

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

  // Admin event endpoints
  EVENTS_ALL: '/api/mobile/admin/events/all/',
  EVENT_CREATE: '/api/mobile/admin/events/create/',
  EVENT_UPDATE: '/api/mobile/admin/events/',
  EVENT_DELETE: '/api/mobile/admin/events/',
};

export const THEME_COLORS = {
  primary: '#800000',        // Maroon
  primaryDark: '#5C0000',    // Dark Maroon (gradients/emphasis)
  primaryLight: '#A52A2A',   // Light Maroon (highlights)
  secondary: '#D4A843',      // Gold (complement to maroon)
  accent: '#C0392B',         // Warm Red
  background: '#F8F5F2',     // Warm Off-White
  surface: '#FFFFFF',        // White
  text: '#2D2D2D',           // Near Black
  textSecondary: '#6B6B6B',  // Medium Gray
  error: '#D32F2F',          // Red
  success: '#2E7D32',        // Green
  warning: '#E65100',        // Deep Orange
};

export const APP_CONFIG = {
  APP_NAME: 'OC Pathfinder',
  VERSION: '1.0.0',
  ADMIN_SECRET_TAPS: 5, // Number of taps to reveal admin login
};

// Event categories
export const EVENT_CATEGORIES = [
  'Academic',
  'Social',
  'Sports',
  'Career',
  'Workshop',
  'Conference',
  'Cultural',
  'Other'
];

// Map assets
export const MAP_ASSETS = {
  DEFAULT_CAMPUS_MAP: 'Mahogany_building.svg',
};

// Map calibration for SVG assets
export const MAP_CALIBRATION = {
  'Mahogany_building.svg': {
    scale: 1.0, // Initial scale
    offsetX: 0, // Initial X offset
    offsetY: 0, // Initial Y offset
    dotSize: 8, // Base dot size
  }
};
