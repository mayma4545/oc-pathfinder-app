import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../config';
import ApiService from '../../services/ApiService';
import { useFocusEffect } from '@react-navigation/native';

const NodesListScreen = ({ navigation }) => {
  const [nodes, setNodes] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadNodes();
    }, [])
  );

  useEffect(() => {
    filterNodes();
  }, [searchQuery, nodes]);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getNodes();
      if (response.success) {
        setNodes(response.nodes);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load nodes');
    } finally {
      setLoading(false);
    }
  };

  const filterNodes = () => {
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
  };

  const handleDelete = (node) => {
    Alert.alert(
      'Delete Node',
      `Are you sure you want to delete "${node.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteNode(node.node_id);
              Alert.alert('Success', 'Node deleted successfully');
              loadNodes();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete node');
            }
          },
        },
      ]
    );
  };

  const renderNodeItem = ({ item }) => (
    <View style={styles.nodeItem}>
      <View style={styles.nodeInfo}>
        <Text style={styles.nodeName}>{item.name}</Text>
        <Text style={styles.nodeCode}>{item.node_code}</Text>
        <Text style={styles.nodeDetails}>
          {item.building} • Floor {item.floor_level} • {item.type_of_node}
        </Text>
      </View>
      <View style={styles.nodeActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('NodeForm', { node: item })}
        >
          <Text style={styles.editButtonText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Nodes</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search nodes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('NodeForm', { node: null })}
      >
        <Text style={styles.addButtonText}>+ Add New Node</Text>
      </TouchableOpacity>

      {/* Nodes List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredNodes}
          renderItem={renderNodeItem}
          keyExtractor={(item) => item.node_id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No nodes found</Text>
            </View>
          }
        />
      )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
  addButton: {
    backgroundColor: THEME_COLORS.primary,
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 15,
  },
  nodeItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  nodeCode: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    marginBottom: 5,
  },
  nodeDetails: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  nodeActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 10,
    marginRight: 5,
  },
  editButtonText: {
    fontSize: 20,
  },
  deleteButton: {
    padding: 10,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
});

export default NodesListScreen;
