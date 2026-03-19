import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { THEME_COLORS, APP_CONFIG } from '../config';
import ApiService from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';
import { useDownload } from '../contexts/DownloadContext';
import SyncManager from '../services/SyncManager';
import OfflineService from '../services/OfflineService';
import { Image as ExpoImage } from 'expo-image';
import { getOptimizedImageUrl } from '../utils/ImageOptimizer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PointSelectionScreen = ({ navigation }) => {
  const { isAdmin, login } = useAuth();
  const { isDownloading, startMetadataDownload } = useDownload();
  const [nodes, setNodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectingType, setSelectingType] = useState(null); // 'start' or 'end'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  // Incremented every time the screen comes into focus to bust image caches
  const [nodeDataVersion, setNodeDataVersion] = useState(0);

  // Admin login modal
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tapCount, setTapCount] = useState(0);

  // Image quality settings
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [imageQuality, setImageQuality] = useState('sd'); // 'hd' or 'sd'

  // Network status
  const [isConnected, setIsConnected] = useState(true);
  const [offlineDataAvailable, setOfflineDataAvailable] = useState(false);
  const [forceOfflineMode, setForceOfflineMode] = useState(false); // Manual offline mode toggle

  // 360° Preview state
  const [show360PreviewModal, setShow360PreviewModal] = useState(false);
  const [preview360Node, setPreview360Node] = useState(null);
  const [preview360ImageUrl, setPreview360ImageUrl] = useState(null);
  const [baseScale360, setBaseScale360] = useState(1);
  // 360° animated pan/zoom values
  const pan360X = useRef(new Animated.Value(0)).current;
  const scale360 = useRef(new Animated.Value(1)).current;
  const lastPanX360 = useRef(0);

  useEffect(() => {
    loadImageQualitySetting();
    checkOfflineData();
    checkFirstRun();
    
    // Subscribe to network status
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected && state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  // Helper: check if a node has a 360° image
  const hasImage360 = useCallback((node) => {
    return !!(node && (node.image360 || node.image360_url));
  }, []);

  // Pan responder for 360° preview — seamless infinite loop identical to MapDisplayScreen
  const panResponder360 = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan360X.setOffset(lastPanX360.current);
        pan360X.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const sensitivity = 4;
        pan360X.setValue(gestureState.dx * sensitivity);
      },
      onPanResponderRelease: (_, gestureState) => {
        const sensitivity = 4;
        const imageWidth = SCREEN_HEIGHT * 6;
        lastPanX360.current += gestureState.dx * sensitivity;
        // Wrap to middle copy for seamless looping — same logic as MapDisplayScreen
        if (lastPanX360.current > imageWidth / 2) {
          lastPanX360.current -= imageWidth;
          pan360X.setOffset(lastPanX360.current);
        } else if (lastPanX360.current < -imageWidth / 2) {
          lastPanX360.current += imageWidth;
          pan360X.setOffset(lastPanX360.current);
        }
        pan360X.flattenOffset();
      },
      onPanResponderTerminate: () => {
        pan360X.flattenOffset();
      },
    })
  , [pan360X]);

  const zoomIn360 = () => {
    const newScale = Math.min(baseScale360 + 0.5, 5);
    setBaseScale360(newScale);
    Animated.spring(scale360, { toValue: newScale, useNativeDriver: false, friction: 7 }).start();
  };

  const zoomOut360 = () => {
    const newScale = Math.max(baseScale360 - 0.2, 0.8);
    setBaseScale360(newScale);
    Animated.spring(scale360, { toValue: newScale, useNativeDriver: false, friction: 7 }).start();
  };

  const resetZoom360 = () => {
    setBaseScale360(1);
    Animated.spring(scale360, { toValue: 1, useNativeDriver: false, friction: 7 }).start();
  };

  // Open the 360° preview for a node — uses cached image if available
  const openPreview360 = useCallback(async (node) => {
    setPreview360Node(node);
    // Start facing the node's annotation angle; fall back to 0° if unset
    const imageWidth = SCREEN_HEIGHT * 6;
    const initialAngle = (node.annotation !== null && node.annotation !== undefined) ? node.annotation : 0;
    const initialOffset = -(initialAngle / 360) * imageWidth;
    lastPanX360.current = initialOffset;
    pan360X.setValue(initialOffset);
    scale360.setValue(1);
    setBaseScale360(1);
    setPreview360ImageUrl(null);
    setShow360PreviewModal(true);
    try {
      const remoteUrl = node.image360 || node.image360_url;
      if (!remoteUrl) return;
      const cachedUrl = await OfflineService.getImageUrl({
        node_id: node.node_id,
        image360: remoteUrl,
        image360_url: remoteUrl,
      });
      if (cachedUrl && cachedUrl.startsWith('file://')) {
        setPreview360ImageUrl(cachedUrl);
      } else {
        const optimizedUrl = getOptimizedImageUrl(remoteUrl, imageQuality);
        const separator = optimizedUrl.includes('?') ? '&' : '?';
        setPreview360ImageUrl(`${optimizedUrl}${separator}cb=${Date.now()}`);
      }
    } catch (error) {
      console.error('Error loading 360 preview:', error);
      const remoteUrl = node.image360 || node.image360_url;
      if (remoteUrl) {
        const optimizedUrl = getOptimizedImageUrl(remoteUrl, imageQuality);
        const separator = optimizedUrl.includes('?') ? '&' : '?';
        setPreview360ImageUrl(`${optimizedUrl}${separator}cb=${Date.now()}`);
      }
    }
  }, [imageQuality, pan360X, scale360]);

  const checkFirstRun = async () => {
    try {
      const initialDownloadDone = await AsyncStorage.getItem('HAS_INITIAL_DOWNLOAD');
      const hasData = await OfflineService.isPathfindingAvailable();
      
      if (initialDownloadDone !== 'true' || !hasData) {
        // If online, prompt for metadata-only download
        const netState = await NetInfo.fetch();
        if (netState.isConnected) {
          Alert.alert(
            'Welcome!',
            'To use the app offline and get faster pathfinding, we need to download the campus map metadata (~2MB). Images will be loaded on-demand.',
            [
              {
                text: 'Later',
                style: 'cancel'
              },
              {
                text: 'Download Now',
                onPress: async () => {
                  const result = await startMetadataDownload();
                  if (result.success) {
                    await AsyncStorage.setItem('HAS_INITIAL_DOWNLOAD', 'true');
                    setOfflineDataAvailable(true);
                  }
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error in checkFirstRun:', error);
    }
  };

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Clear expo-image memory and disk cache BEFORE loading data so stale entries
      // are guaranteed gone before new URLs are rendered.
      const refresh = async () => {
        try {
          await Promise.all([
            ExpoImage.clearMemoryCache(),
            ExpoImage.clearDiskCache(),
          ]);
        } catch (_) {
          // ignore – best effort
        }
        setNodeDataVersion(v => v + 1);
        loadNodesAndEvents();
      };
      refresh();
    }, [])
  );

  useEffect(() => {
    // Use combined search for events and nodes
    const performSearch = async () => {
      if (searchQuery.trim() === '') {
        // Only show room-type nodes with a valid building
        const searchableNodes = nodes.filter(
          (node) => node.type_of_node === 'room' &&
                    node.building &&
                    node.building.toLowerCase() !== 'none'
        );
        setFilteredNodes(searchableNodes);
        setFilteredEvents([]);
        return;
      }

      try {
        const results = await ApiService.combinedSearch(searchQuery);
        if (results.success) {
          setFilteredEvents(results.events || []);
          const normalizedSearchNodes = (results.nodes || []).map((node) => {
            const imageUrl = node.image360_url || node.image360 || null;
            return {
              ...node,
              image360_url: imageUrl,
              image360: imageUrl,
              has_360_image: !!imageUrl,
            };
          });
          // Only show room-type nodes with a valid building from API results
          const searchableNodes = normalizedSearchNodes.filter(
            (node) => node.type_of_node === 'room' &&
                      node.building &&
                      node.building.toLowerCase() !== 'none'
          );
          setFilteredNodes(searchableNodes);
        }
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to local filtering of nodes and events
        const filteredNodesLocal = nodes.filter(
          (node) =>
            // Only include room-type nodes with a valid building
            node.type_of_node === 'room' &&
            node.building &&
            node.building.toLowerCase() !== 'none' &&
            (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.node_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.building.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        const filteredEventsLocal = events.filter(
          (event) =>
            event.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (event.category && event.category.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        setFilteredNodes(filteredNodesLocal);
        setFilteredEvents(filteredEventsLocal);
      }
    };

    performSearch();
  }, [searchQuery, nodes, events]);

  const loadNodesAndEvents = async () => {
    try {
      setLoading(true);
      
      // Load nodes
      const response = await ApiService.getNodes({ _ts: Date.now() });
      console.log('Nodes response:', response);
      if (response.success) {
        const normalizedNodes = (response.nodes || []).map((node) => {
          const imageUrl = node.image360_url || node.image360 || null;
          return {
            ...node,
            image360_url: imageUrl,
            image360: imageUrl,
            has_360_image: !!imageUrl,
          };
        });

        setNodes(normalizedNodes);
        // Pre-filter to room nodes with a valid building (matching the useEffect filter)
        const roomNodes = normalizedNodes.filter(
          (n) => n.type_of_node === 'room' &&
                  n.building &&
                  n.building.toLowerCase() !== 'none'
        );
        setFilteredNodes(roomNodes);
      } else {
        console.error('Failed to load nodes:', response);
        Alert.alert('Error', response.error || 'Failed to load nodes');
      }

      // Load events
      try {
        const eventsResponse = await ApiService.getEvents();
        if (eventsResponse.success) {
          setEvents(eventsResponse.events);
          console.log('Events loaded:', eventsResponse.events.length);
        }
      } catch (error) {
        console.warn('Failed to load events:', error);
        // Don't show error - events are optional
      }
    } catch (error) {
      console.error('Error loading nodes:', error);
      Alert.alert('Error', error.error || error.message || 'Failed to load nodes. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const loadImageQualitySetting = async () => {
    try {
      const savedQuality = await AsyncStorage.getItem('imageQuality');
      if (savedQuality) {
        setImageQuality(savedQuality);
      }
    } catch (error) {
      console.error('Error loading image quality setting:', error);
    }
  };

  const checkOfflineData = async () => {
    try {
      const available = await OfflineService.isPathfindingAvailable();
      setOfflineDataAvailable(available);
    } catch (error) {
      console.error('Error checking offline data:', error);
      setOfflineDataAvailable(false);
    }
  };

  const saveImageQualitySetting = async (quality) => {
    try {
      await AsyncStorage.setItem('imageQuality', quality);
      setImageQuality(quality);
      Alert.alert(
        'Settings Saved',
        `360° images will now load in ${quality.toUpperCase()} quality`
      );
    } catch (error) {
      console.error('Error saving image quality setting:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleTitleTap = () => {
    setTapCount((prev) => prev + 1);
    
    if (tapCount + 1 >= APP_CONFIG.ADMIN_SECRET_TAPS) {
      setAdminModalVisible(true);
      setTapCount(0);
    }

    // Reset tap count after 2 seconds
    setTimeout(() => setTapCount(0), 2000);
  };

  const handleAdminLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    const result = await login(username, password);
    
    if (result.success) {
      setAdminModalVisible(false);
      setUsername('');
      setPassword('');
      Alert.alert('Success', 'Logged in as admin', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('AdminDashboard'),
        },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Login failed');
    }
  };

  const openNodeSelector = (type) => {
    setSelectingType(type);
    setSearchQuery('');
    setModalVisible(true);
    console.log('Opening modal with nodes count:', nodes.length);
    console.log('Filtered nodes count:', filteredNodes.length);
  };

  const selectNode = (node) => {
    if (selectingType === 'start') {
      setStartPoint(node);
    } else {
      setEndPoint(node);
    }
    setModalVisible(false);
    setSearchQuery('');
  };

  const selectEvent = (event) => {
    // Auto-fill destination with event's node location
    if (selectingType === 'start') {
      setStartPoint(event.location);
    } else {
      setEndPoint(event.location);
    }
    setModalVisible(false);
    setSearchQuery('');
  };

  const renderEventItem = ({ item }) => {
    const formatDate = (datetime) => {
      if (!datetime) return '';
      const date = new Date(datetime);
      return date.toLocaleDateString();
    };

    return (
      <TouchableOpacity
        style={styles.nodeItem}
        onPress={() => selectEvent(item)}
        activeOpacity={0.7}
      >
        <View style={styles.nodeInfo}>
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeText}>EVENT</Text>
          </View>
          <Text style={styles.nodeName}>{item.event_name}</Text>
          <Text style={styles.nodeDetails}>
            {item.category} • {item.node?.building} • Floor {item.node?.floor_level}
          </Text>
          {item.start_datetime && (
            <Text style={styles.eventTime}>
              {formatDate(item.start_datetime)}
            </Text>
          )}
        </View>
        <Text style={styles.selectIcon}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderNodeItem = ({ item }) => {
    console.log('Rendering node:', item.name);
    return (
      <TouchableOpacity
        style={styles.nodeItem}
        onPress={() => selectNode(item)}
        activeOpacity={0.7}
      >
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeName}>{item.name}</Text>
          <Text style={styles.nodeDetails}>
            {item.building} • Floor {item.floor_level} • {item.node_code}
          </Text>
        </View>
        {hasImage360(item) && (
          <TouchableOpacity
            style={styles.previewEyeButton}
            onPress={() => openPreview360(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.previewEyeIcon}>👁️</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.selectIcon}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    if (item.type === 'event') {
      return renderEventItem({ item });
    } else {
      return renderNodeItem({ item });
    }
  };

  const handleFindPath = async () => {
    if (!startPoint || !endPoint) {
      Alert.alert('Error', 'Please select both starting point and destination');
      return;
    }

    if (startPoint.node_id === endPoint.node_id) {
      Alert.alert('Error', 'Starting point and destination cannot be the same');
      return;
    }

    // Check if offline (either manually forced or no network) and warn user
    if (!isConnected || forceOfflineMode) {
      if (!offlineDataAvailable) {
        Alert.alert(
          'No Internet Connection',
          'You are offline and no offline data is available. Please connect to the internet to download maps and paths first.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Show offline mode warning
      const offlineReason = forceOfflineMode ? 'forced offline mode for testing' : 'no network connection';
      Alert.alert(
        '📴 Offline Mode',
        `You are using ${offlineReason}. The app will use cached data for navigation.\n\n⚠️ Note: Any updates made on the server will not be reflected until you go online and sync your data.`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Continue Offline',
            onPress: () => {
              navigation.navigate('MapDisplay', {
                startNode: startPoint,
                endNode: endPoint,
                imageQuality: imageQuality,
                isOffline: true,
              });
            }
          }
        ]
      );
      return;
    }

    // Online mode - proceed normally
    navigation.navigate('MapDisplay', {
      startNode: startPoint,
      endNode: endPoint,
      imageQuality: imageQuality,
      isOffline: false,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.navigate('Welcome')}>
          <Text style={styles.headerBackBtnText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleTitleTap} activeOpacity={1} style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Find Your Way</Text>
          {!isConnected && (
            <Text style={styles.offlineIndicator}>
              📴 Offline Mode{offlineDataAvailable ? '' : ' - No Data'}
            </Text>
          )}
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsModalVisible(true)}
          >
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => navigation.navigate('AdminDashboard')}
            >
              <Text style={styles.adminButtonText}>Admin</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Offline Warning Banner */}
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              {offlineDataAvailable 
                ? '⚠️ You are offline. Using cached data. Changes on the server won\'t be visible until you reconnect.'
                : '❌ No offline data available. Please connect to the internet to download maps.'}
            </Text>
          </View>
        )}

        {/* Starting Point Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Starting Point</Text>
          <TouchableOpacity
            style={[styles.selector, startPoint && styles.selectorFilled]}
            onPress={() => openNodeSelector('start')}
            activeOpacity={0.7}
          >
            {startPoint ? (
              <View style={styles.selectedNode}>
                <Text style={styles.selectedNodeName}>{startPoint.name}</Text>
                <Text style={styles.selectedNodeDetails}>
                  {startPoint.building} • Floor {startPoint.floor_level}
                </Text>
              </View>
            ) : (
              <Text style={styles.selectorPlaceholder}>
                Tap to select starting point
              </Text>
            )}
            <Text style={styles.selectorIcon}>📍</Text>
          </TouchableOpacity>
        </View>

        {/* Swap Button */}
        {startPoint && endPoint && (
          <TouchableOpacity
            style={styles.swapButton}
            onPress={() => {
              const temp = startPoint;
              setStartPoint(endPoint);
              setEndPoint(temp);
            }}
          >
            <Text style={styles.swapIcon}>⇅</Text>
          </TouchableOpacity>
        )}

        {/* End Point Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Destination</Text>
          <TouchableOpacity
            style={[styles.selector, endPoint && styles.selectorFilled]}
            onPress={() => openNodeSelector('end')}
            activeOpacity={0.7}
          >
            {endPoint ? (
              <View style={styles.selectedNode}>
                <Text style={styles.selectedNodeName}>{endPoint.name}</Text>
                <Text style={styles.selectedNodeDetails}>
                  {endPoint.building} • Floor {endPoint.floor_level}
                </Text>
              </View>
            ) : (
              <Text style={styles.selectorPlaceholder}>
                Tap to select destination
              </Text>
            )}
            <Text style={styles.selectorIcon}>🎯</Text>
          </TouchableOpacity>
        </View>

        {/* Find Path Button */}
        <TouchableOpacity
          style={[
            styles.findPathButton,
            (!startPoint || !endPoint) && styles.findPathButtonDisabled,
          ]}
          onPress={handleFindPath}
          disabled={!startPoint || !endPoint}
          activeOpacity={0.8}
        >
          <Text style={styles.findPathButtonText}>Find Path</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Node Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {selectingType === 'start' ? 'Starting Point' : 'Destination'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, building, or code..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            {/* Nodes and Events List */}
            <FlatList
              data={[
                ...filteredEvents.map(e => ({ ...e, type: 'event' })),
                ...filteredNodes.map(n => ({ ...n, type: 'node' }))
              ]}
              renderItem={renderItem}
              keyExtractor={(item) => 
                item.type === 'event' 
                  ? `event-${item.event_id}` 
                  : `node-${item.node_id}`
              }
              style={styles.nodesList}
              contentContainerStyle={styles.nodesListContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {loading ? 'Loading...' : 
                     searchQuery.trim() !== '' ? 'No matching locations or events found' :
                     nodes.length === 0 ? 'No locations available' : 'No locations found'}
                  </Text>
                  {!loading && nodes.length === 0 && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={loadNodesAndEvents}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* 360° Image Preview Modal */}
      <Modal
        visible={show360PreviewModal}
        animationType="fade"
        onRequestClose={() => setShow360PreviewModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modal360Fullscreen}>
          {preview360Node && (
            <>
              {/* Swipeable 360° panoramic image — three copies for seamless loop */}
              <View style={{ flex: 1, overflow: 'hidden' }} {...panResponder360.panHandlers}>
                <Animated.View
                  style={{
                    flexDirection: 'row',
                    height: SCREEN_HEIGHT,
                    transform: [{ translateX: pan360X }, { scale: scale360 }],
                  }}
                >
                  <Image360PreviewPart imageUrl={preview360ImageUrl} />
                  <Image360PreviewPart imageUrl={preview360ImageUrl} />
                  <Image360PreviewPart imageUrl={preview360ImageUrl} />
                </Animated.View>
              </View>

              {/* Loading indicator */}
              {!preview360ImageUrl && (
                <View style={styles.preview360Loading}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.preview360LoadingText}>Loading 360° image...</Text>
                </View>
              )}

              {/* Zoom Controls */}
              <View style={styles.zoomControls360}>
                <TouchableOpacity style={styles.zoom360Button} onPress={zoomIn360}>
                  <Text style={styles.zoom360ButtonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoom360Button} onPress={resetZoom360}>
                  <Text style={styles.zoom360ButtonTextSmall}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoom360Button} onPress={zoomOut360}>
                  <Text style={styles.zoom360ButtonText}>−</Text>
                </TouchableOpacity>
              </View>

              {/* Location Info Overlay */}
              <View style={styles.preview360Info} pointerEvents="none">
                <Text style={styles.preview360NodeName}>{preview360Node.name}</Text>
                <Text style={styles.preview360NodeDetails}>
                  {preview360Node.building} • Floor {preview360Node.floor_level}
                </Text>
                <Text style={styles.preview360Hint}>← Swipe left/right to explore →</Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.close360PreviewButton}
                onPress={() => setShow360PreviewModal(false)}
              >
                <Text style={styles.close360PreviewButtonText}>✕</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Admin Login Modal */}
      <Modal
        visible={adminModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAdminModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.adminModalContent}>
            <Text style={styles.adminModalTitle}>Admin Login</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            
            <View style={styles.adminModalButtons}>
              <TouchableOpacity
                style={[styles.adminModalButton, styles.cancelButton]}
                onPress={() => {
                  setAdminModalVisible(false);
                  setUsername('');
                  setPassword('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.adminModalButton, styles.loginButton]}
                onPress={handleAdminLogin}
              >
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Quality Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <SettingsModalContent 
            imageQuality={imageQuality}
            saveImageQualitySetting={saveImageQualitySetting}
            onClose={() => setSettingsModalVisible(false)}
            onOpenOfflineSettings={() => {
              setSettingsModalVisible(false);
              navigation.navigate('OfflineSettings');
            }}
            forceOfflineMode={forceOfflineMode}
            setForceOfflineMode={setForceOfflineMode}
            offlineDataAvailable={offlineDataAvailable}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Separate component for Settings Modal to use hooks
const SettingsModalContent = ({ imageQuality, saveImageQualitySetting, onClose, onOpenOfflineSettings, forceOfflineMode, setForceOfflineMode, offlineDataAvailable }) => {
  const { 
    downloadProgress, 
    offlineStats, 
    isDownloading, 
    startDownload, 
    checkForUpdates,
    clearCache, 
    cancelDownload,
    refreshStats 
  } = useDownload();

  // Sync settings state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [wifiOnlySync, setWifiOnlySync] = useState(false);

  useEffect(() => {
    // Refresh stats and load sync settings when modal opens
    if (refreshStats) {
      refreshStats();
    }
    loadSyncSettings();
  }, [refreshStats]);

  const loadSyncSettings = async () => {
    const autoSync = await SyncManager.isAutoSyncEnabled();
    const wifiOnly = await SyncManager.isWifiOnlySync();
    setAutoSyncEnabled(autoSync);
    setWifiOnlySync(wifiOnly);
  };

  const handleAutoSyncToggle = async (value) => {
    setAutoSyncEnabled(value);
    await SyncManager.setAutoSyncEnabled(value);
  };

  const handleWifiOnlyToggle = async (value) => {
    setWifiOnlySync(value);
    await SyncManager.setWifiOnlySync(value);
  };

  const handleDownload = async () => {
    Alert.alert(
      'Download Map Data',
      'Choose your download preference:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Metadata Only (Fast)', 
          onPress: async () => {
            const result = await startMetadataDownload();
            if (result.success) {
              await AsyncStorage.setItem('HAS_INITIAL_DOWNLOAD', 'true');
              Alert.alert('Download Complete', 'Metadata downloaded successfully. Images will load on-demand.');
            } else if (result.error !== 'Download already in progress') {
              Alert.alert('Download Failed', result.error || 'An error occurred');
            }
          }
        },
        { 
          text: 'Full Download (Includes Images)', 
          onPress: async () => {
            const result = await startDownload();
            if (result.success) {
              await AsyncStorage.setItem('HAS_INITIAL_DOWNLOAD', 'true');
              Alert.alert(
                'Download Complete',
                `Downloaded ${result.nodesCount} nodes, ${result.edgesCount} edges, and ${result.imagesCount} images.`
              );
            } else if (result.error !== 'Download already in progress') {
              Alert.alert('Download Failed', result.error || 'An error occurred');
            }
          }
        },
      ]
    );
  };

  const handleCheckUpdates = async () => {
    const result = await checkForUpdates();
    if (result.success) {
      if (result.hasUpdates) {
        Alert.alert('Update Complete', `Added ${result.newNodes} new nodes and ${result.newImages} new images.`);
      } else {
        Alert.alert('Up to Date', 'All offline resources are up to date.');
      }
    } else {
      Alert.alert('Update Failed', result.error || 'Failed to check for updates');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will delete all downloaded offline resources. You will need to download them again for offline use. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            const result = await clearCache();
            if (result.success) {
              Alert.alert('Cache Cleared', 'All offline resources have been deleted.');
            } else {
              Alert.alert('Error', result.error || 'Failed to clear cache');
            }
          }
        },
      ]
    );
  };

  const formatLastSync = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.settingsModalContent}>
      <View style={styles.settingsModalHeader}>
        <Text style={styles.settingsModalTitle}>⚙️ Settings</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.settingsScrollView} showsVerticalScrollIndicator={false}>
        {/* Image Quality Section */}
        <Text style={styles.settingsSectionTitle}>360° Image Quality</Text>
        <Text style={styles.settingsDescription}>
          Toggle HD mode for higher quality 360° images. SD (default) loads faster.
        </Text>

        <TouchableOpacity
          style={styles.qualityToggleRow}
          onPress={() => saveImageQualitySetting(imageQuality === 'hd' ? 'sd' : 'hd')}
          activeOpacity={0.7}
        >
          <View style={styles.qualityToggleInfo}>
            <Text style={styles.qualityToggleLabel}>HD Quality</Text>
            <Text style={styles.qualityToggleDescription}>
              {imageQuality === 'hd' ? 'Original quality images' : 'Optimized for faster loading'}
            </Text>
          </View>
          <View style={[styles.radioButton, imageQuality === 'hd' && styles.radioButtonOn]}>
            {imageQuality === 'hd' && <View style={styles.radioButtonInner} />}
          </View>
        </TouchableOpacity>

        {/* Force Offline Mode Section */}
        <Text style={[styles.settingsSectionTitle, { marginTop: 25 }]}>🧪 Test Offline Mode</Text>
        <Text style={styles.settingsDescription}>
          Force offline mode for testing pathfinding without disabling your network.
        </Text>

        <View style={styles.syncSettingRow}>
          <View style={styles.syncSettingInfo}>
            <Text style={styles.syncSettingLabel}>📴 Force Offline Mode</Text>
            <Text style={styles.syncSettingDescription}>
              {forceOfflineMode 
                ? 'App will use offline pathfinding only' 
                : offlineDataAvailable 
                  ? 'Ready to test offline navigation'
                  : 'Download offline data first'}
            </Text>
          </View>
          <Switch
            value={forceOfflineMode}
            onValueChange={setForceOfflineMode}
            trackColor={{ false: '#ccc', true: THEME_COLORS.warning }}
            thumbColor={forceOfflineMode ? '#fff' : '#f4f3f4'}
            disabled={!offlineDataAvailable}
          />
        </View>

        {forceOfflineMode && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Offline mode is active. All pathfinding will use cached data only.
            </Text>
          </View>
        )}

        {/* Offline Resources Section */}
        <Text style={[styles.settingsSectionTitle, { marginTop: 25 }]}>📥 Offline Resources</Text>
        <Text style={styles.settingsDescription}>
          Download all map data and 360° images for offline use. The app will use cached resources when available.
        </Text>

        {/* Sync Settings */}
        <View style={styles.syncSettingsContainer}>
          <View style={styles.syncSettingRow}>
            <View style={styles.syncSettingInfo}>
              <Text style={styles.syncSettingLabel}>🔄 Auto-sync</Text>
              <Text style={styles.syncSettingDescription}>
                Automatically check for updates when online
              </Text>
            </View>
            <Switch
              value={autoSyncEnabled}
              onValueChange={handleAutoSyncToggle}
              trackColor={{ false: '#ccc', true: THEME_COLORS.primary }}
              thumbColor={autoSyncEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.syncSettingRow}>
            <View style={styles.syncSettingInfo}>
              <Text style={styles.syncSettingLabel}>📶 WiFi only</Text>
              <Text style={styles.syncSettingDescription}>
                Only sync when connected to WiFi (saves mobile data)
              </Text>
            </View>
            <Switch
              value={wifiOnlySync}
              onValueChange={handleWifiOnlyToggle}
              trackColor={{ false: '#ccc', true: THEME_COLORS.primary }}
              thumbColor={wifiOnlySync ? '#fff' : '#f4f3f4'}
              disabled={!autoSyncEnabled}
            />
          </View>
        </View>

        {/* Download Progress */}
        {isDownloading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Downloading...</Text>
              <TouchableOpacity onPress={cancelDownload}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${downloadProgress.percentage}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {downloadProgress.percentage}% - {downloadProgress.currentItem}
            </Text>
            <Text style={styles.progressSubtext}>
              {downloadProgress.completedItems} of {downloadProgress.totalItems} items
            </Text>
          </View>
        )}

        {/* Offline Stats */}
        {!isDownloading && offlineStats.offlineEnabled && (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>📍 Nodes cached:</Text>
              <Text style={styles.statsValue}>{offlineStats.nodesCount}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>🔗 Edges cached:</Text>
              <Text style={styles.statsValue}>{offlineStats.edgesCount}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>📷 Images cached:</Text>
              <Text style={styles.statsValue}>{offlineStats.imagesCount}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>💾 Cache size:</Text>
              <Text style={styles.statsValue}>{offlineStats.cacheSize}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>🕒 Last synced:</Text>
              <Text style={styles.statsValue}>{formatLastSync(offlineStats.lastSync)}</Text>
            </View>
          </View>
        )}

        {/* Download Status Message */}
        {!isDownloading && downloadProgress.status === 'completed' && (
          <View style={styles.statusMessage}>
            <Text style={styles.statusSuccess}>✅ All resources downloaded!</Text>
          </View>
        )}

        {!isDownloading && downloadProgress.status === 'error' && (
          <View style={styles.statusMessage}>
            <Text style={styles.statusError}>❌ {downloadProgress.error}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.offlineButtonsContainer}>
          {!offlineStats.offlineEnabled ? (
            <TouchableOpacity
              style={[styles.downloadButton, isDownloading && styles.buttonDisabled]}
              onPress={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.downloadButtonIcon}>📥</Text>
                  <Text style={styles.downloadButtonText}>Download All Resources</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.updateButton, isDownloading && styles.buttonDisabled]}
                onPress={handleCheckUpdates}
                disabled={isDownloading}
              >
                <Text style={styles.updateButtonText}>🔄 Check for Updates</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.redownloadButton, isDownloading && styles.buttonDisabled]}
                onPress={handleDownload}
                disabled={isDownloading}
              >
                <Text style={styles.redownloadButtonText}>📥 Re-download All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.clearCacheButton, isDownloading && styles.buttonDisabled]}
                onPress={handleClearCache}
                disabled={isDownloading}
              >
                <Text style={styles.clearCacheButtonText}>🗑️ Clear Cache</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.advancedSettingsButton}
                onPress={onOpenOfflineSettings}
              >
                <Text style={styles.advancedSettingsButtonText}>⚙️ Advanced Offline Settings</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <TouchableOpacity style={styles.settingsCloseButton} onPress={onClose}>
        <Text style={styles.settingsCloseButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: THEME_COLORS.primary,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  offlineIndicator: {
    fontSize: 12,
    color: '#FFD700',
    marginTop: 4,
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
  },
  offlineBannerText: {
    color: '#856404',
    fontSize: 13,
    lineHeight: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonText: {
    fontSize: 20,
  },
  adminButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    height: 40,
    justifyContent: 'center',
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 10,
  },
  selector: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 80,
  },
  selectorFilled: {
    borderColor: THEME_COLORS.primary,
  },
  selectorPlaceholder: {
    color: THEME_COLORS.textSecondary,
    fontSize: 16,
  },
  selectorIcon: {
    fontSize: 30,
  },
  selectedNode: {
    flex: 1,
  },
  selectedNodeName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  selectedNodeDetails: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  swapButton: {
    alignSelf: 'center',
    backgroundColor: THEME_COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  swapIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  findPathButton: {
    backgroundColor: THEME_COLORS.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  findPathButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  findPathButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: THEME_COLORS.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  nodesList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  nodesListContent: {
    paddingBottom: 20,
  },
  nodeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  nodeDetails: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  selectIcon: {
    fontSize: 24,
    color: THEME_COLORS.textSecondary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  adminModalContent: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 25,
    borderRadius: 15,
  },
  adminModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: THEME_COLORS.background,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  adminModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  adminModalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: THEME_COLORS.background,
  },
  cancelButtonText: {
    color: THEME_COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: THEME_COLORS.primary,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsModalContent: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    maxHeight: '80%',
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingsModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  settingsDescription: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  qualityOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qualityToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  qualityToggleInfo: {
    flex: 1,
  },
  qualityToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  qualityToggleDescription: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonOn: {
    borderColor: THEME_COLORS.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME_COLORS.primary,
  },
  syncSettingsContainer: {
    marginVertical: 12,
  },
  syncSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  syncSettingInfo: {
    flex: 1,
    marginRight: 12,
  },
  syncSettingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  syncSettingDescription: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    lineHeight: 16,
  },
  settingsCloseButton: {
    backgroundColor: THEME_COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  settingsCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // New styles for offline feature
  settingsScrollView: {
    maxHeight: 400,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  progressContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E8D8D8',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.primary,
  },
  cancelText: {
    fontSize: 14,
    color: THEME_COLORS.error,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: THEME_COLORS.text,
    marginBottom: 4,
  },
  progressSubtext: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  statsContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statsLabel: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  statusMessage: {
    paddingVertical: 10,
  },
  statusSuccess: {
    fontSize: 14,
    color: THEME_COLORS.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusError: {
    fontSize: 14,
    color: THEME_COLORS.error,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLORS.warning,
  },
  warningText: {
    fontSize: 13,
    color: '#F57C00',
    fontWeight: '500',
  },
  offlineButtonsContainer: {
    marginTop: 10,
    gap: 10,
  },
  downloadButton: {
    backgroundColor: THEME_COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  downloadButtonIcon: {
    fontSize: 18,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  updateButton: {
    backgroundColor: '#F5E6E6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME_COLORS.primary,
  },
  updateButtonText: {
    color: THEME_COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  redownloadButton: {
    backgroundColor: '#FFF3E0',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME_COLORS.warning,
  },
  redownloadButtonText: {
    color: THEME_COLORS.warning,
    fontSize: 15,
    fontWeight: '600',
  },
  clearCacheButton: {
    backgroundColor: '#FFEBEE',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME_COLORS.error,
  },
  clearCacheButtonText: {
    color: THEME_COLORS.error,
    fontSize: 15,
    fontWeight: '600',
  },
  advancedSettingsButton: {
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  advancedSettingsButtonText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  eventBadge: {
    backgroundColor: THEME_COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  eventBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  eventTime: {
    fontSize: 12,
    color: THEME_COLORS.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  // Back button in header
  headerBackBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 4,
  },
  headerBackBtnText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 34,
    marginTop: -2,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  // Eye preview button on node search results
  previewEyeButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(63, 81, 181, 0.08)',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: THEME_COLORS.primary,
    marginRight: 8,
  },
  previewEyeIcon: {
    fontSize: 18,
  },
  // 360° Preview Modal
  modal360Fullscreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  zoomControls360: {
    position: 'absolute',
    right: 20,
    top: '35%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    padding: 10,
    gap: 10,
  },
  zoom360Button: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  zoom360ButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  zoom360ButtonTextSmall: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  preview360Loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  preview360LoadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 15,
    fontWeight: '600',
  },
  preview360Info: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 90,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 18,
    borderRadius: 14,
  },
  preview360NodeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  preview360NodeDetails: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  preview360Hint: {
    fontSize: 13,
    color: '#E0A0A0',
    fontStyle: 'italic',
  },
  close360PreviewButton: {
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
  close360PreviewButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

// Memoized 360° image part for seamless panoramic wrapping
const Image360PreviewPart = React.memo(({ imageUrl }) => {
  if (!imageUrl) {
    return <View style={{ width: SCREEN_HEIGHT * 6, height: SCREEN_HEIGHT, backgroundColor: '#111' }} />;
  }
  return (
    <ExpoImage
      source={{ uri: imageUrl }}
      style={{ width: SCREEN_HEIGHT * 6, height: SCREEN_HEIGHT }}
      contentFit="cover"
      cachePolicy="none"
      priority="high"
      transition={0}
    />
  );
});

export default PointSelectionScreen;
