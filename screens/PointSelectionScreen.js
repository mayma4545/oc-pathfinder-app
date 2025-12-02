import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS, APP_CONFIG } from '../config';
import ApiService from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';

const PointSelectionScreen = ({ navigation }) => {
  const { isAdmin, login } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectingType, setSelectingType] = useState(null); // 'start' or 'end'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin login modal
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tapCount, setTapCount] = useState(0);

  // Image quality settings
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [imageQuality, setImageQuality] = useState('sd'); // 'hd' or 'sd'

  useEffect(() => {
    loadNodes();
    loadImageQualitySetting();
  }, []);

  useEffect(() => {
    // Filter nodes based on search query
    if (searchQuery.trim() === '') {
      setFilteredNodes(nodes);
    } else {
      const filtered = nodes.filter(
        (node) =>
          node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.node_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.building.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredNodes(filtered);
    }
    console.log('Search query:', searchQuery, '| Filtered count:', filteredNodes.length, '| Total nodes:', nodes.length);
  }, [searchQuery, nodes]);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getNodes();
      console.log('Nodes response:', response);
      if (response.success) {
        setNodes(response.nodes);
        setFilteredNodes(response.nodes);
      } else {
        console.error('Failed to load nodes:', response);
        Alert.alert('Error', response.error || 'Failed to load nodes');
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

  const handleFindPath = () => {
    if (!startPoint || !endPoint) {
      Alert.alert('Error', 'Please select both starting point and destination');
      return;
    }

    if (startPoint.node_id === endPoint.node_id) {
      Alert.alert('Error', 'Starting point and destination cannot be the same');
      return;
    }

    navigation.navigate('MapDisplay', {
      startNode: startPoint,
      endNode: endPoint,
      imageQuality: imageQuality, // Pass image quality setting
    });
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
        <Text style={styles.selectIcon}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleTitleTap} activeOpacity={1}>
          <Text style={styles.headerTitle}>Find Your Way</Text>
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

            {/* Nodes List */}
            <FlatList
              data={filteredNodes}
              renderItem={renderNodeItem}
              keyExtractor={(item) => item.node_id.toString()}
              extraData={filteredNodes}
              style={styles.nodesList}
              contentContainerStyle={styles.nodesListContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {loading ? 'Loading nodes...' : 
                     searchQuery.trim() !== '' ? 'No matching nodes found' :
                     nodes.length === 0 ? 'No nodes available' : 'No nodes found'}
                  </Text>
                  {!loading && nodes.length === 0 && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={loadNodes}
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
          <View style={styles.settingsModalContent}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>360° Image Quality</Text>
              <TouchableOpacity
                onPress={() => setSettingsModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.settingsDescription}>
              Toggle HD mode for higher quality 360° images. SD (default) loads faster.
            </Text>

            {/* HD Toggle */}
            <TouchableOpacity
              style={styles.qualityToggleRow}
              onPress={() => saveImageQualitySetting(imageQuality === 'hd' ? 'sd' : 'hd')}
              activeOpacity={0.7}
              accessibilityLabel="Toggle HD Quality"
              accessibilityRole="switch"
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

            <TouchableOpacity
              style={styles.settingsCloseButton}
              onPress={() => setSettingsModalVisible(false)}
            >
              <Text style={styles.settingsCloseButtonText}>Done</Text>
            </TouchableOpacity>
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
    padding: 20,
    backgroundColor: THEME_COLORS.primary,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
});

export default PointSelectionScreen;
