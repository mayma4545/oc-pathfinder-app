/**
 * Data Freshness Warning - Shows when offline data is stale
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { THEME_COLORS } from '../config';
import { checkDataFreshness } from '../utils/StorageUtils';

const DataFreshnessWarning = ({ onSync, onDismiss, style }) => {
  const [freshness, setFreshness] = useState(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  useEffect(() => {
    checkFreshness();
  }, []);

  const checkFreshness = async () => {
    const result = await checkDataFreshness();
    setFreshness(result);
    
    // Only show warning for medium or high severity
    if (result.severity === 'medium' || result.severity === 'high') {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  };

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  };

  if (!visible || !freshness) return null;

  const isHigh = freshness.severity === 'high';

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          backgroundColor: isHigh ? '#FFF3E0' : '#FFFDE7',
          borderLeftColor: isHigh ? THEME_COLORS.warning : '#FFC107',
          transform: [{ translateY: slideAnim }]
        },
        style
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{isHigh ? '⚠️' : '📅'}</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: isHigh ? THEME_COLORS.warning : '#F57C00' }]}>
            {isHigh ? 'Data May Be Outdated' : 'Sync Recommended'}
          </Text>
          <Text style={styles.message}>{freshness.message}</Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        {onSync && (
          <TouchableOpacity style={styles.syncButton} onPress={onSync}>
            <Text style={styles.syncButtonText}>Sync</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.dismissButton} onPress={dismiss}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  syncButton: {
    backgroundColor: THEME_COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
  dismissText: {
    fontSize: 16,
    color: '#999',
  },
});

export default DataFreshnessWarning;
