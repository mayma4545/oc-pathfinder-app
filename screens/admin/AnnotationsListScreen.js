import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../config';
import ApiService from '../../services/ApiService';
import { useFocusEffect } from '@react-navigation/native';

const AnnotationsListScreen = ({ navigation }) => {
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAnnotations();
    }, [])
  );

  const loadAnnotations = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getAnnotations();
      if (response.success) {
        setAnnotations(response.annotations);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load annotations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (annotation) => {
    Alert.alert(
      'Delete Annotation',
      `Are you sure you want to delete "${annotation.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteAnnotation(annotation.id);
              Alert.alert('Success', 'Annotation deleted successfully');
              loadAnnotations();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete annotation');
            }
          },
        },
      ]
    );
  };

  const renderAnnotationItem = ({ item }) => (
    <View style={styles.annotationItem}>
      <View style={styles.annotationInfo}>
        <Text style={styles.annotationLabel}>{item.label}</Text>
        <Text style={styles.annotationPanorama}>
          Panorama: {item.panorama.name}
        </Text>
        {item.target_node && (
          <Text style={styles.annotationTarget}>
            Target: {item.target_node.name}
          </Text>
        )}
        <Text style={styles.annotationCoords}>
          Yaw: {item.yaw.toFixed(1)}° • Pitch: {item.pitch.toFixed(1)}°
        </Text>
        <Text style={styles.annotationStatus}>
          {item.is_active ? '✅ Active' : '❌ Inactive'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Annotations</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Annotations are labels on 360° panorama images. Use the web
          interface for detailed annotation management.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={annotations}
          renderItem={renderAnnotationItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No annotations found</Text>
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
  infoBox: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    margin: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLORS.warning,
  },
  infoText: {
    fontSize: 14,
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
  listContent: {
    padding: 15,
  },
  annotationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  annotationInfo: {
    flex: 1,
  },
  annotationLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  annotationPanorama: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginBottom: 3,
  },
  annotationTarget: {
    fontSize: 14,
    color: THEME_COLORS.primary,
    marginBottom: 3,
  },
  annotationCoords: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginBottom: 3,
  },
  annotationStatus: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
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

export default AnnotationsListScreen;
