import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
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
import { THEME_COLORS } from '../../config';
import ApiService from '../../services/ApiService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MapOverviewScreen = ({ navigation }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [campusMap, setCampusMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeNeighbors, setNodeNeighbors] = useState([]);

  // Gesture state
  const [currentZoom, setCurrentZoom] = useState(1);
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const lastPanX = useRef(0);
  const lastPanY = useRef(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nodesRes, edgesRes, mapRes] = await Promise.all([
        ApiService.getNodes(),
        ApiService.getEdges(),
        ApiService.getCampusMap(),
      ]);

      if (nodesRes.success) setNodes(nodesRes.nodes || []);
      if (edgesRes.success) setEdges(edgesRes.edges || []);
      if (mapRes.success && mapRes.map) setCampusMap(mapRes.map);
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
      case 'entrance': return '#4CAF50';
      case 'staircase': return '#FF9800';
      case 'elevator': return '#9C27B0';
      case 'hallway': return '#2196F3';
      case 'room': return '#E91E63';
      case 'landmark': return '#F44336';
      default: return THEME_COLORS.primary;
    }
  };

  const renderMapOverlay = () => {
    if (!mapDimensions.width) return null;

    const nodesWithPosition = nodes.filter(
      (n) => n.map_x !== null && n.map_y !== null
    );

    // Calculate dot size that gets smaller as zoom increases
    const baseDotSize = 8;
    const dotSize = Math.max(3, baseDotSize / Math.sqrt(currentZoom));
    const strokeWidth = Math.max(0.5, 2 / currentZoom);
    const glowRadius = Math.max(2, 4 / currentZoom);
    const selectionRadius = Math.max(3, 6 / currentZoom);

    return (
      <Svg
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
          
          const x1 = (fromNode.map_x / 100) * mapDimensions.width;
          const y1 = (fromNode.map_y / 100) * mapDimensions.height;
          const x2 = (toNode.map_x / 100) * mapDimensions.width;
          const y2 = (toNode.map_y / 100) * mapDimensions.height;
          
          return (
            <Line
              key={`edge-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(0, 150, 255, 0.5)"
              strokeWidth={Math.max(0.5, 2 / currentZoom)}
            />
          );
        })}

        {/* Draw nodes */}
        {nodesWithPosition.map((node, index) => {
          const x = (node.map_x / 100) * mapDimensions.width;
          const y = (node.map_y / 100) * mapDimensions.height;
          const color = getNodeColor(node);
          const isSelected = selectedNode?.node_id === node.node_id;

          return (
            <React.Fragment key={node.node_id}>
              {/* Glow effect for nodes with 360 images */}
              {node.image360_url && (
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
              {selectedNode.image360_url && (
                <View style={styles.imageContainer}>
                  <Text style={styles.sectionTitle}>📷 360° Image</Text>
                  <Image
                    source={{ uri: selectedNode.image360_url }}
                    style={styles.nodeImage}
                    resizeMode="cover"
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
                          backgroundColor: neighbor.direction === 'outgoing' ? '#4CAF50' : '#2196F3' 
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
                      
                      {neighbor.node.image360_url && (
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLORS.primary} />
          <Text style={styles.loadingText}>Loading map data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🗺️ Map Overview</Text>
        <TouchableOpacity onPress={loadData}>
          <Text style={styles.refreshButton}>↻</Text>
        </TouchableOpacity>
      </View>

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
          <Text style={styles.statValue}>{nodes.filter(n => n.image360_url).length}</Text>
          <Text style={styles.statLabel}>360° Images</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E91E63' }]} />
          <Text style={styles.legendText}>Room</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
          <Text style={styles.legendText}>Hallway</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>Entrance</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
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
                  <Image
                    source={{ uri: campusMap.image_url }}
                    style={styles.mapImage}
                    resizeMode="contain"
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#16213E',
  },
  backButton: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  refreshButton: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#0F3460',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
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
    backgroundColor: '#16213E',
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
    backgroundColor: '#0F3460',
    gap: 10,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16213E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
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
    backgroundColor: '#16213E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  zoomResetText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  mapClipContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0A0A1A',
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
  mapImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
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
    backgroundColor: '#1A1A2E',
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
    borderBottomColor: '#0F3460',
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
    backgroundColor: '#0F3460',
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
    color: '#4CAF50',
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
    backgroundColor: '#0F3460',
  },
  detailsContainer: {
    backgroundColor: '#16213E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0F3460',
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
    backgroundColor: '#16213E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
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
    color: '#4CAF50',
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
