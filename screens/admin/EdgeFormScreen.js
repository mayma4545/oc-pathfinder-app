import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../config';
import ApiService from '../../services/ApiService';

const EdgeFormScreen = ({ route, navigation }) => {
  const { edge } = route.params || {};
  const isEdit = !!edge;

  const [formData, setFormData] = useState({
    from_node_id: edge?.from_node?.node_id || null,
    to_node_id: edge?.to_node?.node_id || null,
    distance: edge?.distance?.toString() || '',
    compass_angle: edge?.compass_angle?.toString() || '',
    is_staircase: edge?.is_staircase || false,
    is_active: edge?.is_active !== undefined ? edge.is_active : true,
  });

  const [fromNode, setFromNode] = useState(edge?.from_node || null);
  const [toNode, setToNode] = useState(edge?.to_node || null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [selectingFor, setSelectingFor] = useState(null); // 'from' or 'to'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      setNodesLoading(true);
      const response = await ApiService.getNodes();
      if (response.success) {
        setNodes(response.nodes || []);
      }
    } catch (error) {
      console.error('Failed to load nodes:', error);
    } finally {
      setNodesLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const openNodeSelector = (forField) => {
    setSelectingFor(forField);
    setSearchQuery('');
    setShowNodeModal(true);
  };

  const selectNode = (node) => {
    if (selectingFor === 'from') {
      setFromNode(node);
      setFormData((prev) => ({ ...prev, from_node_id: node.node_id }));
    } else {
      setToNode(node);
      setFormData((prev) => ({ ...prev, to_node_id: node.node_id }));
    }
    setShowNodeModal(false);
  };

  const filteredNodes = nodes.filter((node) => {
    const query = searchQuery.toLowerCase();
    return (
      node.name.toLowerCase().includes(query) ||
      node.node_code.toLowerCase().includes(query) ||
      node.building.toLowerCase().includes(query)
    );
  });

  const getCompassDirection = (angle) => {
    if (angle === '' || angle === null) return '';
    const deg = parseFloat(angle);
    if (deg >= 337.5 || deg < 22.5) return 'N';
    if (deg >= 22.5 && deg < 67.5) return 'NE';
    if (deg >= 67.5 && deg < 112.5) return 'E';
    if (deg >= 112.5 && deg < 157.5) return 'SE';
    if (deg >= 157.5 && deg < 202.5) return 'S';
    if (deg >= 202.5 && deg < 247.5) return 'SW';
    if (deg >= 247.5 && deg < 292.5) return 'W';
    if (deg >= 292.5 && deg < 337.5) return 'NW';
    return '';
  };

  const handleSubmit = async () => {
    if (!formData.from_node_id) {
      Alert.alert('Error', 'Please select a starting node (From Node)');
      return;
    }
    if (!formData.to_node_id) {
      Alert.alert('Error', 'Please select a destination node (To Node)');
      return;
    }
    if (formData.from_node_id === formData.to_node_id) {
      Alert.alert('Error', 'From node and To node cannot be the same');
      return;
    }
    if (!formData.distance || parseFloat(formData.distance) <= 0) {
      Alert.alert('Error', 'Please enter a valid distance');
      return;
    }
    if (formData.compass_angle === '' || parseFloat(formData.compass_angle) < 0 || parseFloat(formData.compass_angle) > 360) {
      Alert.alert('Error', 'Please enter a valid compass angle (0-360)');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        from_node_id: formData.from_node_id,
        to_node_id: formData.to_node_id,
        distance: parseFloat(formData.distance),
        compass_angle: parseFloat(formData.compass_angle),
        is_staircase: formData.is_staircase,
        is_active: formData.is_active,
      };

      let response;
      if (isEdit) {
        response = await ApiService.updateEdge(edge.edge_id, payload);
      } else {
        response = await ApiService.createEdge(payload);
      }

      if (response.success) {
        Alert.alert('Success', `Edge ${isEdit ? 'updated' : 'created'} successfully`);
        navigation.goBack();
      } else {
        Alert.alert('Error', response.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to save edge');
    } finally {
      setLoading(false);
    }
  };

  const renderNodeItem = ({ item }) => {
    const isSelected =
      (selectingFor === 'from' && item.node_id === formData.from_node_id) ||
      (selectingFor === 'to' && item.node_id === formData.to_node_id);
    
    const isOtherNode =
      (selectingFor === 'from' && item.node_id === formData.to_node_id) ||
      (selectingFor === 'to' && item.node_id === formData.from_node_id);

    return (
      <TouchableOpacity
        style={[
          styles.nodeItem,
          isSelected && styles.nodeItemSelected,
          isOtherNode && styles.nodeItemDisabled,
        ]}
        onPress={() => !isOtherNode && selectNode(item)}
        disabled={isOtherNode}
      >
        <View style={styles.nodeItemContent}>
          <Text style={[styles.nodeItemCode, isOtherNode && styles.textDisabled]}>
            {item.node_code}
          </Text>
          <Text style={[styles.nodeItemName, isOtherNode && styles.textDisabled]}>
            {item.name}
          </Text>
          <Text style={[styles.nodeItemLocation, isOtherNode && styles.textDisabled]}>
            {item.building} • Floor {item.floor_level} • {item.type_of_node}
          </Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
        {isOtherNode && <Text style={styles.otherLabel}>Other node</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Edge' : 'Create Edge'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {/* From Node Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>From Node <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity
            style={styles.nodeSelector}
            onPress={() => openNodeSelector('from')}
          >
            {fromNode ? (
              <View style={styles.selectedNodeInfo}>
                <Text style={styles.selectedNodeCode}>{fromNode.node_code}</Text>
                <Text style={styles.selectedNodeName}>{fromNode.name}</Text>
                <Text style={styles.selectedNodeLocation}>
                  {fromNode.building} • Floor {fromNode.floor_level}
                </Text>
              </View>
            ) : (
              <Text style={styles.placeholderText}>Tap to select starting node...</Text>
            )}
            <Text style={styles.selectorIcon}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* To Node Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>To Node <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity
            style={styles.nodeSelector}
            onPress={() => openNodeSelector('to')}
          >
            {toNode ? (
              <View style={styles.selectedNodeInfo}>
                <Text style={styles.selectedNodeCode}>{toNode.node_code}</Text>
                <Text style={styles.selectedNodeName}>{toNode.name}</Text>
                <Text style={styles.selectedNodeLocation}>
                  {toNode.building} • Floor {toNode.floor_level}
                </Text>
              </View>
            ) : (
              <Text style={styles.placeholderText}>Tap to select destination node...</Text>
            )}
            <Text style={styles.selectorIcon}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Connection Preview */}
        {fromNode && toNode && (
          <View style={styles.connectionPreview}>
            <Text style={styles.connectionText}>
              📍 {fromNode.name} → {toNode.name}
            </Text>
          </View>
        )}

        {/* Distance */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Distance (meters) <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.distance}
            onChangeText={(value) => handleChange('distance', value)}
            placeholder="e.g., 15.5"
            keyboardType="decimal-pad"
            placeholderTextColor={THEME_COLORS.textSecondary}
          />
          <Text style={styles.hint}>Physical distance between the two nodes</Text>
        </View>

        {/* Compass Angle */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Compass Angle (degrees) <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.compass_angle}
            onChangeText={(value) => handleChange('compass_angle', value)}
            placeholder="e.g., 90"
            keyboardType="decimal-pad"
            placeholderTextColor={THEME_COLORS.textSecondary}
          />
          <Text style={styles.hint}>
            0° = North, 90° = East, 180° = South, 270° = West
            {formData.compass_angle !== '' && (
              <Text style={styles.directionHint}>
                {' '}• Direction: {getCompassDirection(formData.compass_angle)}
              </Text>
            )}
          </Text>
        </View>

        {/* Compass Guide */}
        <View style={styles.compassGuide}>
          <Text style={styles.compassTitle}>🧭 Compass Reference</Text>
          <View style={styles.compassGrid}>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '0')}>
              <Text style={styles.compassDeg}>0°</Text>
              <Text style={styles.compassDir}>N ↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '45')}>
              <Text style={styles.compassDeg}>45°</Text>
              <Text style={styles.compassDir}>NE ↗</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '90')}>
              <Text style={styles.compassDeg}>90°</Text>
              <Text style={styles.compassDir}>E →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '135')}>
              <Text style={styles.compassDeg}>135°</Text>
              <Text style={styles.compassDir}>SE ↘</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '180')}>
              <Text style={styles.compassDeg}>180°</Text>
              <Text style={styles.compassDir}>S ↓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '225')}>
              <Text style={styles.compassDeg}>225°</Text>
              <Text style={styles.compassDir}>SW ↙</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '270')}>
              <Text style={styles.compassDeg}>270°</Text>
              <Text style={styles.compassDir}>W ←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.compassItem} onPress={() => handleChange('compass_angle', '315')}>
              <Text style={styles.compassDeg}>315°</Text>
              <Text style={styles.compassDir}>NW ↖</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Checkboxes */}
        <View style={styles.checkboxGroup}>
          <TouchableOpacity
            style={styles.checkboxItem}
            onPress={() => handleChange('is_staircase', !formData.is_staircase)}
          >
            <View style={[styles.checkbox, formData.is_staircase && styles.checkboxChecked]}>
              {formData.is_staircase && <Text style={styles.checkboxIcon}>✓</Text>}
            </View>
            <View style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxLabel}>🪜 This is a staircase</Text>
              <Text style={styles.checkboxHint}>Check if this edge involves stairs</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxItem}
            onPress={() => handleChange('is_active', !formData.is_active)}
          >
            <View style={[styles.checkbox, formData.is_active && styles.checkboxChecked]}>
              {formData.is_active && <Text style={styles.checkboxIcon}>✓</Text>}
            </View>
            <View style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxLabel}>✅ Active</Text>
              <Text style={styles.checkboxHint}>Inactive edges won't be used in pathfinding</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 <Text style={styles.infoTextBold}>Note:</Text> Edges are automatically bidirectional. 
            The reverse edge will be created with compass angle + 180°.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEdit ? 'Update Edge' : 'Create Edge'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Node Selection Modal */}
      <Modal
        visible={showNodeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {selectingFor === 'from' ? 'Starting' : 'Destination'} Node
              </Text>
              <TouchableOpacity onPress={() => setShowNodeModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search nodes by name, code, or building..."
                placeholderTextColor={THEME_COLORS.textSecondary}
              />
              {searchQuery !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearch}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {nodesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME_COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={filteredNodes}
                renderItem={renderNodeItem}
                keyExtractor={(item) => item.node_id.toString()}
                contentContainerStyle={styles.nodeList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'No nodes match your search' : 'No nodes available'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    padding: 15,
    backgroundColor: THEME_COLORS.primary,
  },
  backButton: {
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
  form: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  required: {
    color: '#E91E63',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: THEME_COLORS.text,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  hint: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 5,
  },
  directionHint: {
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
  nodeSelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedNodeInfo: {
    flex: 1,
  },
  selectedNodeCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_COLORS.primary,
    marginBottom: 2,
  },
  selectedNodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 2,
  },
  selectedNodeLocation: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  placeholderText: {
    color: THEME_COLORS.textSecondary,
    fontSize: 15,
  },
  selectorIcon: {
    fontSize: 20,
    marginLeft: 10,
  },
  connectionPreview: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  connectionText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  compassGuide: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  compassTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 10,
    textAlign: 'center',
  },
  compassGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  compassItem: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  compassDeg: {
    fontSize: 12,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  compassDir: {
    fontSize: 11,
    color: THEME_COLORS.textSecondary,
  },
  checkboxGroup: {
    marginBottom: 20,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: THEME_COLORS.primary,
    borderColor: THEME_COLORS.primary,
  },
  checkboxIcon: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  checkboxHint: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLORS.primary,
  },
  infoText: {
    fontSize: 13,
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
  infoTextBold: {
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 40,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  modalClose: {
    fontSize: 24,
    color: THEME_COLORS.textSecondary,
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: THEME_COLORS.text,
  },
  clearSearch: {
    fontSize: 18,
    color: THEME_COLORS.textSecondary,
    padding: 10,
  },
  nodeList: {
    padding: 15,
  },
  nodeItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeItemSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: THEME_COLORS.primary,
  },
  nodeItemDisabled: {
    backgroundColor: '#EEEEEE',
    opacity: 0.6,
  },
  nodeItemContent: {
    flex: 1,
  },
  nodeItemCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: THEME_COLORS.primary,
    marginBottom: 2,
  },
  nodeItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 2,
  },
  nodeItemLocation: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  textDisabled: {
    color: '#9E9E9E',
  },
  checkmark: {
    fontSize: 20,
    color: THEME_COLORS.primary,
    fontWeight: 'bold',
  },
  otherLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
});

export default EdgeFormScreen;
