import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinchGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { THEME_COLORS, MAP_CALIBRATION, MAP_ASSETS } from '../../config';
import ApiService from '../../services/ApiService';
import SvgMap from '../../components/SvgMap';
import { transformCoordinate } from '../../utils/MapCoordinateUtils';
import CalibrationOverlay from '../../components/CalibrationOverlay';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import AdminDrawerLayout from '../../components/AdminDrawerLayout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MapOverviewScreen = ({ navigation }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [campusMap, setCampusMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [imageRefreshNonce, setImageRefreshNonce] = useState(Date.now());
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeNeighbors, setNodeNeighbors] = useState([]);

  // Calibration state
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationConfig, setCalibrationConfig] = useState(
    { ...MAP_CALIBRATION[MAP_ASSETS.DEFAULT_CAMPUS_MAP], dotSize: 8 } || { scale: 1, offsetX: 0, offsetY: 0, dotSize: 8 }
  );

  // Gesture state
  const [currentZoom, setCurrentZoom] = useState(1);
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const lastPanX = useRef(0);
  const lastPanY = useRef(0);

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
        loadData();
      };
      refresh();
    }, [])
  );

  // Keep the selected-node modal in sync: when nodes are refreshed (e.g. after an edit),
  // replace the stale selectedNode snapshot with the latest data so the image and details
  // shown in the modal are always up-to-date.
  useEffect(() => {
    if (selectedNode && nodes.length > 0) {
      const refreshed = nodes.find((n) => n.node_id === selectedNode.node_id);
      if (refreshed) {
        setSelectedNode(refreshed);
        setNodeNeighbors(getNodeNeighbors(refreshed.node_id));
      }
    }
  }, [nodes]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nodesRes, edgesRes, mapRes] = await Promise.allSettled([
        ApiService.getNodes({ _ts: Date.now() }),
        ApiService.getEdges(),
        ApiService.getCampusMap(),
      ]);

      if (nodesRes.status === 'fulfilled' && nodesRes.value?.success) {
        const freshNodes = (nodesRes.value.nodes || []).map((n) => {
          const imageUrl = n.image360_url || n.image360 || null;
          return { ...n, image360_url: imageUrl, image360: imageUrl, has_360_image: !!imageUrl };
        });
        setNodes(freshNodes);
        setImageRefreshNonce(Date.now());
      }

      if (edgesRes.status === 'fulfilled' && edgesRes.value?.success) {
        setEdges(edgesRes.value.edges || []);
      }

      if (mapRes.status === 'fulfilled' && mapRes.value?.success && mapRes.value.map) {
        setCampusMap(mapRes.value.map);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get node ID from edge (handles both object and ID format)
  const getNodeIdFromEdge = (edgeNode) => {
    if (typeof edgeNode === 'object' && edgeNode !== null) {
      return edgeNode.node_id;
    }
    return edgeNode;
  };

  const getNodeNeighbors = (nodeId) => {
    const neighbors = [];
    edges.forEach((edge) => {
      const fromId = getNodeIdFromEdge(edge.from_node);
      const toId = getNodeIdFromEdge(edge.to_node);
      
      if (fromId === nodeId) {
        const neighborNode = nodes.find((n) => n.node_id === toId);
        if (neighborNode) {
          neighbors.push({
            node: neighborNode,
            edge: edge,
            direction: 'outgoing',
          });
        }
      } else if (toId === nodeId) {
        const neighborNode = nodes.find((n) => n.node_id === fromId);
        if (neighborNode) {
          neighbors.push({
            node: neighborNode,
            edge: edge,
            direction: 'incoming',
          });
        }
      }
    });
    return neighbors;
  };

  // Pinch gesture handler
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const newScale = Math.min(Math.max(baseScale.current * event.nativeEvent.scale, 0.5), 4);
      baseScale.current = newScale;
      scale.setValue(1);
      setCurrentZoom(newScale);
      
      // Reset pan if zoomed out
      if (newScale <= 1) {
        panX.setValue(0);
        panY.setValue(0);
        lastPanX.current = 0;
        lastPanY.current = 0;
      }
    }
  };

  // Pan responder for dragging when zoomed
  const mapPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => baseScale.current > 1,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return baseScale.current > 1 && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5);
      },
      onPanResponderGrant: () => {
        panX.setOffset(lastPanX.current);
        panY.setOffset(lastPanY.current);
        panX.setValue(0);
        panY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const maxPanX = (SCREEN_WIDTH * (baseScale.current - 1)) / 2;
        const maxPanY = (SCREEN_WIDTH * (baseScale.current - 1)) / 2;
        
        const newX = Math.max(-maxPanX, Math.min(maxPanX, gestureState.dx));
        const newY = Math.max(-maxPanY, Math.min(maxPanY, gestureState.dy));
        
        panX.setValue(newX);
        panY.setValue(newY);
      },
      onPanResponderRelease: () => {
        panX.flattenOffset();
        panY.flattenOffset();
        lastPanX.current = panX._value;
        lastPanY.current = panY._value;
      },
    })
  ).current;

  const handleZoom = (direction) => {
    let newZoom;
    if (direction === 'in') {
      newZoom = Math.min(baseScale.current + 0.5, 4);
    } else if (direction === 'out') {
      newZoom = Math.max(baseScale.current - 0.5, 0.5);
    } else {
      newZoom = 1;
      panX.setValue(0);
      panY.setValue(0);
      lastPanX.current = 0;
      lastPanY.current = 0;
    }
    baseScale.current = newZoom;
    setCurrentZoom(newZoom);
  };

  const handleNodePress = (node) => {
    setSelectedNode(node);
    setNodeNeighbors(getNodeNeighbors(node.node_id));
    setShowNodeModal(true);
  };

  const getNodeColor = (node) => {
    switch (node.type_of_node) {
      case 'entrance': return '#2E7D32';
      case 'staircase': return '#E65100';
      case 'elevator': return '#6A1B9A';
      case 'hallway': return '#D4A843';
      case 'room': return '#800000';
      case 'landmark': return '#C62828';
      default: return THEME_COLORS.primary;
    }
  };

  const getNodeImageUrl = (node) => {
    if (!node) return null;
    const rawUrl = node.image360_url || node.image360 || null;
    if (!rawUrl) return null;
    if (!String(rawUrl).startsWith('http://') && !String(rawUrl).startsWith('https://')) {
      return rawUrl;
    }
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}cb=${imageRefreshNonce}`;
  };

  const hasNodeImage = (node) => {
    const imageUrl = getNodeImageUrl(node);
    return !!(imageUrl && String(imageUrl).trim() !== '');
  };

  const renderMapOverlay = () => {
    if (!mapDimensions.width) return null;

    const nodesWithPosition = nodes
      .filter((n) => n.map_x !== null && n.map_y !== null)
      .map((node) => {
        const transformed = transformCoordinate({ x: node.map_x, y: node.map_y }, calibrationConfig);
        return {
          ...node,
          x: (transformed.x / 100) * mapDimensions.width,
          y: (transformed.y / 100) * mapDimensions.height,
        };
      });

    // Calculate dot size that gets smaller as zoom increases
    const baseDotSize = calibrationConfig.dotSize || 8;
    const dotSize = Math.max(3, baseDotSize / Math.sqrt(currentZoom));
    const strokeWidth = Math.max(0.5, 2 / currentZoom);
    const glowRadius = Math.max(2, 4 / currentZoom);
    const selectionRadius = Math.max(3, 6 / currentZoom);

    return (
      <Svg
        key={`map-overlay-${calibrationConfig.dotSize || 8}`}
        style={StyleSheet.absoluteFill}
        width={mapDimensions.width}
        height={mapDimensions.height}
      >
        {/* Draw edges */}
        {edges.map((edge, index) => {
          const fromId = getNodeIdFromEdge(edge.from_node);
          const toId = getNodeIdFromEdge(edge.to_node);
          
          const fromNode = nodesWithPosition.find((n) => n.node_id === fromId);
          const toNode = nodesWithPosition.find((n) => n.node_id === toId);
          
          if (!fromNode || !toNode) return null;
          
          const x1 = fromNode.x;
          const y1 = fromNode.y;
          const x2 = toNode.x;
          const y2 = toNode.y;
          
          return (
            <Line
              key={`edge-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(128, 0, 0, 0.5)"
              strokeWidth={Math.max(0.5, 2 / currentZoom)}
            />
          );
        })}

        {/* Draw nodes */}
        {nodesWithPosition.map((node, index) => {
          const x = node.x;
          const y = node.y;
          const color = getNodeColor(node);
          const isSelected = selectedNode?.node_id === node.node_id;

          return (
            <React.Fragment key={node.node_id}>
              {/* Glow effect for nodes with 360 images */}
              {hasNodeImage(node) && (
                <Circle
                  cx={x}
                  cy={y}
                  r={dotSize + glowRadius}
                  fill="rgba(255, 215, 0, 0.4)"
                />
              )}
              {/* Selection ring */}
              {isSelected && (
                <Circle
                  cx={x}
                  cy={y}
                  r={dotSize + selectionRadius}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={Math.max(1, 3 / currentZoom)}
                />
              )}
              <Circle
                cx={x}
                cy={y}
                r={dotSize}
                fill={color}
                stroke="#FFFFFF"
                strokeWidth={strokeWidth}
                onPress={() => handleNodePress(node)}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    );
  };

  const renderNodeModal = () => {
    if (!selectedNode) return null;

    return (
      <Modal
        visible={showNodeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.nodeTypeBadge, { backgroundColor: getNodeColor(selectedNode) }]}>
                <Text style={styles.nodeTypeBadgeText}>{selectedNode.type_of_node}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowNodeModal(false)}
              >
                <Text style={styles.closeModalButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Node Info */}
              <Text style={styles.modalNodeName}>{selectedNode.name}</Text>
              <Text style={styles.modalNodeCode}>{selectedNode.node_code}</Text>

              {/* 360 Image */}
              {hasNodeImage(selectedNode) && (
                <View style={styles.imageContainer}>
                  <Text style={styles.sectionTitle}>📷 360° Image</Text>
                  <ExpoImage
                    source={{ uri: getNodeImageUrl(selectedNode) }}
                    style={styles.nodeImage}
                    contentFit="cover"
                    cachePolicy="none"
                  />
                </View>
              )}

              {/* Details */}
              <View style={styles.detailsContainer}>
                <Text style={styles.sectionTitle}>📋 Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Building:</Text>
                  <Text style={styles.detailValue}>{selectedNode.building}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Floor:</Text>
                  <Text style={styles.detailValue}>{selectedNode.floor_level}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{selectedNode.type_of_node}</Text>
                </View>
                {selectedNode.map_x && selectedNode.map_y && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Position:</Text>
                    <Text style={styles.detailValue}>
                      X: {parseFloat(selectedNode.map_x).toFixed(1)}%, Y: {parseFloat(selectedNode.map_y).toFixed(1)}%
                    </Text>
                  </View>
                )}
                {selectedNode.description && (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.detailLabel}>Description:</Text>
                    <Text style={styles.descriptionText}>{selectedNode.description}</Text>
                  </View>
                )}
              </View>

              {/* Connected Edges / Neighbors */}
              <View style={styles.neighborsContainer}>
                <Text style={styles.sectionTitle}>🔗 Connected Nodes ({nodeNeighbors.length})</Text>
                {nodeNeighbors.length === 0 ? (
                  <Text style={styles.noNeighborsText}>No connections found</Text>
                ) : (
                  nodeNeighbors.map((neighbor, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.neighborCard}
                      onPress={() => {
                        setSelectedNode(neighbor.node);
                        setNodeNeighbors(getNodeNeighbors(neighbor.node.node_id));
                      }}
                    >
                      <View style={styles.neighborHeader}>
                        <View style={[styles.directionBadge, { 
                          backgroundColor: neighbor.direction === 'outgoing' ? '#2E7D32' : '#800000' 
                        }]}>
                          <Text style={styles.directionBadgeText}>
                            {neighbor.direction === 'outgoing' ? '→ To' : '← From'}
                          </Text>
                        </View>
                        <View style={[styles.nodeTypeSmall, { backgroundColor: getNodeColor(neighbor.node) }]}>
                          <Text style={styles.nodeTypeSmallText}>{neighbor.node.type_of_node}</Text>
                        </View>
                      </View>
                      <Text style={styles.neighborName}>{neighbor.node.name}</Text>
                      <Text style={styles.neighborCode}>{neighbor.node.node_code}</Text>
                      
                      {/* Edge details */}
                      <View style={styles.edgeDetails}>
                        <View style={styles.edgeDetailItem}>
                          <Text style={styles.edgeDetailLabel}>Distance:</Text>
                          <Text style={styles.edgeDetailValue}>{neighbor.edge.distance}m</Text>
                        </View>
                        {neighbor.edge.compass_direction && (
                          <View style={styles.edgeDetailItem}>
                            <Text style={styles.edgeDetailLabel}>Direction:</Text>
                            <Text style={styles.edgeDetailValue}>{neighbor.edge.compass_direction}</Text>
                          </View>
                        )}
                        {neighbor.edge.compass_angle !== null && (
                          <View style={styles.edgeDetailItem}>
                            <Text style={styles.edgeDetailLabel}>Angle:</Text>
                            <Text style={styles.edgeDetailValue}>{neighbor.edge.compass_angle}°</Text>
                          </View>
                        )}
                        {neighbor.edge.is_staircase && (
                          <View style={styles.staircaseBadge}>
                            <Text style={styles.staircaseBadgeText}>🪜 Staircase</Text>
                          </View>
                        )}
                      </View>
                      
                      {hasNodeImage(neighbor.node) && (
                        <View style={styles.has360Badge}>
                          <Text style={styles.has360BadgeText}>📷 Has 360°</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setShowNodeModal(false);
                    navigation.navigate('NodeForm', { node: selectedNode });
                  }}
                >
                  <Text style={styles.editButtonText}>✏️ Edit Node</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <AdminDrawerLayout title="Map Overview" activeScreen="map">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLORS.primary} />
          <Text style={styles.loadingText}>Loading map data...</Text>
        </View>
      </AdminDrawerLayout>
    );
  }

  return (
    <AdminDrawerLayout
      title="Map Overview"
      activeScreen="map"
      rightElement={
        <>
          <TouchableOpacity onPress={loadData}>
            <Text style={styles.refreshButton}>↻</Text>
          </TouchableOpacity>
          {__DEV__ && (
            <TouchableOpacity onPress={() => setShowCalibration(!showCalibration)}>
              <Text style={{ fontSize: 22 }}>{showCalibration ? '🛠️' : '🔧'}</Text>
            </TouchableOpacity>
          )}
        </>
      }
    >
      <View style={styles.container}>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{nodes.length}</Text>
          <Text style={styles.statLabel}>Nodes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{edges.length}</Text>
          <Text style={styles.statLabel}>Edges</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{nodes.filter((n) => hasNodeImage(n)).length}</Text>
          <Text style={styles.statLabel}>360° Images</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#800000' }]} />
          <Text style={styles.legendText}>Room</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D4A843' }]} />
          <Text style={styles.legendText}>Hallway</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2E7D32' }]} />
          <Text style={styles.legendText}>Entrance</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E65100' }]} />
          <Text style={styles.legendText}>Stairs</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 215, 0, 0.8)', borderWidth: 1, borderColor: '#FFD700' }]} />
          <Text style={styles.legendText}>360°</Text>
        </View>
      </View>

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => handleZoom('in')}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.zoomLevel}>{Math.round(currentZoom * 100)}%</Text>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => handleZoom('out')}
        >
          <Text style={styles.zoomButtonText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.zoomResetButton}
          onPress={() => handleZoom('reset')}
        >
          <Text style={styles.zoomResetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Map Container with Gestures */}
      {campusMap ? (
        <View style={styles.mapClipContainer}>
          <GestureHandlerRootView style={styles.gestureContainer}>
            <PinchGestureHandler
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
            >
              <Animated.View
                style={styles.mapPanContainer}
                {...mapPanResponder.panHandlers}
              >
                <Animated.View
                  style={[
                    styles.mapContainer,
                    {
                      transform: [
                        { translateX: panX },
                        { translateY: panY },
                        { scale: Animated.multiply(scale, currentZoom) },
                      ],
                    },
                  ]}
                >
                  <SvgMap
                    width={mapDimensions.width || SCREEN_WIDTH}
                    height={mapDimensions.height || SCREEN_WIDTH}
                    onLayout={(e) => {
                      const { width, height } = e.nativeEvent.layout;
                      setMapDimensions({ width, height });
                    }}
                  />
                  {renderMapOverlay()}
                </Animated.View>
              </Animated.View>
            </PinchGestureHandler>
          </GestureHandlerRootView>
        </View>
      ) : (
        <View style={styles.noMapContainer}>
          <Text style={styles.noMapIcon}>🗺️</Text>
          <Text style={styles.noMapText}>No campus map available</Text>
          <Text style={styles.noMapSubtext}>Upload a map in the web admin panel</Text>
        </View>
      )}

      {/* Node Detail Modal */}
      {renderNodeModal()}

      {/* Calibration Tool */}
      {showCalibration && (
        <CalibrationOverlay
          config={calibrationConfig}
          onUpdate={setCalibrationConfig}
          onSave={() => {
            console.log('=== FINAL CALIBRATION VALUES ===');
            console.log('SVG:', MAP_ASSETS.DEFAULT_CAMPUS_MAP);
            console.log('Dot Size:', calibrationConfig.dotSize);
            console.log('===============================');
            alert('Dot size printed to console.');
          }}
          onClose={() => setShowCalibration(false)}
        />
      )}
      </View>
    </AdminDrawerLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F0F0F',
  },
  refreshButton: {
    color: '#D4A843',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#3D1518',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4A843',
  },
  statLabel: {
    fontSize: 11,
    color: '#CCCCCC',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#2D1114',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#CCCCCC',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#3D1518',
    gap: 10,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2D1114',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4A843',
  },
  zoomButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  zoomLevel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  zoomResetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2D1114',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4A843',
  },
  zoomResetText: {
    fontSize: 11,
    color: '#D4A843',
    fontWeight: '600',
  },
  mapClipContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0A0505',
  },
  gestureContainer: {
    flex: 1,
  },
  mapPanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#CCCCCC',
  },
  noMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noMapIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  noMapText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 5,
  },
  noMapSubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F0F0F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#3D1518',
  },
  nodeTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  nodeTypeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  closeModalButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3D1518',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 15,
  },
  modalNodeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  modalNodeCode: {
    fontSize: 14,
    color: '#D4A843',
    marginBottom: 15,
    fontFamily: 'monospace',
  },
  imageContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  nodeImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#3D1518',
  },
  detailsContainer: {
    backgroundColor: '#2D1114',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3D1518',
  },
  detailLabel: {
    fontSize: 14,
    color: '#888888',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: 10,
  },
  descriptionText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 5,
    lineHeight: 20,
  },
  neighborsContainer: {
    marginBottom: 20,
  },
  noNeighborsText: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  neighborCard: {
    backgroundColor: '#2D1114',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#D4A843',
  },
  neighborHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  directionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  directionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  nodeTypeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  nodeTypeSmallText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  neighborName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  neighborCode: {
    fontSize: 12,
    color: '#D4A843',
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  edgeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 5,
  },
  edgeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  edgeDetailLabel: {
    fontSize: 11,
    color: '#888888',
  },
  edgeDetailValue: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  staircaseBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  staircaseBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  has360Badge: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  has360BadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 10,
  },
  editButton: {
    backgroundColor: THEME_COLORS.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 30,
  },
});

export default MapOverviewScreen;
