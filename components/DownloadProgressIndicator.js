/**
 * Download Progress Indicator - Floating component that shows download progress
 * Displayed across all screens when downloading is in progress
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useDownload } from '../contexts/DownloadContext';
import { THEME_COLORS } from '../config';

const DownloadProgressIndicator = () => {
  const { downloadProgress, isDownloading, cancelDownload } = useDownload();

  if (!isDownloading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.infoSection}>
          <Text style={styles.title}>📥 Downloading...</Text>
          <Text style={styles.percentage}>{downloadProgress.percentage}%</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${downloadProgress.percentage}%` }
            ]} 
          />
        </View>
        
        <View style={styles.detailsRow}>
          <Text style={styles.currentItem} numberOfLines={1}>
            {downloadProgress.currentItem}
          </Text>
          <TouchableOpacity onPress={cancelDownload} style={styles.cancelButton}>
            <Text style={styles.cancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    zIndex: 1000,
    elevation: 10,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.primary,
  },
  percentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E8E8E8',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 3,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentItem: {
    flex: 1,
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginRight: 10,
  },
  cancelButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 12,
    color: THEME_COLORS.error,
    fontWeight: 'bold',
  },
});

export default DownloadProgressIndicator;
