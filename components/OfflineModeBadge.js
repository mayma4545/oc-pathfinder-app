/**
 * Offline Mode Badge - Shows when using offline data
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME_COLORS } from '../config';

const OfflineModeBadge = ({ isOffline, onPress, style }) => {
  if (!isOffline) return null;

  return (
    <TouchableOpacity 
      style={[styles.badge, style]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>📴</Text>
      <Text style={styles.text}>Offline Route</Text>
    </TouchableOpacity>
  );
};

/**
 * Detailed offline info card
 */
export const OfflineInfoCard = ({ 
  isVisible, 
  lastSync, 
  nodesCount, 
  edgesCount,
  onDismiss,
  onSync 
}) => {
  if (!isVisible) return null;

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <Text style={styles.infoTitle}>📴 Using Offline Data</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.infoText}>
        This route was calculated using cached data from your device.
      </Text>
      
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{nodesCount || 0}</Text>
          <Text style={styles.statLabel}>Locations</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{edgesCount || 0}</Text>
          <Text style={styles.statLabel}>Paths</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDate(lastSync)}</Text>
          <Text style={styles.statLabel}>Last Sync</Text>
        </View>
      </View>

      {onSync && (
        <TouchableOpacity style={styles.syncBtn} onPress={onSync}>
          <Text style={styles.syncBtnText}>🔄 Sync Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLORS.warning,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 12,
    marginRight: 4,
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  // Info Card styles
  infoCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLORS.warning,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B6914',
  },
  closeBtn: {
    fontSize: 18,
    color: '#999',
    padding: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E0C8',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OfflineModeBadge;
