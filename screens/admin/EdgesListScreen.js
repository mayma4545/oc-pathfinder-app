import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../config';
import ApiService from '../../services/ApiService';
import { useFocusEffect } from '@react-navigation/native';

const EdgesListScreen = ({ navigation }) => {
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadEdges();
    }, [])
  );

  const filteredEdges = edges.filter(edge => {
    const searchLower = searchQuery.toLowerCase();
    const fromName = edge.from_node?.name?.toLowerCase() || '';
    const toName = edge.to_node?.name?.toLowerCase() || '';
    return fromName.includes(searchLower) || toName.includes(searchLower);
  });

  const loadEdges = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getEdges();
      if (response.success) {
        setEdges(response.edges);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load edges');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (edge) => {
    Alert.alert(
      'Delete Edge',
      'Are you sure you want to delete this connection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteEdge(edge.edge_id);
              Alert.alert('Success', 'Edge deleted successfully');
              loadEdges();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete edge');
            }
          },
        },
      ]
    );
  };

  const renderEdgeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.edgeItem}
      onPress={() => navigation.navigate('EdgeForm', { edge: item })}
    >
      <View style={styles.edgeInfo}>
        <Text style={styles.edgeRoute}>
          {item.from_node.name} → {item.to_node.name}
        </Text>
        <Text style={styles.edgeDetails}>
          Distance: {item.distance}m • Angle: {item.compass_angle}°
          {item.is_staircase && ' • 🪜 Staircase'}
        </Text>
        <Text style={styles.edgeStatus}>
          Status: {item.is_active ? '✅ Active' : '❌ Inactive'}
        </Text>
      </View>
      <View style={styles.edgeActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EdgeForm', { edge: item })}
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Edges</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('EdgeForm')}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search edges..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Edges connect nodes and define possible paths. Tap + Add to create
          a new connection between nodes.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredEdges}
          renderItem={renderEdgeItem}
          keyExtractor={(item) => item.edge_id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No edges found</Text>
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
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 10,
    backgroundColor: THEME_COLORS.background,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLORS.primary,
  },
  infoText: {
    fontSize: 14,
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
  listContent: {
    padding: 15,
    paddingTop: 5,
  },
  edgeItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  edgeInfo: {
    flex: 1,
  },
  edgeRoute: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  edgeDetails: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginBottom: 3,
  },
  edgeStatus: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  edgeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  editButton: {
    padding: 10,
  },
  editButtonText: {
    fontSize: 18,
  },
  deleteButton: {
    padding: 10,
  },
  deleteButtonText: {
    fontSize: 18,
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

export default EdgesListScreen;
