import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { THEME_COLORS, MAP_ASSETS } from '../../config';
import ApiService from '../../services/ApiService';
import SvgMap from '../../components/SvgMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const NODE_TYPES = [
  { value: 'room', label: '🚪 Room' },
  { value: 'hallway', label: '🚶 Hallway' },
  { value: 'entrance', label: '🚪 Entrance' },
  { value: 'staircase', label: '🪜 Staircase' },
  { value: 'elevator', label: '🛗 Elevator' },
  { value: 'landmark', label: '📍 Landmark' },
];

const NodeFormScreen = ({ route, navigation }) => {
  const { node } = route.params || {};
  const isEdit = !!node;
  const existingImageUrl = node?.image360_url || node?.image360 || null;

  const [formData, setFormData] = useState({
    node_code: node?.node_code || '',
    name: node?.name || '',
    building: node?.building || '',
    floor_level: node?.floor_level?.toString() || '1',
    type_of_node: node?.type_of_node || 'room',
    description: node?.description || '',
    map_x: node?.map_x?.toString() || '',
    map_y: node?.map_y?.toString() || '',
    annotation: node?.annotation?.toString() || '',
  });

  const [image360, setImage360] = useState(null);
  const [loading, setLoading] = useState(false);
  const [campusMap, setCampusMap] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  const [mapZoom, setMapZoom] = useState(3);
  const [dotSize, setDotSize] = useState(10); // base radius in pixels
  const [mapLoading, setMapLoading] = useState(true);

  // Generate unique node code based on date and time for new nodes
  const generateNodeCode = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `NODE-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  useEffect(() => {
    loadCampusMap();
    // Auto-generate node code only for new nodes
    if (!isEdit) {
      setFormData((prev) => ({
        ...prev,
        node_code: generateNodeCode(),
      }));
    }
  }, []);

  const handleMapLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setMapDimensions({ width, height });
    setMapLoading(false);
  }, []);

  const loadCampusMap = async () => {
    try {
      const response = await ApiService.getCampusMap();
      if (response.success && response.map) {
        setCampusMap(response.map);
      }
    } catch (error) {
      console.log('No campus map available');
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Denied', 'You need to grant camera roll permissions to upload an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImage360({ uri: asset.uri, base64: asset.base64, name: 'image360.jpg' });
    }
  };

  const handleMapPress = (event) => {
    const { locationX, locationY } = event.nativeEvent;

    // Calculate percentage based on displayed dimensions
    const xPercent = (locationX / mapDimensions.width) * 100;
    const yPercent = (locationY / mapDimensions.height) * 100;

    // Clamp values between 0 and 100
    const clampedX = Math.max(0, Math.min(100, xPercent));
    const clampedY = Math.max(0, Math.min(100, yPercent));

    setFormData((prev) => ({
      ...prev,
      map_x: clampedX.toFixed(2),
      map_y: clampedY.toFixed(2),
    }));
  };

  const clearPosition = () => {
    setFormData((prev) => ({
      ...prev,
      map_x: '',
      map_y: '',
    }));
  };

  const zoomIn = () => setMapZoom((prev) => Math.min(prev + 0.25, 5));
  const zoomOut = () => setMapZoom((prev) => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setMapZoom(3);
  const increaseDotSize = () => setDotSize((prev) => Math.min(prev + 2, 30));
  const decreaseDotSize = () => setDotSize((prev) => Math.max(prev - 2, 4));

  const handleSubmit = async () => {
    if (!formData.node_code || !formData.name || !formData.building || !formData.floor_level) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        floor_level: parseInt(formData.floor_level),
        map_x: formData.map_x ? parseFloat(formData.map_x) : null,
        map_y: formData.map_y ? parseFloat(formData.map_y) : null,
      };

      if (image360) {
        payload.image360_base64 = image360.base64;
      }

      if (formData.annotation !== '') {
        payload.annotation = parseFloat(formData.annotation);
      } else {
        payload.annotation = null;
      }

      let response;
      if (isEdit) {
        response = await ApiService.updateNode(node.node_id, payload);
      } else {
        response = await ApiService.createNode(payload);
      }

      if (response.success) {
        Alert.alert(
          'Success',
          `Node ${isEdit ? 'updated' : 'created'} successfully`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', response.error || 'Operation failed');
      }
    } catch (error) {
      if (error.sessionExpired || error.error === 'Session expired') {
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        Alert.alert(
          'Upload Timed Out',
          'The image upload took too long. Try a smaller image or check your connection.',
        );
      } else {
        Alert.alert('Error', error.error || error.message || 'Failed to save node');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSelectedTypeLabel = () => {
    const type = NODE_TYPES.find((t) => t.value === formData.type_of_node);
    return type ? type.label : 'Select Type';
  };

  const renderMarkerOnMap = () => {
    if (!formData.map_x || !formData.map_y || !mapDimensions.width) return null;

    const x = (parseFloat(formData.map_x) / 100) * mapDimensions.width;
    const y = (parseFloat(formData.map_y) / 100) * mapDimensions.height;

    // Scale dot inversely with zoom — same logic as MapDisplayScreen
    const scaledRadius = Math.max(4, dotSize / mapZoom);
    const diameter = scaledRadius * 2;
    const borderW = Math.max(1, 3 / mapZoom);
    const innerSize = scaledRadius * 0.75;

    return (
      <View
        style={[
          styles.mapMarker,
          {
            left: x - scaledRadius,
            top: y - scaledRadius,
            width: diameter,
            height: diameter,
            borderRadius: scaledRadius,
            borderWidth: borderW,
          },
        ]}
      >
        <View
          style={[
            styles.mapMarkerInner,
            { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
          ]}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? '✏️ Edit Node' : '➕ Add Node'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📋</Text>
            <View>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              <Text style={styles.sectionSubtitle}>Essential details about this node</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Node Code <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.node_code}
              placeholder="Auto-generated"
              placeholderTextColor="#999"
              editable={false}
            />
            <Text style={styles.hint}>Auto-generated unique identifier (Date-Time based)</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(value) => handleChange('name', value)}
              placeholder="e.g., Computer Lab 1"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Building <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={formData.building}
              onChangeText={(value) => handleChange('building', value)}
              placeholder="e.g., Engineering Building"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Floor Level <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={formData.floor_level}
              onChangeText={(value) => handleChange('floor_level', value)}
              placeholder="e.g., 1"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            <Text style={styles.hint}>Use negative numbers for basement levels</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Node Type</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTypePicker(true)}>
              <Text style={styles.pickerButtonText}>{getSelectedTypeLabel()}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => handleChange('description', value)}
              placeholder="Additional information..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Media Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🖼️</Text>
            <View>
              <Text style={styles.sectionTitle}>Media & Images</Text>
              <Text style={styles.sectionSubtitle}>360° panorama image for this location</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
            <Text style={styles.imagePickerIcon}>�</Text>
            <Text style={styles.imagePickerText}>
              {image360 ? 'Change 360° Image' : 'Select 360° Image'}
            </Text>
          </TouchableOpacity>

          {image360 && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: image360.uri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageButton} onPress={() => setImage360(null)}>
                <Text style={styles.removeImageText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {isEdit && existingImageUrl && !image360 && (
            <View style={styles.currentImageInfo}>
              <Text style={styles.currentImageText}>✓ Current 360° image will be kept</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Initial View Angle (0–360°)</Text>
            <TextInput
              style={styles.input}
              value={formData.annotation}
              onChangeText={(value) => handleChange('annotation', value)}
              placeholder="e.g., 90  (facing East)"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>The angle in the 360° image where this room entrance faces (0 = North, 90 = East, 180 = South, 270 = West)</Text>
          </View>
        </View>

        {/* Map Position Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🗺️</Text>
            <View>
              <Text style={styles.sectionTitle}>Map Position</Text>
              <Text style={styles.sectionSubtitle}>Tap on the map to set the node location</Text>
            </View>
          </View>

          <View style={styles.positionDisplay}>
            <Text style={styles.positionText}>
              {formData.map_x && formData.map_y
                ? `📍 Position: ${parseFloat(formData.map_x).toFixed(1)}%, ${parseFloat(formData.map_y).toFixed(1)}%`
                : '📍 No position set - tap map below'}
            </Text>
            {formData.map_x && formData.map_y && (
              <TouchableOpacity style={styles.clearButton} onPress={clearPosition}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {campusMap ? (
            <TouchableOpacity style={styles.openMapButton} onPress={() => setShowMapModal(true)}>
              <SvgMap width={SCREEN_WIDTH - 70} height={200} style={styles.mapThumbnail} />
              <View style={styles.openMapOverlay}>
                <Text style={styles.openMapText}>👆 Tap to Open Map & Set Position</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.noMapContainer}>
              <Text style={styles.noMapIcon}>⚠️</Text>
              <Text style={styles.noMapText}>No campus map available. Upload one in the web admin panel.</Text>
              <View style={styles.manualCoordinates}>
                <Text style={styles.manualLabel}>Enter coordinates manually:</Text>
                <View style={styles.coordinatesRow}>
                  <View style={styles.coordinateField}>
                    <Text style={styles.coordinateLabel}>X (0-100%)</Text>
                    <TextInput
                      style={styles.coordinateInput}
                      value={formData.map_x}
                      onChangeText={(value) => handleChange('map_x', value)}
                      placeholder="X"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.coordinateField}>
                    <Text style={styles.coordinateLabel}>Y (0-100%)</Text>
                    <TextInput
                      style={styles.coordinateInput}
                      value={formData.map_y}
                      onChangeText={(value) => handleChange('map_y', value)}
                      placeholder="Y"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? '⏳ Saving...' : isEdit ? '💾 Update Node' : '✨ Create Node'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Map Selection Modal */}
      <Modal visible={showMapModal} animationType="slide" onRequestClose={() => setShowMapModal(false)}>
        <SafeAreaView style={styles.mapModalContainer}>
          <View style={styles.mapModalHeader}>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Text style={styles.mapModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.mapModalTitle}>Set Node Position</Text>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Text style={styles.mapModalDone}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapPositionInfo}>
            <Text style={styles.mapPositionText}>
              {formData.map_x && formData.map_y
                ? `📍 X: ${parseFloat(formData.map_x).toFixed(2)}% | Y: ${parseFloat(formData.map_y).toFixed(2)}%`
                : '👆 Tap on the map to set position'}
            </Text>
          </View>

          <View style={styles.zoomControls}>
            {/* Zoom row */}
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Zoom</Text>
              <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
                <Text style={styles.zoomButtonText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomButton} onPress={resetZoom}>
                <Text style={styles.zoomButtonTextSmall}>{Math.round(mapZoom * 100)}%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
                <Text style={styles.zoomButtonText}>+</Text>
              </TouchableOpacity>
              {formData.map_x && formData.map_y && (
                <TouchableOpacity style={styles.clearPositionButton} onPress={clearPosition}>
                  <Text style={styles.clearPositionText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Dot size row */}
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Dot</Text>
              <TouchableOpacity style={styles.zoomButton} onPress={decreaseDotSize}>
                <Text style={styles.zoomButtonText}>−</Text>
              </TouchableOpacity>
              <View style={styles.zoomButton}>
                <Text style={styles.zoomButtonTextSmall}>{dotSize}px</Text>
              </View>
              <TouchableOpacity style={styles.zoomButton} onPress={increaseDotSize}>
                <Text style={styles.zoomButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.mapScrollView}
            contentContainerStyle={styles.mapScrollContent}
            horizontal={false}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={true}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.mapHorizontalContent}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleMapPress}
                style={styles.mapImageContainer}
              >
                {campusMap && (
                  <SvgMap
                    width={(SCREEN_WIDTH - 40) * mapZoom}
                    height={(SCREEN_WIDTH - 40) * mapZoom}
                    onLayout={handleMapLayout}
                  />
                )}
                {!mapLoading && renderMarkerOnMap()}
              </TouchableOpacity>
            </ScrollView>
          </ScrollView>

          <View style={styles.mapInstructions}>
            <Text style={styles.mapInstructionsText}>
              💡 Tap anywhere on the map to place the node marker. Use zoom controls for precision.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Node Type Picker Modal */}
      <Modal visible={showTypePicker} transparent={true} animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
        <TouchableOpacity style={styles.pickerModalOverlay} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>Select Node Type</Text>
            {NODE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.pickerOption, formData.type_of_node === type.value && styles.pickerOptionSelected]}
                onPress={() => { handleChange('type_of_node', type.value); setShowTypePicker(false); }}
              >
                <Text style={styles.pickerOptionText}>{type.label}</Text>
                {formData.type_of_node === type.value && <Text style={styles.pickerOptionCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: THEME_COLORS.primary },
  backButton: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  placeholder: { width: 60 },
  content: { flex: 1, padding: 15 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 2, borderBottomColor: '#F0F0F0' },
  sectionIcon: { fontSize: 24, marginRight: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#2C3E50' },
  sectionSubtitle: { fontSize: 13, color: '#6C757D', marginTop: 2 },
  field: { marginBottom: 15 },
  label: { fontSize: 15, fontWeight: '600', color: '#2C3E50', marginBottom: 8 },
  required: { color: '#E74C3C' },
  hint: { fontSize: 12, color: '#6C757D', marginTop: 5 },
  input: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 8, fontSize: 16, borderWidth: 2, borderColor: '#E0E0E0', color: '#2C3E50' },
  inputDisabled: { backgroundColor: '#F5F5F5', color: '#999' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  pickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 8, borderWidth: 2, borderColor: '#E0E0E0' },
  pickerButtonText: { fontSize: 16, color: '#2C3E50' },
  pickerArrow: { fontSize: 12, color: '#6C757D' },
  imagePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME_COLORS.secondary, padding: 18, borderRadius: 10, gap: 10 },
  imagePickerIcon: { fontSize: 24 },
  imagePickerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  imagePreviewContainer: { marginTop: 15, position: 'relative' },
  imagePreview: { width: '100%', height: 200, borderRadius: 10 },
  removeImageButton: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.7)', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  removeImageText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  currentImageInfo: { marginTop: 15, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8 },
  currentImageText: { color: '#2E7D32', fontSize: 14 },
  positionDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 8, marginBottom: 15 },
  positionText: { fontSize: 14, color: THEME_COLORS.primary, fontWeight: '600' },
  clearButton: { backgroundColor: '#E74C3C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },
  clearButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  openMapButton: { position: 'relative', borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#E0E0E0' },
  mapThumbnail: { width: '100%', height: 200 },
  openMapOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, alignItems: 'center' },
  openMapText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  noMapContainer: { backgroundColor: '#FFF9E6', padding: 20, borderRadius: 10, alignItems: 'center' },
  noMapIcon: { fontSize: 40, marginBottom: 10 },
  noMapText: { fontSize: 14, color: '#856404', textAlign: 'center', lineHeight: 20 },
  manualCoordinates: { width: '100%', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F0D77E' },
  manualLabel: { fontSize: 14, fontWeight: '600', color: '#856404', marginBottom: 10 },
  coordinatesRow: { flexDirection: 'row', gap: 15 },
  coordinateField: { flex: 1 },
  coordinateLabel: { fontSize: 12, color: '#6C757D', marginBottom: 5 },
  coordinateInput: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0' },
  submitButton: { backgroundColor: THEME_COLORS.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 5, shadowColor: THEME_COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitButtonDisabled: { backgroundColor: '#CCCCCC', shadowOpacity: 0 },
  submitButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  bottomSpacer: { height: 30 },
  mapModalContainer: { flex: 1, backgroundColor: '#1F0F0F' },
  mapModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#2D1114' },
  mapModalCancel: { color: '#FF6B6B', fontSize: 16, fontWeight: '600' },
  mapModalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  mapModalDone: { color: '#D4A843', fontSize: 16, fontWeight: '600' },
  mapPositionInfo: { backgroundColor: '#2D1114', padding: 12, alignItems: 'center' },
  mapPositionText: { color: '#D4A843', fontSize: 14, fontWeight: '600' },
  zoomControls: { flexDirection: 'column', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#2D1114', gap: 6 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlLabel: { color: '#A0AEC0', fontSize: 12, fontWeight: '600', width: 34, textAlign: 'right' },
  zoomButton: { width: 50, height: 40, backgroundColor: '#3D1518', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D4A843' },
  zoomButtonText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  zoomButtonTextSmall: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  clearPositionButton: { paddingHorizontal: 15, height: 40, backgroundColor: '#E74C3C', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  clearPositionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  mapScrollView: { flex: 1 },
  mapScrollContent: { flexGrow: 1 },
  mapHorizontalContent: { flexGrow: 1 },
  mapImageContainer: { position: 'relative' },
  mapImage: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40 },
  mapMarker: { position: 'absolute', width: 24, height: 24, backgroundColor: THEME_COLORS.primary, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5 },
  mapMarkerInner: { width: 10, height: 10, backgroundColor: '#FFFFFF', borderRadius: 5 },
  mapInstructions: { backgroundColor: '#2D1114', padding: 15 },
  mapInstructionsText: { color: '#CCCCCC', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  pickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerModalContent: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 20, width: '100%', maxWidth: 350 },
  pickerModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center', marginBottom: 15 },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 10, marginBottom: 8, backgroundColor: '#F8F9FA' },
  pickerOptionSelected: { backgroundColor: '#F5E6E6', borderWidth: 2, borderColor: THEME_COLORS.primary },
  pickerOptionText: { fontSize: 16, color: '#2C3E50' },
  pickerOptionCheck: { fontSize: 18, color: THEME_COLORS.primary, fontWeight: 'bold' },
});

export default NodeFormScreen;
