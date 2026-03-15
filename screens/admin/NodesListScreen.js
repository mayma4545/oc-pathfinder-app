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

const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Date Added', value: 'date' },
  { label: 'Building Name', value: 'building' },
];

const PAGE_SIZE = 15;

const NodesListScreen = ({ navigation }) => {
  const [nodes, setNodes] = useState([]);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useFocusEffect(
    useCallback(() => {
      loadNodes();
    }, [])
  );

  useEffect(() => {
    filterAndSortNodes();
    setCurrentPage(1); // Reset to first page on filter/sort change
  }, [searchQuery, nodes, sortBy, sortDir]);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getNodes({ _ts: Date.now() });
      if (response.success) {
        setNodes(response.nodes);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load nodes');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortNodes = () => {
    let result = [...nodes];

    // Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (node) =>
          node.name.toLowerCase().includes(q) ||
          (node.building && node.building.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortBy === 'date') {
        valA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valB = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else if (sortBy === 'building') {
        valA = (a.building || '').toLowerCase();
        valB = (b.building || '').toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredNodes(result);
  };

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredNodes.length / PAGE_SIZE));
  const pagedNodes = filteredNodes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSortSelect = (value) => {
    setSortBy(value);
    setDropdownOpen(false);
  };

  const toggleSortDir = () => {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown date';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
        <Text style={styles.nodeDate}>📅 Added: {formatDate(item.created_at)}</Text>
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

  const renderPagination = () => {
    if (filteredNodes.length === 0) return null;

    // Build visible page numbers (show at most 5 around current)
    const pageNumbers = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pageNumbers.push(i);

    return (
      <View style={styles.paginationWrapper}>
        {/* Info text */}
        <Text style={styles.paginationInfo}>
          {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredNodes.length)} of {filteredNodes.length}
        </Text>

        <View style={styles.paginationControls}>
          {/* First */}
          <TouchableOpacity
            style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
            onPress={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>«</Text>
          </TouchableOpacity>

          {/* Prev */}
          <TouchableOpacity
            style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>‹</Text>
          </TouchableOpacity>

          {/* Page numbers */}
          {pageNumbers.map((page) => (
            <TouchableOpacity
              key={page}
              style={[styles.pageBtn, page === currentPage && styles.pageBtnActive]}
              onPress={() => setCurrentPage(page)}
            >
              <Text style={[styles.pageBtnText, page === currentPage && styles.pageBtnTextActive]}>
                {page}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Next */}
          <TouchableOpacity
            style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
            onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>›</Text>
          </TouchableOpacity>

          {/* Last */}
          <TouchableOpacity
            style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
            onPress={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>»</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Name';

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

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <View style={styles.sortDropdownWrapper}>
          <TouchableOpacity
            style={styles.sortDropdownButton}
            onPress={() => setDropdownOpen((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.sortDropdownButtonText}>{currentSortLabel}</Text>
            <Text style={styles.sortDropdownArrow}>
              {dropdownOpen ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {dropdownOpen && (
            <View style={styles.dropdownMenu}>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    sortBy === option.value && styles.dropdownItemActive,
                  ]}
                  onPress={() => handleSortSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      sortBy === option.value && styles.dropdownItemTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {sortBy === option.value && (
                    <Text style={styles.dropdownItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.sortDirButton}
          onPress={toggleSortDir}
          activeOpacity={0.8}
        >
          <Text style={styles.sortDirText}>
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </Text>
        </TouchableOpacity>
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
          data={pagedNodes}
          renderItem={renderNodeItem}
          keyExtractor={(item) => item.node_id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No nodes found</Text>
            </View>
          }
          ListFooterComponent={renderPagination}
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
    marginBottom: 8,
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

  /* Sort Bar */
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
    zIndex: 100,
  },
  sortLabel: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginRight: 8,
    fontWeight: '500',
  },
  sortDropdownWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  sortDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.primary,
    gap: 6,
  },
  sortDropdownButtonText: {
    fontSize: 13,
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
  sortDropdownArrow: {
    fontSize: 10,
    color: THEME_COLORS.primary,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 36,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 8,
    minWidth: 150,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemActive: {
    backgroundColor: '#F0F4FF',
  },
  dropdownItemText: {
    fontSize: 14,
    color: THEME_COLORS.text,
  },
  dropdownItemTextActive: {
    color: THEME_COLORS.primary,
    fontWeight: '700',
  },
  dropdownItemCheck: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    marginLeft: 8,
  },
  sortDirButton: {
    marginLeft: 8,
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  sortDirText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
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
    paddingTop: 5,
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
    marginBottom: 4,
  },
  nodeDate: {
    fontSize: 12,
    color: THEME_COLORS.primary,
    marginBottom: 4,
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

  /* Pagination */
  paginationWrapper: {
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  paginationInfo: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    fontWeight: '500',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageBtn: {
    minWidth: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  pageBtnActive: {
    backgroundColor: THEME_COLORS.primary,
    borderColor: THEME_COLORS.primary,
  },
  pageBtnDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  pageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  pageBtnTextActive: {
    color: '#FFFFFF',
  },
  pageBtnTextDisabled: {
    color: '#C0C0C0',
  },
});

export default NodesListScreen;
