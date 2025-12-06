/**
 * Network Status Banner - Shows online/offline status to users
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { THEME_COLORS } from '../config';

const NetworkStatusBanner = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useState(new Animated.Value(-50))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      setIsConnected(connected);
      
      if (!connected) {
        setShowBanner(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      } else if (showBanner) {
        // Show "Back online" briefly then hide
        setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: -50,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowBanner(false));
        }, 2000);
      }
    });

    return () => unsubscribe();
  }, [showBanner]);

  if (!showBanner) return null;

  return (
    <Animated.View 
      style={[
        styles.banner, 
        { 
          backgroundColor: isConnected ? THEME_COLORS.success : THEME_COLORS.warning,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Text style={styles.icon}>{isConnected ? '✓' : '📡'}</Text>
      <Text style={styles.text}>
        {isConnected ? 'Back online' : 'No internet - Using offline mode'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  icon: {
    fontSize: 14,
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default NetworkStatusBanner;
