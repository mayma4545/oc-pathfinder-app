import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME_COLORS, APP_CONFIG } from '../config';
import ApiService from '../services/ApiService';
import OfflineService from '../services/OfflineService';

const WelcomeScreen = ({ navigation }) => {
  const timerRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState({
    checking: true,
    connected: false,
    message: 'Checking server connection...',
    canContinue: false,
    offlineAvailable: false,
  });

  useEffect(() => {
    const startupCheck = async () => {
      // Check if we already have data
      const hasData = await OfflineService.isPathfindingAvailable();
      const initialDownloadDone = await AsyncStorage.getItem('HAS_INITIAL_DOWNLOAD');
      
      if (hasData && initialDownloadDone === 'true') {
        // Data exists, skip welcome screen
        navigation.replace('PointSelection');
        return;
      }
      
      // No data or flag missing, proceed with regular flow
      checkServerConnection();
    };

    startupCheck();
  }, [navigation]);

  const checkServerConnection = async () => {
    try {
      setConnectionStatus({
        checking: true,
        connected: false,
        message: 'Checking server connection...',
        canContinue: false,
        offlineAvailable: false,
      });

      // Try to fetch nodes to verify server is reachable
      const response = await Promise.race([
        ApiService.getNodes(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        )
      ]);

      if (response.success && !response.offline) {
        // Server is reachable
        setConnectionStatus({
          checking: false,
          connected: true,
          message: 'Connected to server ✓',
          canContinue: true,
          offlineAvailable: false,
        });

        // Auto-navigate after 2 seconds if connected
        timerRef.current = setTimeout(() => {
          navigation.replace('PointSelection');
        }, 2000);
      } else {
        // Offline mode detected
        await handleOfflineMode();
      }
    } catch (error) {
      console.log('Server connection check failed:', error.message);
      await handleOfflineMode();
    }
  };

  const handleOfflineMode = async () => {
    // Check if offline data is available
    const offlineAvailable = await OfflineService.isPathfindingAvailable();
    
    setConnectionStatus({
      checking: false,
      connected: false,
      message: offlineAvailable 
        ? 'Server unavailable - Offline mode available'
        : 'Server unavailable - No offline data',
      canContinue: true,
      offlineAvailable: offlineAvailable,
    });
  };

  const handleGetStarted = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    if (!connectionStatus.canContinue) {
      return;
    }
    
    navigation.replace('PointSelection');
  };

  const handleAdminLogin = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    navigation.navigate('Login');
  };

  return (
    <LinearGradient
      colors={[THEME_COLORS.primary, THEME_COLORS.secondary]}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>📍</Text>
          </View>
        </View>

        {/* App Name */}
        <Text style={styles.title}>{APP_CONFIG.APP_NAME}</Text>
        <Text style={styles.subtitle}>Navigate Your Campus with Ease</Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem icon="🗺️" text="Interactive Campus Map" />
          <FeatureItem icon="🎯" text="Smart Pathfinding" />
          <FeatureItem icon="📷" text="360° Room Views" />
        </View>

        {/* Connection Status */}
        <View style={styles.connectionStatusContainer}>
          {connectionStatus.checking ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.connectionStatusText}>{connectionStatus.message}</Text>
            </>
          ) : (
            <>
              <Text style={[
                styles.connectionStatusText,
                connectionStatus.connected ? styles.connectedText : styles.disconnectedText
              ]}>
                {connectionStatus.connected ? '🟢' : connectionStatus.offlineAvailable ? '🟡' : '🔴'} {connectionStatus.message}
              </Text>
              {!connectionStatus.connected && !connectionStatus.offlineAvailable && (
                <Text style={styles.connectionHint}>
                  Please check your internet connection or contact support
                </Text>
              )}
            </>
          )}
        </View>

        {/* Get Started Button */}
        <TouchableOpacity
          style={[
            styles.button,
            (!connectionStatus.canContinue || connectionStatus.checking) && styles.buttonDisabled
          ]}
          onPress={handleGetStarted}
          activeOpacity={0.8}
          disabled={!connectionStatus.canContinue || connectionStatus.checking}
        >
          <Text style={styles.buttonText}>
            {connectionStatus.checking ? 'Please Wait...' : 'Get Started'}
          </Text>
        </TouchableOpacity>

        {/* Admin Login Button */}
        <TouchableOpacity
          style={styles.adminButton}
          onPress={handleAdminLogin}
          activeOpacity={0.8}
        >
          <Text style={styles.adminButtonText}>🔐 Admin Login</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>v{APP_CONFIG.VERSION}</Text>
      </View>
    </LinearGradient>
  );
};

const FeatureItem = ({ icon, text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  logoText: {
    fontSize: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 50,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 50,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  featureIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  featureText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 50,
    paddingVertical: 15,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginBottom: 15,
  },
  buttonText: {
    color: THEME_COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  adminButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    position: 'absolute',
    bottom: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  connectionStatusContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  connectionStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  connectedText: {
    fontWeight: '600',
  },
  disconnectedText: {
    fontWeight: '600',
  },
  connectionHint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default WelcomeScreen;
