import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
  Animated,
  PanResponder,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Svg, { Line, Circle, Polyline } from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';
import { THEME_COLORS, MAP_CALIBRATION, MAP_ASSETS } from '../config';
import ApiService from '../services/ApiService';
import { getOptimizedImageUrl } from '../utils/ImageOptimizer';
import OfflineService from '../services/OfflineService';
import OfflineModeBadge, { OfflineInfoCard } from '../components/OfflineModeBadge';
import SvgMap from '../components/SvgMap';
import { transformCoordinate } from '../utils/MapCoordinateUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MapDisplayScreen = ({ route, navigation }) => {
  const { startNode, endNode, imageQuality = 'hd', isOffline = false } = route.params;
  const [pathData, setPathData] = useState(null);
  const [campusMap, setCampusMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [show360Modal, setShow360Modal] = useState(false);
  const [current360Node, setCurrent360Node] = useState(null);
  const [current360Index, setCurrent360Index] = useState(0);
  const [hideUI, setHideUI] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Cached image URLs state
  const [cachedImageUrls, setCachedImageUrls] = useState({});
  const [current360ImageUrl, setCurrent360ImageUrl] = useState(null);
  const [campusMapImageUrl, setCampusMapImageUrl] = useState(null);
  
  // Offline mode state
  const [isOfflineMode, setIsOfflineMode] = useState(isOffline);
  const [isOfflineRoute, setIsOfflineRoute] = useState(false);
  const [showOfflineInfo, setShowOfflineInfo] = useState(false);
  const [offlineStats, setOfflineStats] = useState({});
  
  // Map zoom state
  const scale = useRef(new Animated.Value(3)).current;
  const baseScale = useRef(3);
  const [currentZoom, setCurrentZoom] = useState(3); // State to trigger re-render on zoom

  // Map pan state for scrolling when zoomed
  const mapPanX = useRef(new Animated.Value(0)).current;
  const mapPanY = useRef(new Animated.Value(0)).current;
  const lastMapPanX = useRef(0);
  const lastMapPanY = useRef(0);

  // Fullscreen map state
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const fsScale = useRef(new Animated.Value(3)).current;
  const fsBaseScale = useRef(3);
  const [fsCurrentZoom, setFsCurrentZoom] = useState(3);
  const fsPanX = useRef(new Animated.Value(0)).current;
  const fsPanY = useRef(new Animated.Value(0)).current;
  const fsLastPanX = useRef(0);
  const fsLastPanY = useRef(0);
  
  // 360 image pan and zoom state
  const pan360X = useRef(new Animated.Value(0)).current;
  const scale360 = useRef(new Animated.Value(1)).current;
  const [baseScale360, setBaseScale360] = useState(1);
  const lastPanX = useRef(0);
  const compassAngle = useRef(new Animated.Value(0)).current; // Use Animated.Value to avoid re-renders
  const compassAngleValue = useRef(0); // Track actual value for calculations
  
  // Transition animation values
  const transitionScale = useRef(new Animated.Value(1)).current;
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const transitionTranslate = useRef(new Animated.Value(0)).current;

  // Google Street View-style transition overlay
  const [transitionDirection, setTransitionDirection] = useState(1); // 1=forward, -1=backward
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const rippleOpacity1 = useRef(new Animated.Value(0)).current;
  const rippleOpacity2 = useRef(new Animated.Value(0)).current;
  const rippleOpacity3 = useRef(new Animated.Value(0)).current;
  const arrowPulse = useRef(new Animated.Value(1)).current;
  const vignetteOpacity = useRef(new Animated.Value(0)).current;

  // Ref to hold the pre-fetched next image URL so the swap is instant
  const nextImageUrlRef = useRef(null);

  // Start the Street View-style ripple animation
  const startStreetViewTransition = useCallback((dir) => {
    setTransitionDirection(dir);
    // Reset all values
    ripple1.setValue(0); rippleOpacity1.setValue(0.9);
    ripple2.setValue(0); rippleOpacity2.setValue(0);
    ripple3.setValue(0); rippleOpacity3.setValue(0);
    vignetteOpacity.setValue(0);
    arrowPulse.setValue(0.6);

    // Staggered ripple rings
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(ripple1, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(rippleOpacity1, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ripple2, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rippleOpacity2, { toValue: 0.7, duration: 50, useNativeDriver: true }),
          Animated.timing(rippleOpacity2, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(ripple3, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rippleOpacity3, { toValue: 0.5, duration: 50, useNativeDriver: true }),
          Animated.timing(rippleOpacity3, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    // Vignette pulse
    Animated.sequence([
      Animated.timing(vignetteOpacity, { toValue: 0.7, duration: 200, useNativeDriver: true }),
      Animated.timing(vignetteOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Arrow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowPulse, { toValue: 1.3, duration: 200, useNativeDriver: true }),
        Animated.timing(arrowPulse, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    ).start();
  }, [ripple1, ripple2, ripple3, rippleOpacity1, rippleOpacity2, rippleOpacity3, arrowPulse, vignetteOpacity]);

  // Helper function to check if node has 360 image (handles both property names)
  const hasImage360 = useCallback((node) => {
    return !!(node && (node.image360 || node.image360_url));
  }, []);

  useEffect(() => {
    loadPathAndMap();
  }, []);

  // Load cached image URL when current360Node changes
  useEffect(() => {
    if (!current360Node || !current360Node.image360) return;
    
    let isMounted = true;
    
    getImageUrlWithCache(current360Node).then((cachedUrl) => {
      if (!isMounted) return;
      setCurrent360ImageUrl(cachedUrl);
      
      // Trigger predictive caching for neighbors
      if (OfflineService?.predictiveCache) {
        setTimeout(() => {
          if (isMounted) OfflineService.predictiveCache(current360Node.node_id);
        }, 1500);
      }
    }).catch((error) => {
      console.error('Error loading 360 image:', error);
    });
    
    return () => { isMounted = false; };
  }, [current360Node?.node_id]);

  // Update campus map URL when quality setting changes
  useEffect(() => {
    const updateCampusMapUrl = async () => {
      if (campusMap && campusMap.image_url) {
        const cachedMapUrl = await getCampusMapImageUrlWithCache(campusMap.image_url);
        setCampusMapImageUrl(cachedMapUrl);
      }
    };
    updateCampusMapUrl();
  }, [campusMap?.image_url, imageQuality]);

  // Helper function to get image URL with offline cache support
  const getImageUrlWithCache = async (node) => {
    if (!node) return null;
    
    // Handle both property names: image360 and image360_url
    const remoteImageUrl = node.image360 || node.image360_url;
    if (!remoteImageUrl) return null;
    
    try {
      console.log(`Getting image for node ${node.node_id}...`);
      
      // Always check for cached version first (even when online)
      const cachedUrl = await OfflineService.getImageUrl({
        node_id: node.node_id,
        image360: remoteImageUrl,
        image360_url: remoteImageUrl,
      });
      
      // If we have a cached local file, ALWAYS use it (even when online)
      if (cachedUrl && cachedUrl.startsWith('file://')) {
        console.log(`✅ Using cached image for node ${node.node_id}`);
        return cachedUrl;
      }
      
      // Only use Cloudinary/remote if no cached version exists
      console.log(`🌐 Using remote image for node ${node.node_id}`);
      return getOptimizedImageUrl(remoteImageUrl, imageQuality);
    } catch (error) {
      console.error('Error getting cached image URL:', error);
      return getOptimizedImageUrl(remoteImageUrl, imageQuality);
    }
  };

  // Helper function to get campus map image URL with cache priority
  const getCampusMapImageUrlWithCache = async (mapImageUrl) => {
    if (!mapImageUrl) return null;
    
    try {
      const mapId = campusMap?.id || 'main';
      // Always check for cached version first (even when online)
      const cachedUrl = await OfflineService.getCampusMapImageUrl(mapImageUrl, mapId);
      
      // If we have a cached local file, ALWAYS use it (even when online)
      if (cachedUrl && cachedUrl.startsWith('file://')) {
        return cachedUrl;
      }
      
      // Only use Cloudinary if no cached version exists
      return getOptimizedImageUrl(mapImageUrl, imageQuality);
    } catch (error) {
      console.error('Error getting cached map image URL:', error);
      return getOptimizedImageUrl(mapImageUrl, imageQuality);
    }
  };

  // Pan responder for 360° image - seamless loop version (OPTIMIZED)
  const panResponder360 = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan360X.setOffset(lastPanX.current);
        pan360X.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Add sensitivity multiplier (4x for faster response)
        const sensitivity = 4;
        const dx = gestureState.dx * sensitivity;
        
        // Update pan animation (runs on native thread - very fast)
        pan360X.setValue(dx);
        
        // Calculate compass angle based on pan (no throttling needed - just updates ref)
        const imageWidth = SCREEN_HEIGHT * 6;
        const totalOffset = lastPanX.current + dx;
        let wrappedOffset = totalOffset % imageWidth;
        const angle = (-wrappedOffset / imageWidth) * 360;
        let newAngle = angle;
        
        // Normalize to 0-360
        while (newAngle < 0) newAngle += 360;
        while (newAngle >= 360) newAngle -= 360;
        
        // Update Animated.Value and ref (NO setState, NO re-renders)
        compassAngle.setValue(newAngle);
        compassAngleValue.current = newAngle;
      },
      onPanResponderRelease: (_, gestureState) => {
        const sensitivity = 4;
        const imageWidth = SCREEN_HEIGHT * 6;
        lastPanX.current += (gestureState.dx * sensitivity);
        
        // Wrap position to middle image for seamless looping
        if (lastPanX.current > imageWidth / 2) {
          lastPanX.current -= imageWidth;
          pan360X.setOffset(lastPanX.current);
        } else if (lastPanX.current < -imageWidth / 2) {
          lastPanX.current += imageWidth;
          pan360X.setOffset(lastPanX.current);
        }
        
        pan360X.flattenOffset();
      },
      onPanResponderTerminate: () => {
        pan360X.flattenOffset();
      },
    })
  , [pan360X]);

  // Pinch gesture for 360° image zoom
  const onPinch360Event = Animated.event(
    [{ nativeEvent: { scale: scale360 } }],
    { useNativeDriver: false }
  );

  const onPinch360StateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      let newScale = baseScale360 * event.nativeEvent.scale;
      // Limit zoom between 0.8x and 5x
      newScale = Math.min(Math.max(newScale, 0.8), 5);
      setBaseScale360(newScale);
      scale360.setValue(newScale);
    }
  };

  const zoomIn360 = () => {
    const newScale = Math.min(baseScale360 + 0.5, 5);
    setBaseScale360(newScale);
    Animated.spring(scale360, {
      toValue: newScale,
      useNativeDriver: false,
      friction: 7,
    }).start();
  };

  const zoomOut360 = () => {
    const newScale = Math.max(baseScale360 - 0.2, 0.8);
    setBaseScale360(newScale);
    Animated.spring(scale360, {
      toValue: newScale,
      useNativeDriver: false,
      friction: 7,
    }).start();
  };

  const resetZoom360 = () => {
    setBaseScale360(1);
    Animated.spring(scale360, {
      toValue: 1,
      useNativeDriver: false,
      friction: 7,
    }).start();
  };

  // Pan responder for map scrolling when zoomed
  const mapPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => baseScale.current > 1,
      onMoveShouldSetPanResponder: () => baseScale.current > 1,
      onPanResponderGrant: () => {
        mapPanX.setOffset(lastMapPanX.current);
        mapPanY.setOffset(lastMapPanY.current);
        mapPanX.setValue(0);
        mapPanY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Map is square (SCREEN_WIDTH - 60), use same bound for both axes
        const mapSize = SCREEN_WIDTH - 60;
        const maxPan = (mapSize * (baseScale.current - 1)) / 2;
        const newX = Math.max(-maxPan, Math.min(maxPan, lastMapPanX.current + gestureState.dx));
        const newY = Math.max(-maxPan, Math.min(maxPan, lastMapPanY.current + gestureState.dy));
        mapPanX.setValue(newX - lastMapPanX.current);
        mapPanY.setValue(newY - lastMapPanY.current);
      },
      onPanResponderRelease: (_, gestureState) => {
        const mapSize = SCREEN_WIDTH - 60;
        const maxPan = (mapSize * (baseScale.current - 1)) / 2;
        lastMapPanX.current = Math.max(-maxPan, Math.min(maxPan, lastMapPanX.current + gestureState.dx));
        lastMapPanY.current = Math.max(-maxPan, Math.min(maxPan, lastMapPanY.current + gestureState.dy));
        
        mapPanX.flattenOffset();
        mapPanY.flattenOffset();
        mapPanX.setValue(lastMapPanX.current);
        mapPanY.setValue(lastMapPanY.current);
      },
    })
  ).current;

  // Pinch gesture for map zoom
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: false }
  );

  const onPinchStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      baseScale.current *= event.nativeEvent.scale;
      // Limit zoom between 1x and 4x
      baseScale.current = Math.min(Math.max(baseScale.current, 1), 4);
      scale.setValue(baseScale.current);
      setCurrentZoom(baseScale.current); // Update state for dot re-render
      
      // Reset pan position if zoomed back to 1x
      if (baseScale.current === 1) {
        lastMapPanX.current = 0;
        lastMapPanY.current = 0;
        mapPanX.setValue(0);
        mapPanY.setValue(0);
      } else {
        // Constrain pan within new bounds (map is square: SCREEN_WIDTH - 60)
        const mapSize = SCREEN_WIDTH - 60;
        const maxPan = (mapSize * (baseScale.current - 1)) / 2;
        lastMapPanX.current = Math.max(-maxPan, Math.min(maxPan, lastMapPanX.current));
        lastMapPanY.current = Math.max(-maxPan, Math.min(maxPan, lastMapPanY.current));
        mapPanX.setValue(lastMapPanX.current);
        mapPanY.setValue(lastMapPanY.current);
      }
    }
  };
  
  const resetMapZoom = () => {
    baseScale.current = 3;
    scale.setValue(3);
    setCurrentZoom(3);
    const calibration = MAP_CALIBRATION[MAP_ASSETS.DEFAULT_CAMPUS_MAP] || { scale: 1, offsetX: 0, offsetY: 0 };
    const firstNode = pathData?.path?.find(n => n.map_x !== null && n.map_y !== null);
    if (firstNode && mapDimensions.width) {
      const pt = transformCoordinate({ x: firstNode.map_x, y: firstNode.map_y }, calibration);
      const dotX = (pt.x / 100) * mapDimensions.width;
      const dotY = (pt.y / 100) * mapDimensions.height;
      const mapSize = mapDimensions.width;
      const maxPan = (mapSize * 2) / 2;
      const px = Math.max(-maxPan, Math.min(maxPan, -(dotX - mapSize / 2) * 3));
      const py = Math.max(-maxPan, Math.min(maxPan, -(dotY - mapSize / 2) * 3));
      lastMapPanX.current = px;
      lastMapPanY.current = py;
      mapPanX.setValue(px);
      mapPanY.setValue(py);
    } else {
      lastMapPanX.current = 0;
      lastMapPanY.current = 0;
      mapPanX.setValue(0);
      mapPanY.setValue(0);
    }
  };

  // Helper: compute pan offsets to center a dot at (dotX, dotY) within a square map of mapSize at zoomLevel
  const computeCenterPan = useCallback((dotX, dotY, mapSize, zoomLevel) => {
    const maxPan = (mapSize * (zoomLevel - 1)) / 2;
    return {
      panX: Math.max(-maxPan, Math.min(maxPan, -(dotX - mapSize / 2) * zoomLevel)),
      panY: Math.max(-maxPan, Math.min(maxPan, -(dotY - mapSize / 2) * zoomLevel)),
    };
  }, []);

  // Auto-center on start node when path data and map dimensions become ready
  useEffect(() => {
    if (!pathData?.path || !mapDimensions.width) return;
    const calibration = MAP_CALIBRATION[MAP_ASSETS.DEFAULT_CAMPUS_MAP] || { scale: 1, offsetX: 0, offsetY: 0 };
    const firstNode = pathData.path.find(n => n.map_x !== null && n.map_y !== null);
    if (!firstNode) return;
    const pt = transformCoordinate({ x: firstNode.map_x, y: firstNode.map_y }, calibration);
    const dotX = (pt.x / 100) * mapDimensions.width;
    const dotY = (pt.y / 100) * mapDimensions.height;
    const { panX: px, panY: py } = computeCenterPan(dotX, dotY, mapDimensions.width, 3);
    lastMapPanX.current = px;
    lastMapPanY.current = py;
    mapPanX.setValue(px);
    mapPanY.setValue(py);
  }, [pathData, mapDimensions.width]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen map: pan responder
  const fsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        fsPanX.setOffset(fsLastPanX.current);
        fsPanY.setOffset(fsLastPanY.current);
        fsPanX.setValue(0);
        fsPanY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const maxPan = (SCREEN_WIDTH * (fsBaseScale.current - 1)) / 2;
        const newX = Math.max(-maxPan, Math.min(maxPan, fsLastPanX.current + gestureState.dx));
        const newY = Math.max(-maxPan, Math.min(maxPan, fsLastPanY.current + gestureState.dy));
        fsPanX.setValue(newX - fsLastPanX.current);
        fsPanY.setValue(newY - fsLastPanY.current);
      },
      onPanResponderRelease: (_, gestureState) => {
        const maxPan = (SCREEN_WIDTH * (fsBaseScale.current - 1)) / 2;
        fsLastPanX.current = Math.max(-maxPan, Math.min(maxPan, fsLastPanX.current + gestureState.dx));
        fsLastPanY.current = Math.max(-maxPan, Math.min(maxPan, fsLastPanY.current + gestureState.dy));
        fsPanX.flattenOffset();
        fsPanY.flattenOffset();
        fsPanX.setValue(fsLastPanX.current);
        fsPanY.setValue(fsLastPanY.current);
      },
    })
  ).current;

  const onFsPinchEvent = Animated.event(
    [{ nativeEvent: { scale: fsScale } }],
    { useNativeDriver: false }
  );

  const onFsPinchStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      fsBaseScale.current = Math.min(Math.max(fsBaseScale.current * event.nativeEvent.scale, 1), 6);
      fsScale.setValue(fsBaseScale.current);
      setFsCurrentZoom(fsBaseScale.current);
      if (fsBaseScale.current <= 1) {
        fsLastPanX.current = 0;
        fsLastPanY.current = 0;
        fsPanX.setValue(0);
        fsPanY.setValue(0);
      } else {
        const maxPan = (SCREEN_WIDTH * (fsBaseScale.current - 1)) / 2;
        fsLastPanX.current = Math.max(-maxPan, Math.min(maxPan, fsLastPanX.current));
        fsLastPanY.current = Math.max(-maxPan, Math.min(maxPan, fsLastPanY.current));
        fsPanX.setValue(fsLastPanX.current);
        fsPanY.setValue(fsLastPanY.current);
      }
    }
  };

  const openFullscreenMap = () => {
    const calibration = MAP_CALIBRATION[MAP_ASSETS.DEFAULT_CAMPUS_MAP] || { scale: 1, offsetX: 0, offsetY: 0 };
    const firstNode = pathData?.path?.find(n => n.map_x !== null && n.map_y !== null);
    fsBaseScale.current = 3;
    fsScale.setValue(3);
    setFsCurrentZoom(3);
    if (firstNode) {
      const pt = transformCoordinate({ x: firstNode.map_x, y: firstNode.map_y }, calibration);
      const dotX = (pt.x / 100) * SCREEN_WIDTH;
      const dotY = (pt.y / 100) * SCREEN_WIDTH;
      const { panX: px, panY: py } = computeCenterPan(dotX, dotY, SCREEN_WIDTH, 3);
      fsLastPanX.current = px;
      fsLastPanY.current = py;
      fsPanX.setValue(px);
      fsPanY.setValue(py);
    } else {
      fsLastPanX.current = 0;
      fsLastPanY.current = 0;
      fsPanX.setValue(0);
      fsPanY.setValue(0);
    }
    setShowFullscreenMap(true);
  };

  const resetFullscreenMap = () => {
    const calibration = MAP_CALIBRATION[MAP_ASSETS.DEFAULT_CAMPUS_MAP] || { scale: 1, offsetX: 0, offsetY: 0 };
    const firstNode = pathData?.path?.find(n => n.map_x !== null && n.map_y !== null);
    fsBaseScale.current = 3;
    fsScale.setValue(3);
    setFsCurrentZoom(3);
    if (firstNode) {
      const pt = transformCoordinate({ x: firstNode.map_x, y: firstNode.map_y }, calibration);
      const dotX = (pt.x / 100) * SCREEN_WIDTH;
      const dotY = (pt.y / 100) * SCREEN_WIDTH;
      const { panX: px, panY: py } = computeCenterPan(dotX, dotY, SCREEN_WIDTH, 3);
      fsLastPanX.current = px;
      fsLastPanY.current = py;
      fsPanX.setValue(px);
      fsPanY.setValue(py);
    } else {
      fsLastPanX.current = 0;
      fsLastPanY.current = 0;
      fsPanX.setValue(0);
      fsPanY.setValue(0);
    }
  };

  const loadPathAndMap = async () => {
    try {
      setLoading(true);

      console.log('=== MapDisplayScreen: Loading Path ===');
      console.log('Start Node:', startNode.node_code);
      console.log('End Node:', endNode.node_code);
      console.log('Is Offline Mode:', isOfflineMode);

      // Load path - use offlineOnly if user explicitly chose offline mode
      const pathResponse = await ApiService.findPath(
        startNode.node_code,
        endNode.node_code,
        false,
        { offlineOnly: isOfflineMode }
      );

      console.log('Path Response:', {
        success: pathResponse.success,
        offline: pathResponse.offline,
        error: pathResponse.error,
        pathLength: pathResponse.path?.length
      });

      if (!pathResponse.success) {
        const errorMessage = pathResponse.error || 'Failed to find path';
        const wasOfflineAttempt = pathResponse.offline || isOfflineMode;
        
        let displayMessage = errorMessage;
        
        // If it was an offline attempt and data is missing, provide helpful guidance
        if (wasOfflineAttempt && !pathResponse.hasOfflineData) {
          displayMessage = errorMessage; // Already includes download instruction
        }
        
        Alert.alert(
          'Path Finding Error',
          displayMessage,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        navigation.goBack();
        return;
      }

      setPathData(pathResponse);
      
      // Track if this was an offline route
      if (pathResponse.offline || isOfflineMode) {
        setIsOfflineRoute(true);
        // Get offline stats for the info card
        const stats = await OfflineService.getOfflineStats();
        setOfflineStats(stats);
      }

      // Load campus map
      const mapResponse = await ApiService.getCampusMap();
      if (mapResponse.success) {
        setCampusMap(mapResponse.map);
        
        // Load cached campus map image URL
        const cachedMapUrl = await getCampusMapImageUrlWithCache(mapResponse.map.image_url);
        setCampusMapImageUrl(cachedMapUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load path. Please try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleNodePress = (node) => {
    // If node has 360° image, open 360 view directly
    if (hasImage360(node)) {
      handleView360(node);
    } else {
      // Otherwise show node info
      setSelectedNode(node);
    }
  };

  const handleView360 = (node = null, index = 0) => {
    const nodesWithImages = pathData?.path?.filter((n) => hasImage360(n)) || [];
    
    if (nodesWithImages.length === 0) {
      Alert.alert('Not Available', 'No 360° images available for this route');
      return;
    }
    
    let targetNode;
    let targetIndex;
    
    if (node) {
      targetNode = node;
      const nodeIndex = nodesWithImages.findIndex(n => n.node_id === node.node_id);
      targetIndex = nodeIndex >= 0 ? nodeIndex : 0;
    } else {
      targetNode = nodesWithImages[index];
      targetIndex = index;
    }
    
    setCurrent360Node(targetNode);
    setCurrent360Index(targetIndex);
    
    // Initialize view to the node's annotation angle (where the room faces in the 360° image)
    // Fall back to the next-node compass direction if annotation is not set
    let initialAngle = 0;
    
    if (targetNode.annotation !== null && targetNode.annotation !== undefined) {
      initialAngle = targetNode.annotation;
      console.log('🧭 Initial view angle from annotation:', initialAngle, '° -', targetNode.name);
    } else {
      const fullPathIndex = pathData.path.findIndex(n => n.node_id === targetNode.node_id);
      if (fullPathIndex >= 0 && fullPathIndex < pathData.path.length - 1) {
        const nextNode = pathData.path[fullPathIndex + 1];
        if (nextNode.compass_angle !== null && nextNode.compass_angle !== undefined) {
          initialAngle = nextNode.compass_angle;
          console.log('🧭 Initial view angle from compass_angle:', initialAngle, '° - Next node:', nextNode.name);
        }
      }
    }
    
    // Calculate pan offset for the initial angle
    const imageWidth = SCREEN_HEIGHT * 6;
    const initialOffset = -(initialAngle / 360) * imageWidth;
    
    console.log('📐 Image width:', imageWidth, 'Initial offset:', initialOffset);
    
    compassAngle.setValue(initialAngle);
    compassAngleValue.current = initialAngle;
    pan360X.setValue(initialOffset);
    lastPanX.current = initialOffset;
    scale360.setValue(1);
    setBaseScale360(1);
    setShow360Modal(true);
  };

  const navigate360 = (direction) => {
    if (isTransitioning) return;

    const nodesWithImages = pathData?.path?.filter((n) => hasImage360(n)) || [];
    let newIndex = current360Index + direction;
    if (newIndex < 0) newIndex = nodesWithImages.length - 1;
    if (newIndex >= nodesWithImages.length) newIndex = 0;

    const targetNode = nodesWithImages[newIndex];
    setIsTransitioning(true);

    // Start Street View-style overlay animation immediately on click
    startStreetViewTransition(direction);

    // === Phase 1 (parallel): zoom-into-horizon exit + fetch next image ===
    // Forward: image zooms in fast (like walking into the scene)
    // Backward: image zooms out fast
    const exitScale = direction > 0 ? 1.8 : 0.5;
    const fadeOutPromise = new Promise((resolve) => {
      Animated.parallel([
        Animated.timing(transitionScale, {
          toValue: exitScale,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(transitionOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

    const fetchNextImagePromise = getImageUrlWithCache(targetNode);

    // === Phase 2: wait for both, then swap while invisible ===
    Promise.all([fadeOutPromise, fetchNextImagePromise]).then(([, nextUrl]) => {
      nextImageUrlRef.current = nextUrl;

      // Determine initial view angle for the new node
      let initialAngle = 0;
      if (targetNode.annotation !== null && targetNode.annotation !== undefined) {
        initialAngle = targetNode.annotation;
      } else {
        const fullPathIndex = pathData.path.findIndex(n => n.node_id === targetNode.node_id);
        if (fullPathIndex >= 0 && fullPathIndex < pathData.path.length - 1) {
          const nextNode = pathData.path[fullPathIndex + 1];
          if (nextNode.compass_angle !== null && nextNode.compass_angle !== undefined) {
            initialAngle = nextNode.compass_angle;
          }
        }
      }

      const imageWidth = SCREEN_HEIGHT * 6;
      const initialOffset = -(initialAngle / 360) * imageWidth;
      compassAngle.setValue(initialAngle);
      compassAngleValue.current = initialAngle;
      pan360X.setValue(initialOffset);
      lastPanX.current = initialOffset;
      scale360.setValue(1);
      setBaseScale360(1);

      // New image enters from opposite zoom direction
      // Forward: starts slightly zoomed in (from far away), zooms back to 1
      // Backward: starts slightly zoomed out (from wide), zooms to 1
      const enterScale = direction > 0 ? 0.6 : 1.5;
      transitionScale.setValue(enterScale);
      transitionOpacity.setValue(0);
      transitionTranslate.setValue(0);

      // Swap the node + image (still invisible)
      setCurrent360Index(newIndex);
      setCurrent360Node(targetNode);
      setCurrent360ImageUrl(nextUrl);

      // === Phase 3: fade in the new image (zoom-in from distance feel) ===
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(transitionScale, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(transitionOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsTransitioning(false);
        });
      }, 16);
    });
  };

  const getCompassDirection = useCallback((angle) => {
    if (angle >= 337.5 || angle < 22.5) return 'N';
    if (angle >= 22.5 && angle < 67.5) return 'NE';
    if (angle >= 67.5 && angle < 112.5) return 'E';
    if (angle >= 112.5 && angle < 157.5) return 'SE';
    if (angle >= 157.5 && angle < 202.5) return 'S';
    if (angle >= 202.5 && angle < 247.5) return 'SW';
    if (angle >= 247.5 && angle < 292.5) return 'W';
    if (angle >= 292.5 && angle < 337.5) return 'NW';
    return 'N';
  }, []);

  // Memoize direction markers to avoid recalculation on every render
  const directionMarkers = useMemo(() => {
    if (!pathData?.path || !current360Node) return [];
    
    const markers = [];
    const nodesWithImages = pathData.path.filter((n) => hasImage360(n));
    const currentIndex = pathData.path.findIndex(n => n.node_id === current360Node.node_id);
    
    // Check if there's a next node (where we need to go)
    if (currentIndex >= 0 && currentIndex < pathData.path.length - 1) {
      const nextNode = pathData.path[currentIndex + 1];
      if (nextNode.compass_angle !== null && nextNode.compass_angle !== undefined) {
        // Find index in nodes with images
        const targetImageIndex = nodesWithImages.findIndex(n => n.node_id === nextNode.node_id);
        markers.push({
          angle: nextNode.compass_angle,
          label: 'Go This Way',
          subLabel: `${nextNode.distance_from_prev}m to ${nextNode.name}`,
          isNext: true,
          isStaircase: nextNode.is_staircase,
          targetNode: nextNode,
          targetImageIndex: targetImageIndex
        });
      }
    }
    
    // Check if there's a previous node (where we came from)
    if (currentIndex > 0) {
      const prevNode = pathData.path[currentIndex];
      const prevNodeData = pathData.path[currentIndex - 1];
      if (prevNode.compass_angle !== null && prevNode.compass_angle !== undefined) {
        // Reverse direction (add 180 degrees)
        const reverseAngle = (prevNode.compass_angle + 180) % 360;
        // Find index in nodes with images
        const targetImageIndex = nodesWithImages.findIndex(n => n.node_id === prevNodeData.node_id);
        markers.push({
          angle: reverseAngle,
          label: 'Back',
          subLabel: prevNodeData.name,
          isNext: false,
          isStaircase: prevNode.is_staircase,
          targetNode: prevNodeData,
          targetImageIndex: targetImageIndex
        });
      }
    }
    
    return markers;
  }, [pathData?.path, current360Node?.node_id, hasImage360]);

  // Calculate marker position based on compass angle and current view angle
  const calculateMarkerPosition = useCallback((markerAngle) => {
    // markerAngle: 0° = North (left edge of image)
    // compassAngle: current view angle (0° = looking at North/left edge)
    
    // Calculate relative angle from current view
    let relativeAngle = markerAngle - compassAngleValue.current;
    
    // Normalize to -180 to 180 range
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;
    
    // Field of view is approximately 60 degrees (narrower view)
    const fieldOfView = 60;
    const halfFOV = fieldOfView / 2;
    
    // Check if marker is in view (within field of view)
    const isInView = Math.abs(relativeAngle) <= halfFOV;
    
    // Check if marker is aligned (within ±5 degrees from center)
    const isAligned = Math.abs(relativeAngle) <= 5;
    
    // Convert to horizontal position (-1 to 1, where 0 is center)
    // relativeAngle of 0 means marker is at center
    // relativeAngle of +halfFOV means marker is at right edge
    // relativeAngle of -halfFOV means marker is at left edge
    const normalizedPosition = relativeAngle / halfFOV; // -1 to 1
    
    return { isInView, isAligned, normalizedPosition, relativeAngle };
  }, []);

  const renderPathOverlay = (dims, zoom) => {
    const _dims = dims || mapDimensions;
    const _zoom = zoom != null ? zoom : currentZoom;
    if (!pathData || !pathData.path || !_dims.width) return null;

    const calibration = MAP_CALIBRATION[MAP_ASSETS.DEFAULT_CAMPUS_MAP] || { scale: 1, offsetX: 0, offsetY: 0 };

    const points = pathData.path
      .filter((node) => node.map_x !== null && node.map_y !== null)
      .map((node) => {
        const point = { x: node.map_x, y: node.map_y };
        const transformed = transformCoordinate(point, calibration);
        return {
          x: (transformed.x / 100) * _dims.width,
          y: (transformed.y / 100) * _dims.height,
          ...node,
        };
      });

    if (points.length === 0) return null;

    const pathString = points.map((p) => `${p.x},${p.y}`).join(' ');

    const baseRadius = 10;
    const baseStroke = 3;
    const baseLineWidth = 4;
    const dotRadius = Math.max(4, baseRadius / _zoom);
    const strokeWidth = Math.max(1, baseStroke / _zoom);
    const lineWidth = Math.max(2, baseLineWidth / _zoom);

    return (
      <Svg
        style={StyleSheet.absoluteFill}
        width={_dims.width}
        height={_dims.height}
      >
        {/* Draw path line */}
        <Polyline
          points={pathString}
          fill="none"
          stroke={THEME_COLORS.primary}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Draw nodes */}
        {points.map((point, index) => {
          const isStart = index === 0;
          const isEnd = index === points.length - 1;
          const has360 = hasImage360(point);

          let fillColor = THEME_COLORS.primary;
          if (isStart) fillColor = '#4CAF50';
          else if (isEnd) fillColor = '#F44336';
          else if (has360) fillColor = '#FF9800';

          return (
            <React.Fragment key={index}>
              {has360 && (
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={dotRadius + 4 / _zoom}
                  fill="rgba(255, 152, 0, 0.3)"
                  stroke="none"
                />
              )}
              <Circle
                cx={point.x}
                cy={point.y}
                r={dotRadius}
                fill={fillColor}
                stroke="#FFFFFF"
                strokeWidth={strokeWidth}
                onPress={() => handleNodePress(point)}
              />
              {has360 && _zoom >= 1.5 && (
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={dotRadius * 0.4}
                  fill="#FFFFFF"
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text style={styles.loadingText}>Finding your path...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Route Map</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Offline Mode Banner */}
        {isOfflineMode && (
          <View style={styles.offlineModeBanner}>
            <Text style={styles.offlineModeText}>
              📴 Offline Mode - Using cached data
            </Text>
          </View>
        )}

      <ScrollView style={styles.content}>
        {/* Route Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>From</Text>
              <Text style={styles.infoValue}>{startNode.name}</Text>
              <Text style={styles.infoSubtext}>{startNode.building}</Text>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>To</Text>
              <Text style={styles.infoValue}>{endNode.name}</Text>
              <Text style={styles.infoSubtext}>{endNode.building}</Text>
            </View>
          </View>
          
          {pathData && (
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{pathData.total_distance}m</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{pathData.num_nodes}</Text>
                <Text style={styles.statLabel}>Stops</Text>
              </View>
              {isOfflineRoute && (
                <OfflineModeBadge 
                  isOffline={true}
                  onPress={() => setShowOfflineInfo(true)}
                  style={{ marginLeft: 10 }}
                />
              )}
            </View>
          )}
          
          {/* Offline Info Card */}
          <OfflineInfoCard
            isVisible={showOfflineInfo}
            lastSync={offlineStats.lastSync}
            nodesCount={offlineStats.nodesCount}
            edgesCount={offlineStats.edgesCount}
            onDismiss={() => setShowOfflineInfo(false)}
          />
        </View>

        {/* Campus Map with Route */}
        {campusMap && (
          <View style={styles.mapContainer}>
            <View style={styles.mapTitleRow}>
              <Text style={styles.sectionTitle}>Campus Map</Text>
              <View style={styles.mapTitleActions}>
                <TouchableOpacity style={styles.resetZoomButton} onPress={resetMapZoom}>
                  <Text style={styles.resetZoomText}>⟲ Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fullscreenButton} onPress={openFullscreenMap}>
                  <Text style={styles.fullscreenButtonText}>⛶ Fullscreen</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.mapHint}>Pinch to zoom • Drag to pan • Tap ⛶ for fullscreen</Text>
            <View style={styles.mapClipContainer}>
              <PinchGestureHandler
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={onPinchStateChange}
              >
                <Animated.View
                  style={[
                    styles.mapWrapper,
                    {
                      transform: [
                        { translateX: mapPanX },
                        { translateY: mapPanY },
                        { scale: scale },
                      ],
                    },
                  ]}
                  {...mapPanResponder.panHandlers}
                >
                  <SvgMap
                    width={mapDimensions.width || SCREEN_WIDTH - 60}
                    height={mapDimensions.height || SCREEN_WIDTH - 60}
                    onLayout={(event) => {
                      const { width, height } = event.nativeEvent.layout;
                      setMapDimensions({ width, height });
                    }}
                  />
                  {renderPathOverlay()}
                </Animated.View>
              </PinchGestureHandler>
            </View>
            
            {/* Map Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>Start</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                <Text style={styles.legendText}>End</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.legendText}>360° View</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: THEME_COLORS.primary }]} />
                <Text style={styles.legendText}>Waypoint</Text>
              </View>
            </View>
          </View>
        )}

        {/* Turn-by-Turn Directions */}
        {pathData && pathData.directions && (
          <View style={styles.directionsContainer}>
            <Text style={styles.sectionTitle}>Directions</Text>
            {pathData.directions.map((direction, index) => (
              <View key={index} style={styles.directionItem}>
                <View style={styles.directionNumber}>
                  <Text style={styles.directionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.directionText}>{direction}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 360 View Button */}
        {pathData && pathData.path && pathData.path.some(node => hasImage360(node)) && (
          <TouchableOpacity
            style={styles.view360Button}
            onPress={() => handleView360()}
          >
            <Text style={styles.view360ButtonText}>📷 View 360° Street View</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Selected Node Info */}
      {selectedNode && (
        <View style={styles.nodeInfoOverlay}>
          <View style={styles.nodeInfoCard}>
            <Text style={styles.nodeInfoName}>{selectedNode.name}</Text>
            <Text style={styles.nodeInfoDetails}>
              {selectedNode.building} • Floor {selectedNode.floor_level}
            </Text>
            {hasImage360(selectedNode) && (
              <TouchableOpacity
                style={styles.view360SmallButton}
                onPress={() => handleView360(selectedNode)}
              >
                <Text style={styles.view360SmallButtonText}>View 360°</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeNodeInfo}
              onPress={() => setSelectedNode(null)}
            >
              <Text style={styles.closeNodeInfoText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 360 Images Modal - Fullscreen Interactive Viewer */}
      <Modal
        visible={show360Modal}
        animationType="fade"
        onRequestClose={() => setShow360Modal(false)}
        statusBarTranslucent
      >
        <View style={styles.modal360Fullscreen}>
          {current360Node && (
            <>
              {/* 360° Image with Pan Gestures - OPTIMIZED STRUCTURE */}
              <View style={{ flex: 1 }} {...panResponder360.panHandlers}>
                {/* Optimized: Flattened structure with combined transforms */}
                <Animated.View
                  style={[
                    styles.image360Container,
                    {
                      transform: [
                        { translateX: pan360X },
                        { scale: Animated.multiply(scale360, transitionScale) },
                        { translateY: transitionTranslate },
                      ],
                      opacity: transitionOpacity,
                    },
                  ]}
                >
                  {/* Left copy for seamless wrapping */}
                  <Image360Part 
                    nodeId={current360Node.node_id}
                    imageUrl={current360ImageUrl || getOptimizedImageUrl(current360Node.image360, imageQuality)}
                    quality={imageQuality}
                    position="left"
                  />
                  {/* Center (main) image */}
                  <Image360Part 
                    nodeId={current360Node.node_id}
                    imageUrl={current360ImageUrl || getOptimizedImageUrl(current360Node.image360, imageQuality)}
                    quality={imageQuality}
                    position="center"
                  />
                  {/* Right copy for seamless wrapping */}
                  <Image360Part 
                    nodeId={current360Node.node_id}
                    imageUrl={current360ImageUrl || getOptimizedImageUrl(current360Node.image360, imageQuality)}
                    quality={imageQuality}
                    position="right"
                  />
                </Animated.View>
              </View>

              {/* Fixed Direction Markers Overlay */}
              <Animated.View 
                style={[
                  styles.markersOverlay,
                  {
                    transform: [{ translateX: pan360X }]
                  }
                ]} 
                pointerEvents="box-none"
              >
                {directionMarkers.map((marker, index) => {
                  // Calculate marker position based on marker's absolute angle in the 360 image
                  // The 360° image width = SCREEN_HEIGHT * 6 represents full 360°
                  const imageWidth = SCREEN_HEIGHT * 6;
                  
                  // Calculate marker position based on angle
                  // When viewing angle 0°, we want the marker at 0° to appear at the CENTER of the screen
                  // The image left edge (position 0) corresponds to 0°
                  // When pan360X = 0 (viewing 0°), screen center is at SCREEN_WIDTH/2
                  // So marker at angle A should be at position: (A / 360) * imageWidth + SCREEN_WIDTH/2
                  const markerAnglePosition = (marker.angle / 360) * imageWidth;
                  const markerPositionInImage = markerAnglePosition + SCREEN_WIDTH / 2;
                  
                  // Debug log for first marker
                  if (index === 0) {
                    console.log('🎯 Marker:', marker.isNext ? 'FORWARD' : 'BACK', 
                                'Angle:', marker.angle, 
                                'AnglePos:', markerAnglePosition.toFixed(0),
                                'FinalPos:', markerPositionInImage.toFixed(0),
                                'ScreenCenter:', (SCREEN_WIDTH/2).toFixed(0));
                  }
                  
                  const markerColor = marker.isNext ? '#4CAF50' : '#FF9800';
                  const markerBgColor = marker.isNext ? 'rgba(76, 175, 80, 0.95)' : 'rgba(255, 152, 0, 0.95)';
                  
                  // Render marker in all three copies (left, center, right) for seamless wrapping
                  return (
                    <React.Fragment key={index}>
                      {/* Left copy (for wrapping from left edge) */}
                      <TouchableOpacity
                        style={[
                          styles.fixed360Marker,
                          {
                            left: markerPositionInImage - imageWidth - 30, // -imageWidth for left copy
                          },
                        ]}
                        onPress={() => {
                          if (marker.targetImageIndex >= 0) {
                            const direction = marker.targetImageIndex > current360Index ? 1 : -1;
                            navigate360(direction);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.fixed360MarkerContent, { backgroundColor: markerBgColor }]}>
                          <Text style={styles.fixed360MarkerArrow}>{marker.isNext ? '▼' : '▲'}</Text>
                          <Text style={styles.fixed360MarkerLabel}>{marker.isNext ? 'GO' : 'BACK'}</Text>
                        </View>
                        <View style={[styles.fixed360MarkerLine, { backgroundColor: markerColor }]} />
                      </TouchableOpacity>
                      
                      {/* Center copy (main) */}
                      <TouchableOpacity
                        style={[
                          styles.fixed360Marker,
                          {
                            left: markerPositionInImage - 30, // Center the 60px wide marker
                          },
                        ]}
                        onPress={() => {
                          if (marker.targetImageIndex >= 0) {
                            const direction = marker.targetImageIndex > current360Index ? 1 : -1;
                            navigate360(direction);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.fixed360MarkerContent, { backgroundColor: markerBgColor }]}>
                          <Text style={styles.fixed360MarkerArrow}>{marker.isNext ? '▼' : '▲'}</Text>
                          <Text style={styles.fixed360MarkerLabel}>{marker.isNext ? 'GO' : 'BACK'}</Text>
                        </View>
                        <View style={[styles.fixed360MarkerLine, { backgroundColor: markerColor }]} />
                      </TouchableOpacity>
                      
                      {/* Right copy (for wrapping from right edge) */}
                      <TouchableOpacity
                        style={[
                          styles.fixed360Marker,
                          {
                            left: markerPositionInImage + imageWidth - 30, // +imageWidth for right copy
                          },
                        ]}
                        onPress={() => {
                          if (marker.targetImageIndex >= 0) {
                            const direction = marker.targetImageIndex > current360Index ? 1 : -1;
                            navigate360(direction);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.fixed360MarkerContent, { backgroundColor: markerBgColor }]}>
                          <Text style={styles.fixed360MarkerArrow}>{marker.isNext ? '▼' : '▲'}</Text>
                          <Text style={styles.fixed360MarkerLabel}>{marker.isNext ? 'GO' : 'BACK'}</Text>
                        </View>
                        <View style={[styles.fixed360MarkerLine, { backgroundColor: markerColor }]} />
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </Animated.View>

              {/* Google Street View-Style Transition Overlay */}
              {isTransitioning && (
                <StreetViewTransition
                  direction={transitionDirection}
                  ripple1={ripple1}
                  ripple2={ripple2}
                  ripple3={ripple3}
                  rippleOpacity1={rippleOpacity1}
                  rippleOpacity2={rippleOpacity2}
                  rippleOpacity3={rippleOpacity3}
                  arrowPulse={arrowPulse}
                  vignetteOpacity={vignetteOpacity}
                />
              )}

              {/* UI Toggle Button */}
              <TouchableOpacity
                style={styles.uiToggleButton}
                onPress={() => setHideUI(!hideUI)}
              >
                <Text style={styles.uiToggleButtonText}>{hideUI ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>

              {/* Zoom Controls */}
              {!hideUI && (
                <View style={styles.zoomControls}>
                  <TouchableOpacity style={styles.zoomButton} onPress={zoomIn360}>
                    <Text style={styles.zoomButtonText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.zoomButton} onPress={resetZoom360}>
                    <Text style={styles.zoomButtonTextSmall}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.zoomButton} onPress={zoomOut360}>
                    <Text style={styles.zoomButtonText}>−</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Compass Overlay */}
              {!hideUI && (
                <CompassOverlay 
                  compassAngle={compassAngle}
                  compassAngleValue={compassAngleValue}
                  getCompassDirection={getCompassDirection}
                />
              )}

              {/* Navigation Buttons at Bottom */}
              {!hideUI && (
                <View style={styles.navButtonsContainer}>
                  {/* Back Button */}
                  {(() => {
                    const nodesWithImages = pathData?.path?.filter((n) => hasImage360(n)) || [];
                    const canGoBack = current360Index > 0;
                    const prevNode = canGoBack ? nodesWithImages[current360Index - 1] : null;
                    
                    return (
                      <TouchableOpacity
                        style={[styles.navButton, styles.navButtonBack, !canGoBack && styles.navButtonDisabled]}
                        onPress={() => canGoBack && navigate360(-1)}
                        disabled={!canGoBack}
                      >
                        <Text style={styles.navButtonIcon}>◀</Text>
                        <Text style={styles.navButtonLabel}>Back</Text>
                        {prevNode && <Text style={styles.navButtonSubLabel} numberOfLines={1}>{prevNode.name}</Text>}
                      </TouchableOpacity>
                    );
                  })()}
                  
                  {/* Position Counter */}
                  <View style={styles.navPositionCounter}>
                    <Text style={styles.navPositionText}>
                      {current360Index + 1} / {(pathData?.path?.filter((n) => hasImage360(n)) || []).length}
                    </Text>
                  </View>
                  
                  {/* Forward Button */}
                  {(() => {
                    const nodesWithImages = pathData?.path?.filter((n) => hasImage360(n)) || [];
                    const canGoForward = current360Index < nodesWithImages.length - 1;
                    const nextNode = canGoForward ? nodesWithImages[current360Index + 1] : null;
                    
                    return (
                      <TouchableOpacity
                        style={[styles.navButton, styles.navButtonForward, !canGoForward && styles.navButtonDisabled]}
                        onPress={() => canGoForward && navigate360(1)}
                        disabled={!canGoForward}
                      >
                        <Text style={styles.navButtonIcon}>▶</Text>
                        <Text style={styles.navButtonLabel}>Forward</Text>
                        {nextNode && <Text style={styles.navButtonSubLabel} numberOfLines={1}>{nextNode.name}</Text>}
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              )}

              {/* Location Info Overlay */}
              {!hideUI && (
                <View style={styles.locationInfoOverlay} pointerEvents="none">
                  <Text style={styles.location360Name}>{current360Node.name}</Text>
                  <Text style={styles.location360Details}>
                    {current360Node.building} • Floor {current360Node.floor_level}
                  </Text>
                  
                  {/* Current Step Direction */}
                  {pathData && pathData.directions && pathData.path && (
                    <View style={styles.directionsIn360}>
                      {(() => {
                        const currentIndex = pathData.path.findIndex(n => n.node_id === current360Node.node_id);
                        // Show the next direction (how to get to the next node from current position)
                        if (currentIndex >= 0 && currentIndex + 1 < pathData.directions.length) {
                          return (
                            <View style={styles.direction360Item}>
                              <Text style={styles.direction360Number}>{currentIndex + 2}.</Text>
                              <Text style={styles.direction360Text}>{pathData.directions[currentIndex + 1]}</Text>
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                  )}
                  
                  <Text style={styles.zoomIndicator}>
                    Zoom: {baseScale360.toFixed(1)}x
                  </Text>
                </View>
              )}

              {/* Close Button */}
              {!hideUI && (
                <TouchableOpacity
                  style={styles.close360Button}
                  onPress={() => setShow360Modal(false)}
                >
                  <Text style={styles.close360ButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Fullscreen Campus Map Modal */}
      <Modal
        visible={showFullscreenMap}
        animationType="none"
        onRequestClose={() => setShowFullscreenMap(false)}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.fullscreenMapModal}>
            {/* Header */}
            <View style={styles.fullscreenMapHeader}>
              <TouchableOpacity style={styles.fsHeaderButton} onPress={resetFullscreenMap}>
                <Text style={styles.fsHeaderButtonText}>⟲ Reset</Text>
              </TouchableOpacity>
              <Text style={styles.fsHeaderTitle}>📍 Campus Map</Text>
              <TouchableOpacity style={styles.fsHeaderButton} onPress={() => setShowFullscreenMap(false)}>
                <Text style={styles.fsHeaderButtonText}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            {/* Map — fills all remaining screen height */}
            <View style={styles.fsMapClipContainer}>
              <PinchGestureHandler
                onGestureEvent={onFsPinchEvent}
                onHandlerStateChange={onFsPinchStateChange}
              >
                <Animated.View
                  style={[
                    styles.fsMapWrapper,
                    {
                      transform: [
                        { translateX: fsPanX },
                        { translateY: fsPanY },
                        { scale: fsScale },
                      ],
                    },
                  ]}
                  {...fsPanResponder.panHandlers}
                >
                  <SvgMap width={SCREEN_WIDTH} height={SCREEN_WIDTH} />
                  {renderPathOverlay({ width: SCREEN_WIDTH, height: SCREEN_WIDTH }, fsCurrentZoom)}
                </Animated.View>
              </PinchGestureHandler>

              {/* Floating zoom badge — top-right corner of map area */}
              <View style={styles.fsZoomBadge} pointerEvents="none">
                <Text style={styles.fsZoomBadgeText}>🔍 {Math.round(fsCurrentZoom * 100)}%</Text>
              </View>

              {/* Floating legend — pinned to bottom of map area */}
              <View style={styles.fsFloatingLegend} pointerEvents="none">
                <View style={styles.fsFloatingLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.fsLegendText}>Start</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                    <Text style={styles.fsLegendText}>End</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                    <Text style={styles.fsLegendText}>360° View</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: THEME_COLORS.primary }]} />
                    <Text style={styles.fsLegendText}>Waypoint</Text>
                  </View>
                </View>
                <Text style={styles.fsHint}>Pinch to zoom • Drag to pan</Text>
              </View>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: THEME_COLORS.primary,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 50,
  },
  offlineModeBanner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 2,
    borderBottomColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  offlineModeText: {
    color: '#856404',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  infoSubtext: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  arrowIcon: {
    fontSize: 24,
    color: THEME_COLORS.primary,
    marginHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME_COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 5,
  },
  mapContainer: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  mapHint: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginBottom: 10,
  },
  resetZoomButton: {
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  resetZoomText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  mapTitleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullscreenButton: {
    backgroundColor: '#2D1114',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  fullscreenButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  mapClipContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapWrapper: {
    position: 'relative',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  directionsContainer: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 15,
    borderRadius: 12,
  },
  directionItem: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  directionNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  directionNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  directionText: {
    flex: 1,
    fontSize: 15,
    color: THEME_COLORS.text,
    lineHeight: 22,
  },
  view360Button: {
    backgroundColor: THEME_COLORS.secondary,
    margin: 15,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  view360ButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nodeInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 15,
  },
  nodeInfoCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    position: 'relative',
  },
  nodeInfoName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  nodeInfoDetails: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginBottom: 15,
  },
  view360SmallButton: {
    backgroundColor: THEME_COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  view360SmallButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeNodeInfo: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeNodeInfoText: {
    fontSize: 24,
    color: THEME_COLORS.textSecondary,
  },
  modal360Fullscreen: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image360Wrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image360Container: {
    flexDirection: 'row',
    height: SCREEN_HEIGHT,
  },
  image360Part: {
    width: SCREEN_HEIGHT * 6, // 6656x1104 aspect ratio = ~6:1
    height: SCREEN_HEIGHT,
    backgroundColor: 'transparent',
  },
  transitionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  transitionText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 15,
    fontWeight: '600',
  },
  uiToggleButton: {
    position: 'absolute',
    left: 20,
    top: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 100,
  },
  uiToggleButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  zoomControls: {
    position: 'absolute',
    right: 20,
    top: SCREEN_HEIGHT / 2 - 90,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    padding: 10,
    gap: 10,
  },
  zoomButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  zoomButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  zoomButtonTextSmall: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  compassOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  compassCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginBottom: 10,
  },
  compassDirection: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  compassAngle: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 5,
  },
  compassBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH * 0.8,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  compassLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 15,
  },
  locationInfoOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    borderRadius: 12,
  },
  location360Name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  location360Details: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 10,
  },
  directionsIn360: {
    marginTop: 10,
    marginBottom: 10,
  },
  directionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  direction360Item: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  direction360Number: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginRight: 8,
    minWidth: 25,
  },
  direction360Text: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 18,
  },
  zoomIndicator: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 5,
  },
  swipeControlArea: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  swipeControlText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  swipeControlIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  swipeControlIcon: {
    fontSize: 28,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  swipeControlCounter: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  close360Button: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  close360ButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Markers overlay container
  markersOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  // Fixed markers on 360 image
  fixed360Marker: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 80,
    width: 60,
    alignItems: 'center',
    zIndex: 100,
  },
  fixed360MarkerContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
  },
  fixed360MarkerArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fixed360MarkerLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  fixed360MarkerLine: {
    width: 3,
    height: 40,
    marginTop: 3,
    borderRadius: 2,
  },
  // Navigation buttons at bottom
  navButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  navButtonBack: {
    backgroundColor: 'rgba(255, 152, 0, 0.85)',
  },
  navButtonForward: {
    backgroundColor: 'rgba(76, 175, 80, 0.85)',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(100, 100, 100, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navButtonIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  navButtonLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
  },
  navButtonSubLabel: {
    fontSize: 8,
    color: '#FFFFFF',
    marginTop: 1,
    opacity: 0.8,
    maxWidth: 70,
  },
  navPositionCounter: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  navPositionText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Fullscreen map modal styles
  fullscreenMapModal: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  fullscreenMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#1F0F0F',
  },
  fsHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  fsHeaderButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  fsHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  fsZoomBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fsZoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  fsMapClipContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsMapWrapper: {
    position: 'relative',
  },
  fsFloatingLegend: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(31, 15, 15, 0.88)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  fsFloatingLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  fsLegendText: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  fsHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#999',
  },
  // Street View transition overlay styles
  svTransitionContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 999,
  },
  svVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  svRipple: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
  },
  svArrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svChevron: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  svLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

// Memoized 360 image component to prevent unnecessary re-renders
const Image360Part = React.memo(({ nodeId, imageUrl, quality, position }) => {
  return (
    <ExpoImage
      key={`360-${nodeId}-${quality}-${position}`}
      source={{ uri: imageUrl }}
      style={styles.image360Part}
      contentFit="cover"
      cachePolicy="memory-disk"
      priority="high"
      transition={0}
      recyclingKey={`${nodeId}-${quality}`}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if the actual image URL or node changes
  return prevProps.imageUrl === nextProps.imageUrl && 
         prevProps.nodeId === nextProps.nodeId &&
         prevProps.quality === nextProps.quality;
});

// Memoized Compass component that doesn't re-render on angle changes
const CompassOverlay = React.memo(({ compassAngle, compassAngleValue, getCompassDirection }) => {
  const [displayAngle, setDisplayAngle] = useState(0);
  const [displayDirection, setDisplayDirection] = useState('N');
  
  useEffect(() => {
    // Update display every 100ms instead of every frame for smooth updates without lag
    const interval = setInterval(() => {
      const currentAngle = compassAngleValue.current;
      setDisplayAngle(Math.round(currentAngle));
      setDisplayDirection(getCompassDirection(currentAngle));
    }, 100);
    
    return () => clearInterval(interval);
  }, [compassAngleValue, getCompassDirection]);
  
  return (
    <View style={styles.compassOverlay} pointerEvents="none">
      <View style={styles.compassCircle}>
        <Text style={styles.compassDirection}>{displayDirection}</Text>
        <Text style={styles.compassAngle}>{displayAngle}°</Text>
      </View>
      <View style={styles.compassBar}>
        <Text style={styles.compassLabel}>W</Text>
        <Text style={styles.compassLabel}>N</Text>
        <Text style={styles.compassLabel}>E</Text>
        <Text style={styles.compassLabel}>S</Text>
        <Text style={styles.compassLabel}>W</Text>
      </View>
    </View>
  );
});

export default MapDisplayScreen;

// ── Google Street View-Style Transition Overlay ──────────────────────────────
// Shows expanding ripple rings + directional chevrons when navigating 360 views.
const StreetViewTransition = React.memo(({ direction, ripple1, ripple2, ripple3,
  rippleOpacity1, rippleOpacity2, rippleOpacity3, arrowPulse, vignetteOpacity }) => {

  const isForward = direction > 0;

  // Scale each ripple ring from 0.2x to 2.5x its base size
  const rippleBase = 120;
  const makeRippleStyle = (anim, opacityAnim) => ({
    transform: [{
      scale: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.2, 2.5],
      }),
    }],
    opacity: opacityAnim,
  });

  // Chevron characters: show 2 for forward, 2 for backward
  const chevrons = isForward ? ['›', '›', '›'] : ['‹', '‹', '‹'];

  return (
    <View style={styles.svTransitionContainer} pointerEvents="none">
      {/* Dark vignette pulse */}
      <Animated.View style={[styles.svVignette, { opacity: vignetteOpacity }]} />

      {/* Ripple rings */}
      <Animated.View style={[styles.svRipple, makeRippleStyle(ripple1, rippleOpacity1)]} />
      <Animated.View style={[styles.svRipple, makeRippleStyle(ripple2, rippleOpacity2)]} />
      <Animated.View style={[styles.svRipple, makeRippleStyle(ripple3, rippleOpacity3)]} />

      {/* Directional arrow cluster */}
      <Animated.View style={[styles.svArrowContainer, { transform: [{ scale: arrowPulse }] }]}>
        <View style={{ flexDirection: isForward ? 'column' : 'column-reverse', alignItems: 'center' }}>
          {chevrons.map((ch, i) => (
            <Text
              key={i}
              style={[
                styles.svChevron,
                {
                  opacity: 1 - i * 0.25,
                  transform: [{ rotate: isForward ? '270deg' : '90deg' }],
                  fontSize: 36 - i * 4,
                },
              ]}
            >
              {ch}
            </Text>
          ))}
        </View>
        <Text style={styles.svLabel}>{isForward ? 'MOVING FORWARD' : 'GOING BACK'}</Text>
      </Animated.View>
    </View>
  );
});
