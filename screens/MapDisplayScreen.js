import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Svg, { Line, Circle, Polyline } from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';
import { THEME_COLORS, MAP_CALIBRATION } from '../config';
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
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);
  const [currentZoom, setCurrentZoom] = useState(1); // State to trigger re-render on zoom
  
  // Map pan state for scrolling when zoomed
  const mapPanX = useRef(new Animated.Value(0)).current;
  const mapPanY = useRef(new Animated.Value(0)).current;
  const lastMapPanX = useRef(0);
  const lastMapPanY = useRef(0);
  
  // 360 image pan and zoom state
  const pan360X = useRef(new Animated.Value(0)).current;
  const scale360 = useRef(new Animated.Value(1)).current;
  const [baseScale360, setBaseScale360] = useState(1);
  const lastPanX = useRef(0);
  const [compassAngle, setCompassAngle] = useState(0); // 0 = North
  
  // Transition animation values
  const transitionScale = useRef(new Animated.Value(1)).current;
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const transitionTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPathAndMap();
  }, []);

  // Load cached image URL when current360Node changes
  useEffect(() => {
    const loadCachedUrl = async () => {
      if (current360Node && current360Node.image360) {
        const cachedUrl = await getImageUrlWithCache(current360Node);
        setCurrent360ImageUrl(cachedUrl);
        
        // Trigger predictive caching for neighbors
        if (OfflineService.predictiveCache) {
           // Defer execution to avoid blocking UI transition
           setTimeout(() => {
             OfflineService.predictiveCache(current360Node.node_id);
           }, 1000);
        }
      }
    };
    loadCachedUrl();
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

  // Pan responder for 360° image - seamless loop version
  const panResponder360 = useRef(
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
        pan360X.setValue(gestureState.dx * sensitivity);
        
        // Calculate compass angle based on pan
        // Image aspect ratio is 6656x1104, so width is ~6x height
        const imageWidth = SCREEN_HEIGHT * 6;
        const totalOffset = lastPanX.current + (gestureState.dx * sensitivity);
        
        // Wrap the offset to create seamless loop
        // We use middle image, so offset range is -imageWidth to +imageWidth
        let wrappedOffset = totalOffset % imageWidth;
        
        // Calculate angle: 0 offset = 0° (North)
        const angle = (-wrappedOffset / imageWidth) * 360;
        let newAngle = angle;
        
        // Normalize to 0-360
        while (newAngle < 0) newAngle += 360;
        while (newAngle >= 360) newAngle -= 360;
        setCompassAngle(newAngle);
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
  ).current;

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
        // Calculate bounds based on zoom level
        const mapWidth = SCREEN_WIDTH - 60; // Account for padding
        const mapHeight = SCREEN_HEIGHT * 0.5;
        const maxPanX = (mapWidth * (baseScale.current - 1)) / 2;
        const maxPanY = (mapHeight * (baseScale.current - 1)) / 2;
        
        // Apply movement with bounds
        const newX = Math.max(-maxPanX, Math.min(maxPanX, lastMapPanX.current + gestureState.dx));
        const newY = Math.max(-maxPanY, Math.min(maxPanY, lastMapPanY.current + gestureState.dy));
        
        mapPanX.setValue(newX - lastMapPanX.current);
        mapPanY.setValue(newY - lastMapPanY.current);
      },
      onPanResponderRelease: (_, gestureState) => {
        const mapWidth = SCREEN_WIDTH - 60;
        const mapHeight = SCREEN_HEIGHT * 0.5;
        const maxPanX = (mapWidth * (baseScale.current - 1)) / 2;
        const maxPanY = (mapHeight * (baseScale.current - 1)) / 2;
        
        lastMapPanX.current = Math.max(-maxPanX, Math.min(maxPanX, lastMapPanX.current + gestureState.dx));
        lastMapPanY.current = Math.max(-maxPanY, Math.min(maxPanY, lastMapPanY.current + gestureState.dy));
        
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
        // Constrain pan within new bounds
        const mapWidth = SCREEN_WIDTH - 60;
        const mapHeight = SCREEN_HEIGHT * 0.5;
        const maxPanX = (mapWidth * (baseScale.current - 1)) / 2;
        const maxPanY = (mapHeight * (baseScale.current - 1)) / 2;
        
        lastMapPanX.current = Math.max(-maxPanX, Math.min(maxPanX, lastMapPanX.current));
        lastMapPanY.current = Math.max(-maxPanY, Math.min(maxPanY, lastMapPanY.current));
        mapPanX.setValue(lastMapPanX.current);
        mapPanY.setValue(lastMapPanY.current);
      }
    }
  };
  
  const resetMapZoom = () => {
    baseScale.current = 1;
    scale.setValue(1);
    setCurrentZoom(1); // Update state
    lastMapPanX.current = 0;
    lastMapPanY.current = 0;
    mapPanX.setValue(0);
    mapPanY.setValue(0);
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
    if (node.image360) {
      handleView360(node);
    } else {
      // Otherwise show node info
      setSelectedNode(node);
    }
  };

  const handleView360 = (node = null, index = 0) => {
    const nodesWithImages = pathData?.path?.filter((n) => n.image360) || [];
    
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
    
    // Initialize view to face the next node direction
    const fullPathIndex = pathData.path.findIndex(n => n.node_id === targetNode.node_id);
    let initialAngle = 0;
    
    if (fullPathIndex >= 0 && fullPathIndex < pathData.path.length - 1) {
      const nextNode = pathData.path[fullPathIndex + 1];
      if (nextNode.compass_angle !== null && nextNode.compass_angle !== undefined) {
        initialAngle = nextNode.compass_angle;
      }
    }
    
    // Calculate pan offset for the initial angle
    const imageWidth = SCREEN_HEIGHT * 6;
    const initialOffset = -(initialAngle / 360) * imageWidth;
    
    setCompassAngle(initialAngle);
    pan360X.setValue(initialOffset);
    lastPanX.current = initialOffset;
    scale360.setValue(1);
    setBaseScale360(1);
    setShow360Modal(true);
  };

  const navigate360 = (direction) => {
    if (isTransitioning) return; // Prevent multiple clicks during transition
    
    const nodesWithImages = pathData?.path?.filter((n) => n.image360) || [];
    let newIndex = current360Index + direction;
    
    if (newIndex < 0) newIndex = nodesWithImages.length - 1;
    if (newIndex >= nodesWithImages.length) newIndex = 0;
    
    // Update node and index BEFORE animation starts to ensure correct image loads
    const targetNode = nodesWithImages[newIndex];
    setCurrent360Index(newIndex);
    setCurrent360Node(targetNode);
    
    setIsTransitioning(true);
    
    // Zoom in and fade out animation (moving forward/backward effect)
    const zoomAmount = direction > 0 ? 1.3 : 0.7; // Zoom in for forward, zoom out for backward
    const translateAmount = direction > 0 ? -100 : 100; // Move down for forward, up for backward
    
    Animated.parallel([
      Animated.timing(transitionScale, {
        toValue: zoomAmount,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(transitionOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(transitionTranslate, {
        toValue: translateAmount,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Initialize view to face the next node direction
      const fullPathIndex = pathData.path.findIndex(n => n.node_id === targetNode.node_id);
      let initialAngle = 0;
      
      if (fullPathIndex >= 0 && fullPathIndex < pathData.path.length - 1) {
        const nextNode = pathData.path[fullPathIndex + 1];
        if (nextNode.compass_angle !== null && nextNode.compass_angle !== undefined) {
          initialAngle = nextNode.compass_angle;
        }
      }
      
      // Calculate pan offset for the initial angle
      const imageWidth = SCREEN_HEIGHT * 6;
      const initialOffset = -(initialAngle / 360) * imageWidth;
      
      setCompassAngle(initialAngle);
      pan360X.setValue(initialOffset);
      lastPanX.current = initialOffset;
      scale360.setValue(1);
      setBaseScale360(1);
      
      // Reset transition values to opposite for fade in
      transitionScale.setValue(direction > 0 ? 0.7 : 1.3);
      transitionOpacity.setValue(0);
      transitionTranslate.setValue(direction > 0 ? 100 : -100);
      
      // Fade in and zoom back to normal
      Animated.parallel([
        Animated.timing(transitionScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(transitionOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(transitionTranslate, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  const getCompassDirection = (angle) => {
    if (angle >= 337.5 || angle < 22.5) return 'N';
    if (angle >= 22.5 && angle < 67.5) return 'NE';
    if (angle >= 67.5 && angle < 112.5) return 'E';
    if (angle >= 112.5 && angle < 157.5) return 'SE';
    if (angle >= 157.5 && angle < 202.5) return 'S';
    if (angle >= 202.5 && angle < 247.5) return 'SW';
    if (angle >= 247.5 && angle < 292.5) return 'W';
    if (angle >= 292.5 && angle < 337.5) return 'NW';
    return 'N';
  };

  // Get direction markers based on path edges
  const getDirectionMarkers = () => {
    if (!pathData?.path || !current360Node) return [];
    
    const markers = [];
    const nodesWithImages = pathData.path.filter((n) => n.image360);
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
  };

  // Calculate marker position based on compass angle and current view angle
  const calculateMarkerPosition = (markerAngle) => {
    // markerAngle: 0° = North (left edge of image)
    // compassAngle: current view angle (0° = looking at North/left edge)
    
    // Calculate relative angle from current view
    let relativeAngle = markerAngle - compassAngle;
    
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
  };

  const renderPathOverlay = () => {
    if (!pathData || !pathData.path || !mapDimensions.width) return null;

    const calibration = MAP_CALIBRATION['Mahogany building.svg'] || { scale: 1, offsetX: 0, offsetY: 0 };

    const points = pathData.path
      .filter((node) => node.map_x !== null && node.map_y !== null)
      .map((node) => {
        // First get relative point (0-100 range)
        const point = { x: node.map_x, y: node.map_y };
        // Apply calibration scaling/offset
        const transformed = transformCoordinate(point, calibration);
        // Map to screen dimensions
        return {
          x: (transformed.x / 100) * mapDimensions.width,
          y: (transformed.y / 100) * mapDimensions.height,
          ...node,
        };
      });

    if (points.length === 0) return null;

    // Create polyline path string
    const pathString = points.map((p) => `${p.x},${p.y}`).join(' ');
    
    // Scale dot size inversely with zoom (smaller when zoomed in)
    // Base sizes at 1x zoom, scale down as zoom increases
    const baseRadius = 10;
    const baseStroke = 3;
    const baseLineWidth = 4;
    const dotRadius = Math.max(4, baseRadius / currentZoom);
    const strokeWidth = Math.max(1, baseStroke / currentZoom);
    const lineWidth = Math.max(2, baseLineWidth / currentZoom);

    return (
      <Svg
        style={StyleSheet.absoluteFill}
        width={mapDimensions.width}
        height={mapDimensions.height}
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
          const has360 = !!point.image360;
          
          // Determine fill color
          let fillColor = THEME_COLORS.primary;
          if (isStart) fillColor = '#4CAF50'; // Green
          else if (isEnd) fillColor = '#F44336'; // Red
          else if (has360) fillColor = '#FF9800'; // Orange for 360° available
          
          return (
            <React.Fragment key={index}>
              {/* Outer glow for 360° nodes */}
              {has360 && (
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={dotRadius + 4 / currentZoom}
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
              {/* Camera icon indicator for 360° nodes (scaled with zoom) */}
              {has360 && currentZoom >= 1.5 && (
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
              {baseScale.current > 1 && (
                <TouchableOpacity style={styles.resetZoomButton} onPress={resetMapZoom}>
                  <Text style={styles.resetZoomText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.mapHint}>Pinch to zoom • Swipe to pan when zoomed</Text>
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
                    height={mapDimensions.height || SCREEN_HEIGHT * 0.5}
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
        {pathData && pathData.path && pathData.path.some(node => node.image360) && (
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
            {selectedNode.image360 && (
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
              {/* 360° Image with Pan Gestures */}
              <View style={{ flex: 1 }} {...panResponder360.panHandlers}>
                <Animated.View
                  style={[
                    styles.image360Wrapper,
                    {
                      transform: [
                        { scale: scale360 },
                      ],
                    },
                  ]}
                >
                  <Animated.View
                    style={{ flex: 1 }}
                  >
                  {/* Triple image for seamless 360° loop with transition effects */}
                  <Animated.View
                    style={[
                      styles.image360Container,
                      {
                        transform: [
                          { translateX: pan360X },
                          { scale: transitionScale },
                          { translateY: transitionTranslate },
                        ],
                        opacity: transitionOpacity,
                      },
                    ]}
                  >
                    <ExpoImage
                      key={`360-${current360Node.node_id}-${imageQuality}-1`}
                      source={{ uri: current360ImageUrl || getOptimizedImageUrl(current360Node.image360, imageQuality) }}
                      style={styles.image360Part}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      transition={0}
                    />
                    <ExpoImage
                      key={`360-${current360Node.node_id}-${imageQuality}-2`}
                      source={{ uri: current360ImageUrl || getOptimizedImageUrl(current360Node.image360, imageQuality) }}
                      style={styles.image360Part}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      transition={0}
                    />
                    <ExpoImage
                      key={`360-${current360Node.node_id}-${imageQuality}-3`}
                      source={{ uri: current360ImageUrl || getOptimizedImageUrl(current360Node.image360, imageQuality) }}
                      style={styles.image360Part}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      transition={0}
                    />
                  </Animated.View>
                </Animated.View>
              </Animated.View>
              </View>

              {/* Fixed Direction Markers Overlay */}
              <View style={styles.markersOverlay} pointerEvents="box-none">
                {getDirectionMarkers().map((marker, index) => {
                  // Calculate marker position based on compass angle relative to current view
                  // The 360° image width = SCREEN_HEIGHT * 6 represents full 360°
                  // The visible screen width (SCREEN_WIDTH) shows a portion of the 360°
                  const imageWidth = SCREEN_HEIGHT * 6;
                  const degreesPerPixel = 360 / imageWidth;
                  const visibleDegrees = SCREEN_WIDTH * degreesPerPixel;
                  
                  // Calculate angle difference from current view center
                  let angleDiff = marker.angle - compassAngle;
                  
                  // Normalize to -180 to 180
                  while (angleDiff > 180) angleDiff -= 360;
                  while (angleDiff < -180) angleDiff += 360;
                  
                  // Convert angle difference to screen position
                  // Each degree = imageWidth / 360 pixels on the image
                  // But we need screen position, which is where that part of the image appears
                  const pixelsPerDegree = imageWidth / 360;
                  const xOffset = angleDiff * pixelsPerDegree;
                  
                  // The marker screen position is center + offset
                  // But since the image scrolls, the marker appears at screen center when angleDiff is 0
                  const screenX = (SCREEN_WIDTH / 2) + xOffset;
                  
                  // Only show if on screen (with some margin)
                  const halfVisible = visibleDegrees / 2 + 10;
                  const isVisible = Math.abs(angleDiff) <= halfVisible;
                  
                  if (!isVisible) return null;
                  
                  const markerColor = marker.isNext ? '#4CAF50' : '#FF9800';
                  const markerBgColor = marker.isNext ? 'rgba(76, 175, 80, 0.95)' : 'rgba(255, 152, 0, 0.95)';
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.fixed360Marker,
                        {
                          left: screenX - 30, // Center the 60px wide marker
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
                  );
                })}
              </View>

              {/* Transition Loading Indicator */}
              {isTransitioning && (
                <View style={styles.transitionOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.transitionText}>Loading...</Text>
                </View>
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
                <View style={styles.compassOverlay} pointerEvents="none">
                  <View style={styles.compassCircle}>
                    <Text style={styles.compassDirection}>{getCompassDirection(compassAngle)}</Text>
                    <Text style={styles.compassAngle}>{Math.round(compassAngle)}°</Text>
                  </View>
                  <View style={styles.compassBar}>
                    <Text style={styles.compassLabel}>W</Text>
                    <Text style={styles.compassLabel}>N</Text>
                    <Text style={styles.compassLabel}>E</Text>
                    <Text style={styles.compassLabel}>S</Text>
                    <Text style={styles.compassLabel}>W</Text>
                  </View>
                </View>
              )}

              {/* Navigation Buttons at Bottom */}
              {!hideUI && (
                <View style={styles.navButtonsContainer}>
                  {/* Back Button */}
                  {(() => {
                    const nodesWithImages = pathData?.path?.filter((n) => n.image360) || [];
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
                      {current360Index + 1} / {(pathData?.path?.filter((n) => n.image360) || []).length}
                    </Text>
                  </View>
                  
                  {/* Forward Button */}
                  {(() => {
                    const nodesWithImages = pathData?.path?.filter((n) => n.image360) || [];
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
  mapClipContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.5,
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
});

export default MapDisplayScreen;
