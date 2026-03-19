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
import { THEME_COLORS } from '../../config';
import ApiService from '../../services/ApiService';
import { useFocusEffect } from '@react-navigation/native';
import AdminDrawerLayout from '../../components/AdminDrawerLayout';

const SORT_OPTIONS = [
  { label: 'Name (From Node)', value: 'name' },
  { label: 'Date Added', value: 'date' },
  { label: 'Building Name', value: 'building' },
];

const PAGE_SIZE = 15;

const EdgesListScreen = ({ navigation }) => {
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useFocusEffect(
    useCallback(() => {
      loadEdges();
    }, [])
  );

  // Reset to page 1 whenever search/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, edges, sortBy, sortDir]);

  const getSortedFilteredEdges = () => {
    let result = [...edges];

    // Filter
    if (searchQuery.trim() !== '') {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter((edge) => {
        const fromName = edge.from_node?.name?.toLowerCase() || '';
        const toName = edge.to_node?.name?.toLowerCase() || '';
        return fromName.includes(searchLower) || toName.includes(searchLower);
      });
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = (a.from_node?.name || '').toLowerCase();
        valB = (b.from_node?.name || '').toLowerCase();
      } else if (sortBy === 'date') {
        valA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valB = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else if (sortBy === 'building') {
        valA = (a.from_node?.building || '').toLowerCase();
        valB = (b.from_node?.building || '').toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  };

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
        <Text style={styles.edgeDate}>📅 Added: {formatDate(item.created_at)}</Text>
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

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Name';

  const allFilteredEdges = getSortedFilteredEdges();
  const totalPages = Math.max(1, Math.ceil(allFilteredEdges.length / PAGE_SIZE));
  const pagedEdges = allFilteredEdges.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const renderPagination = () => {
    if (allFilteredEdges.length === 0) return null;

    // Build visible page numbers (at most 5 around current)
    const pageNumbers = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pageNumbers.push(i);

    return (
      <View style={styles.paginationWrapper}>
        {/* Info text */}
        <Text style={styles.paginationInfo}>
          {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, allFilteredEdges.length)} of {allFilteredEdges.length}
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

  return (
    <AdminDrawerLayout
      title="Manage Edges"
      activeScreen="edges"
      rightElement={
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={() => navigation.navigate('EdgeForm')}
        >
          <Text style={styles.headerAddButtonText}>+ Add</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.container}>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search edges..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
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
            data={pagedEdges}
            renderItem={renderEdgeItem}
            keyExtractor={(item) => item.edge_id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No edges found</Text>
              </View>
            }
            ListFooterComponent={renderPagination}
          />
        )}
      </View>
    </AdminDrawerLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  headerAddButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  headerAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 10,
    paddingBottom: 6,
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

  /* Sort Bar */
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 8,
    zIndex: 1,
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
    minWidth: 180,
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

  infoBox: {
    backgroundColor: '#F5E6E6',
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
    marginBottom: 4,
  },
  edgeDate: {
    fontSize: 12,
    color: THEME_COLORS.primary,
    marginBottom: 4,
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

export default EdgesListScreen;
