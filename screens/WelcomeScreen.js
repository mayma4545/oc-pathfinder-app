import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME_COLORS, APP_CONFIG } from '../config';

const WelcomeScreen = ({ navigation }) => {
  const timerRef = useRef(null);

  useEffect(() => {
    // Auto-navigate after 3 seconds
    timerRef.current = setTimeout(() => {
      navigation.replace('PointSelection');
    }, 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [navigation]);

  const handleGetStarted = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
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

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
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
});

export default WelcomeScreen;
