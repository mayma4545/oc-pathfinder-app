/**
 * Offline Settings Screen - Comprehensive offline data management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../config';
import OfflineService from '../services/OfflineService';
import SyncManager from '../services/SyncManager';
import { useDownload } from '../contexts/DownloadContext';

const OfflineSettingsScreen = ({ navigation }) => {
  const { downloadProgress, offlineStats, refreshStats, startDownload, clearCache } = useDownload();
  
  const [autoSync, setAutoSync] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  const [pathfindingAvailable, setPathfindingAvailable] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPathfindingAvailability();

    const unsubscribe = SyncManager.subscribe(setSyncStatus);
    return () => unsubscribe();
  }, []);

  const loadSettings = async () => {
    const autoSyncEnabled = await SyncManager.isAutoSyncEnabled();
    const wifiOnlyEnabled = await SyncManager.isWifiOnlySync();
    setAutoSync(autoSyncEnabled);
    setWifiOnly(wifiOnlyEnabled);
  };

  const checkPathfindingAvailability = async () => {
    const available = await OfflineService.isPathfindingAvailable();
    setPathfindingAvailable(available);
  };

  const handleAutoSyncChange = async (value) => {
    setAutoSync(value);
    await SyncManager.setAutoSyncEnabled(value);
  };

  const handleWifiOnlyChange = async (value) => {
    setWifiOnly(value);
    await SyncManager.setWifiOnlySync(value);
  };

  const handleCheckUpdates = async () => {
    Alert.alert(
      'Sync Data',
      'Check for and download any new nodes, edges, or images from the server?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sync Now', 
          onPress: async () => {
            const result = await SyncManager.checkForUpdates();
            if (result.success) {
              await refreshStats();
              await checkPathfindingAvailability();
              
              if (result.hasUpdates) {
                Alert.alert(
                  '✅ Sync Complete',
                  `Updated successfully!\n\n` +
                  `New nodes: ${result.newNodes || 0}\n` +
                  `New images: ${result.newImages || 0}`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  '✅ Already Up to Date',
                  'Your offline data is current with the server.',
                  [{ text: 'OK' }]
                );
              }
            } else {
              Alert.alert(
                '❌ Sync Failed',
                result.error || 'Failed to check for updates. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        },
      ]
    );
  };

  const handleDownloadAll = () => {
    Alert.alert(
      'Download Offline Data',
      'This will download all map data and 360° images for offline use. This may use significant data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Download', 
          onPress: async () => {
            await startDownload();
            await checkPathfindingAvailability();
          }
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Offline Data',
      'This will delete all cached maps and images. You will need to download them again for offline use.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await clearCache();
            await checkPathfindingAvailability();
          }
        },
      ]
    );
  };

  const handleVerifyPathfinding = async () => {
    Alert.alert(
      '🔍 Verifying Pathfinding',
      'Checking offline navigation capabilities...',
      [{ text: 'OK' }]
    );

    try {
      const result = await OfflineService.verifyPathfinding();
      
      if (result.success) {
        Alert.alert(
          '✅ Pathfinding Ready',
          `Offline navigation is working!\n\n` +
          `• Nodes: ${result.nodesCount}\n` +
          `• Edges: ${result.edgesCount}\n` +
          `• Status: ${result.message}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Pathfinding Issue',
          `Problem detected:\n${result.error}\n\n` +
          `Nodes: ${result.nodesCount || 0}\n` +
          `Edges: ${result.edgesCount || 0}\n\n` +
          `Please try downloading offline data again.`,
          [{ text: 'OK' }]
        );
      }
      
      // Refresh the status
      await checkPathfindingAvailability();
    } catch (error) {
      Alert.alert(
        'Error',
        `Failed to verify pathfinding: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  const formatLastSync = () => {
    if (!offlineStats.lastSync) return 'Never';
    return new Date(offlineStats.lastSync).toLocaleString();
  };

  const isDownloading = downloadProgress.status === 'downloading';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Offline Settings</Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Offline Mode</Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: offlineStats.offlineEnabled ? THEME_COLORS.success : '#ccc' }
            ]}>
              <Text style={styles.statusBadgeText}>
                {offlineStats.offlineEnabled ? 'Ready' : 'Not Set Up'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Offline Navigation</Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: pathfindingAvailable ? THEME_COLORS.success : '#ccc' }
            ]}>
              <Text style={styles.statusBadgeText}>
                {pathfindingAvailable ? 'Available' : 'Unavailable'}
              </Text>
            </View>
          </View>

          <Text style={styles.lastSync}>Last synced: {formatLastSync()}</Text>
        </View>

        {/* Download Progress */}
        {isDownloading && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator color={THEME_COLORS.primary} />
              <Text style={styles.progressTitle}>Downloading...</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${downloadProgress.percentage}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {downloadProgress.currentItem} ({downloadProgress.percentage}%)
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cached Data</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{offlineStats.nodesCount}</Text>
              <Text style={styles.statLabel}>Locations</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{offlineStats.edgesCount}</Text>
              <Text style={styles.statLabel}>Paths</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{offlineStats.imagesCount}</Text>
              <Text style={styles.statLabel}>Images</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{offlineStats.cacheSize}</Text>
              <Text style={styles.statLabel}>Storage</Text>
            </View>
          </View>
        </View>

        {/* Sync Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-sync</Text>
              <Text style={styles.settingDesc}>Automatically check for updates when online</Text>
            </View>
            <Switch
              value={autoSync}
              onValueChange={handleAutoSyncChange}
              trackColor={{ false: '#ccc', true: THEME_COLORS.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>WiFi Only</Text>
              <Text style={styles.settingDesc}>Only sync when connected to WiFi</Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={handleWifiOnlyChange}
              trackColor={{ false: '#ccc', true: THEME_COLORS.primary }}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={handleCheckUpdates}
            disabled={isDownloading || syncStatus.status === 'syncing'}
          >
            <Text style={styles.actionBtnIcon}>🔄</Text>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnText}>Check for Updates</Text>
              <Text style={styles.actionBtnDesc}>Download new locations and paths</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={handleDownloadAll}
            disabled={isDownloading}
          >
            <Text style={styles.actionBtnIcon}>📥</Text>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnText}>Download All Data</Text>
              <Text style={styles.actionBtnDesc}>Full download including all images</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={handleVerifyPathfinding}
            disabled={isDownloading || !pathfindingAvailable}
          >
            <Text style={styles.actionBtnIcon}>🔍</Text>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnText}>Verify Navigation</Text>
              <Text style={styles.actionBtnDesc}>Test offline pathfinding engine</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.dangerBtn]}
            onPress={handleClearCache}
            disabled={isDownloading}
          >
            <Text style={styles.actionBtnIcon}>🗑️</Text>
            <View style={styles.actionBtnContent}>
              <Text style={[styles.actionBtnText, { color: THEME_COLORS.error }]}>
                Clear Offline Data
              </Text>
              <Text style={styles.actionBtnDesc}>Remove all cached data</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 About Offline Mode</Text>
          <Text style={styles.infoText}>
            When you download offline data, you can:
          </Text>
          <Text style={styles.infoBullet}>• Navigate without internet connection</Text>
          <Text style={styles.infoBullet}>• View 360° images offline</Text>
          <Text style={styles.infoBullet}>• Get directions between any locations</Text>
          <Text style={styles.infoText}>
            Data syncs automatically when you're back online (if enabled).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    fontSize: 16,
    color: THEME_COLORS.primary,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.text,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 15,
    color: THEME_COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  lastSync: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 8,
  },
  progressCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.primary,
    marginLeft: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#BBDEFB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME_COLORS.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME_COLORS.primary,
  },
  statLabel: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  settingDesc: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  primaryBtn: {
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLORS.primary,
  },
  dangerBtn: {
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLORS.error,
  },
  actionBtnIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionBtnContent: {
    flex: 1,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  actionBtnDesc: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME_COLORS.success,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
  infoBullet: {
    fontSize: 13,
    color: '#555',
    marginLeft: 8,
    lineHeight: 22,
  },
});

export default OfflineSettingsScreen;
