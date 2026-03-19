import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Rect,
  Polygon,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import {
  useFonts,
  Montserrat_200ExtraLight,
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import {
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_COLORS, APP_CONFIG } from '../config';
import ApiService from '../services/ApiService';
import OfflineService from '../services/OfflineService';

// ── Color palette (from OSee splash screen) ──────────────────────────────────
const C = {
  maroon: '#6B0F1A',
  maroonDark: '#3D0009',
  maroonMid: '#8B1A2A',
  maroonLight: '#B03045',
  white: '#FAF7F2',
  black: '#0D0D0D',
  gold: '#C9A96E',
};

const { width: SW, height: SH } = Dimensions.get('window');
const RING_SIZE = 340;
const LOGO_SIZE = 90;

const WelcomeScreen = ({ navigation }) => {
  // ── Font loading ────────────────────────────────────────────────────────────
  const [fontsLoaded] = useFonts({
    Montserrat_200ExtraLight,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    CormorantGaramond_700Bold,
  });

  // ── Original utility state ──────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState({
    checking: true,
    connected: false,
    message: 'Checking server connection...',
    canContinue: false,
    offlineAvailable: false,
  });

  // ── Animation refs ──────────────────────────────────────────────────────────
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(-20)).current;
  const textY = useRef(new Animated.Value(20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagY = useRef(new Animated.Value(20)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const buildingY = useRef(new Animated.Value(40)).current;
  const buildingOp = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(20)).current;

  const particles = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
    }))
  ).current;

  // ── Loading state ───────────────────────────────────────────────────────────
  const [loadingText, setLoadingText] = useState('Initializing...');
  const [loadingTextOp, setLoadingTextOp] = useState(1);
  const [progressPct, setProgressPct] = useState(0);
  const [dotDone, setDotDone] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  // Use a ref to track the current progress percentage to avoid stale closures
  const currentPctRef = useRef(0);

  // ── Smooth animated progress helper (closure-safe) ──────────────────────────
  const animateProgressTo = useCallback((target, duration = 800) => {
    Animated.timing(progressAnim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Also update the text percentage using ref (not stale state)
    const startPct = currentPctRef.current;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(startPct + (target - startPct) * eased);
      currentPctRef.current = val;
      setProgressPct(val);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [progressAnim]);

  const updateLoadingLabel = useCallback((label) => {
    setLoadingTextOp(0);
    setTimeout(() => {
      setLoadingText(label);
      setLoadingTextOp(1);
    }, 200);
  }, []);

  // ── Unmount guard ────────────────────────────────────────────────────────────
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Entry animations ────────────────────────────────────────────────────────
  useEffect(() => {
    const entryAnim = Animated.parallel([
      Animated.spring(ringScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(lineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(logoRotate, { toValue: 0, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(textY, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(textOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(tagY, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tagOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]);
    entryAnim.start();

    // Building rise
    const buildingAnim = Animated.sequence([
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(buildingY, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(buildingOp, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    ]);
    buildingAnim.start();

    // Floating particles
    const delays = [1800, 2300, 2800, 3200];
    const particleTimers = [];
    particles.forEach((p, i) => {
      const loop = () => {
        if (!isMounted.current) return;
        p.translateY.setValue(0);
        p.opacity.setValue(0);
        Animated.sequence([
          Animated.delay(delays[i] % 1000),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
            Animated.timing(p.translateY, { toValue: -20, duration: 600, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
            Animated.timing(p.translateY, { toValue: -60, duration: 1500, useNativeDriver: true }),
          ]),
          Animated.delay(800),
        ]).start(({ finished }) => {
          if (finished && isMounted.current) loop();
        });
      };
      const timer = setTimeout(loop, delays[i]);
      particleTimers.push(timer);
    });

    return () => {
      entryAnim.stop();
      buildingAnim.stop();
      particleTimers.forEach(clearTimeout);
      particles.forEach(p => {
        p.opacity.stopAnimation();
        p.translateY.stopAnimation();
      });
    };
  }, []);

  // ── Dot pulse ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (dotDone) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => {
      anim.stop();
      dotPulse.stopAnimation();
    };
  }, [dotDone]);

  // ── Show buttons with animation when ready ──────────────────────────────────
  useEffect(() => {
    if (showButtons) {
      const anim = Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
      anim.start();
      return () => anim.stop();
    }
  }, [showButtons]);

  // ── Original utility functions ──────────────────────────────────────────────
  // Inline helpers that don't suffer from stale closures
  const doAnimateProgress = (target, duration = 800) => {
    Animated.timing(progressAnim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const startPct = currentPctRef.current;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(startPct + (target - startPct) * eased);
      currentPctRef.current = val;
      setProgressPct(val);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const doUpdateLabel = (label) => {
    setLoadingTextOp(0);
    setTimeout(() => {
      setLoadingText(label);
      setLoadingTextOp(1);
    }, 200);
  };

  const checkServerConnection = async () => {
    // Declared outside try/catch so both blocks share the same reference.
    let wakeUpTimer = null;

    try {
      setConnectionStatus({
        checking: true,
        connected: false,
        message: 'Checking server connection...',
        canContinue: false,
        offlineAvailable: false,
      });

      // Step 1: Checking Internet Connection (0% -> 30%)
      doUpdateLabel('Checking Internet Connection');
      doAnimateProgress(30, 1400);

      console.log('[WelcomeScreen] Starting server connection check...');

      wakeUpTimer = setTimeout(() => {
        doUpdateLabel('Waking Up Server...');
      }, 5000);

      // Ping the server — lightweight, no DB queries.
      const response = await Promise.race([
        ApiService.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 65000)
        )
      ]);

      clearTimeout(wakeUpTimer);
      wakeUpTimer = null;

      console.log('[WelcomeScreen] ping response:', response);

      if (response && response.isOnline) {
        // Step 2: Connected (30% -> 65%)
        doUpdateLabel('Server Connected');
        doAnimateProgress(65, 1000);

        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 3: Preparing app (65% -> 90%)
        doUpdateLabel('Preparing App');
        doAnimateProgress(90, 800);

        await new Promise(resolve => setTimeout(resolve, 600));

        // Step 4: Done (90% -> 100%)
        doUpdateLabel('Ready');
        doAnimateProgress(100, 500);

        await new Promise(resolve => setTimeout(resolve, 400));

        setDotDone(true);

        setConnectionStatus({
          checking: false,
          connected: true,
          message: 'Connected to server ✓',
          canContinue: true,
          offlineAvailable: false,
        });

        setShowButtons(true);
      } else {
        // Ping returned but isOnline was not true — treat as unavailable
        console.log('[WelcomeScreen] Server returned unexpected ping response', response);
        doUpdateLabel('Server Unavailable');
        doAnimateProgress(100, 800);
        await new Promise(resolve => setTimeout(resolve, 600));
        setDotDone(true);
        await handleOfflineMode();
      }
    } catch (error) {
      if (wakeUpTimer !== null) {
        clearTimeout(wakeUpTimer);
        wakeUpTimer = null;
      }
      console.log('[WelcomeScreen] Server connection check failed:', error?.message || error);
      doUpdateLabel('Connection Failed');
      doAnimateProgress(100, 800);
      await new Promise(resolve => setTimeout(resolve, 600));
      setDotDone(true);
      await handleOfflineMode();
    }
  };

  const handleOfflineMode = async () => {
    const offlineAvailable = await OfflineService.isPathfindingAvailable();
    console.log('[WelcomeScreen] Offline data available:', offlineAvailable);

    setConnectionStatus({
      checking: false,
      connected: false,
      message: offlineAvailable
        ? 'Server unavailable - Offline mode available'
        : 'Server unavailable - No offline data',
      canContinue: true,
      offlineAvailable: offlineAvailable,
    });

    setShowButtons(true);
  };

  const handleGetStarted = () => {
    if (!connectionStatus.canContinue) {
      return;
    }
    navigation.replace('PointSelection');
  };

  const handleAdminLogin = () => {
    navigation.navigate('Login');
  };

  // Hidden admin trigger: 4 taps on the logo
  const logoClicksRef = useRef(0);
  const handleLogoClick = () => {
    logoClicksRef.current += 1;
    if (logoClicksRef.current >= 4) {
      handleAdminLogin();
      logoClicksRef.current = 0; // Reset after navigation
    }
  };

  const handleRetry = () => {
    // Reset loading state
    setShowButtons(false);
    setDotDone(false);
    currentPctRef.current = 0;
    setProgressPct(0);
    progressAnim.setValue(0);
    setLoadingText('Initializing...');
    setLoadingTextOp(1);
    buttonOpacity.setValue(0);
    buttonY.setValue(20);
    // Re-run connection check
    checkServerConnection();
  };

  // ── Startup check (original logic) ──────────────────────────────────────────
  useEffect(() => {
    const startupCheck = async () => {
      const hasData = await OfflineService.isPathfindingAvailable();
      const initialDownloadDone = await AsyncStorage.getItem('HAS_INITIAL_DOWNLOAD');

      // Delay before starting connection check to let animations play
      setTimeout(() => {
        checkServerConnection();
      }, 1700);
    };

    startupCheck();
  }, [navigation]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const logoRotateDeg = logoRotate.interpolate({
    inputRange: [-20, 0],
    outputRange: ['-20deg', '0deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const particlePositions = [
    { left: SW * 0.30, top: SH * 0.40 },
    { left: SW * 0.65, top: SH * 0.55 },
    { left: SW * 0.45, top: SH * 0.30 },
    { left: SW * 0.75, top: SH * 0.45 },
  ];
  const particleSizes = [3, 2, 2, 3];

  if (!fontsLoaded) return null;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.maroonDark} />

      {/* Background gradient */}
      <LinearGradient
        colors={[C.maroonDark, '#2a0008', C.maroonDark]}
        style={StyleSheet.absoluteFill}
      />

      {/* Faint grid tint */}
      <View style={styles.gridOverlay} pointerEvents="none" />

      {/* Compass ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.compassRing,
          { transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      >
        <View style={styles.compassRingInner1} />
        <View style={styles.compassRingInner2} />
      </Animated.View>

      {/* Cross lines */}
      <Animated.View pointerEvents="none" style={[styles.lineH, { opacity: lineOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.lineV, { opacity: lineOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.lineD1, { opacity: lineOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.lineD2, { opacity: lineOpacity }]} />

      {/* Cardinal labels */}
      <Animated.View pointerEvents="none" style={[styles.cardinalWrap, { opacity: ringOpacity }]}>
        <Text style={[styles.cardinal, styles.cardinalN]}>N</Text>
        <Text style={[styles.cardinal, styles.cardinalS]}>S</Text>
        <Text style={[styles.cardinal, styles.cardinalW]}>W</Text>
        <Text style={[styles.cardinal, styles.cardinalE]}>E</Text>
      </Animated.View>

      {/* Corner marks */}
      <View pointerEvents="none" style={[styles.corner, styles.cornerTL]} />
      <View pointerEvents="none" style={[styles.corner, styles.cornerTR]} />
      <View pointerEvents="none" style={[styles.corner, styles.cornerBL]} />
      <View pointerEvents="none" style={[styles.corner, styles.cornerBR]} />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              width: particleSizes[i],
              height: particleSizes[i],
              left: particlePositions[i].left,
              top: particlePositions[i].top,
              opacity: p.opacity,
              transform: [{ translateY: p.translateY }],
            },
          ]}
        />
      ))}

      {/* ── Main content ── */}
      <View style={styles.content}>

        {/* Logo mark */}
        <TouchableWithoutFeedback onPress={handleLogoClick}>
          <Animated.View
            style={[
              styles.logoMark,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { rotate: logoRotateDeg }],
              },
            ]}
          >
            <View style={styles.logoOuterRing} />
            <View style={styles.logoInnerRing} />
            <LinearGradient
              colors={[C.maroonLight, C.maroonDark]}
              start={{ x: 0.4, y: 0.35 }}
              end={{ x: 0.6, y: 0.65 }}
              style={styles.logoFill}
            />
            <View style={styles.navPin}>
              <View style={styles.pinHead} />
              <View style={styles.pinTail} />
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>

        {/* App name */}
        <Animated.View
          style={[
            styles.appName,
            { opacity: textOpacity, transform: [{ translateY: textY }] },
          ]}
        >
          <View style={styles.nameOWrap}>
            <Text style={styles.nameO}>O</Text>
            <View style={styles.nameOUnderline} />
          </View>
          <Text style={styles.nameSee}>SEE</Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={[
            styles.tagline,
            { opacity: tagOpacity, transform: [{ translateY: tagY }] },
          ]}
        >
          <Text style={styles.taglineMain}>Campus Navigator</Text>
          <View style={styles.dividerLine} />
          <Text style={styles.taglineSub}>Find Your Way · Osmena Colleges</Text>
        </Animated.View>

        {/* Connection status message (shown after loading completes) */}
        {!connectionStatus.checking && (
          <View style={styles.statusMessage}>
            <Text style={[
              styles.statusDot,
              connectionStatus.connected
                ? styles.statusDotConnected
                : connectionStatus.offlineAvailable
                  ? styles.statusDotOffline
                  : styles.statusDotError
            ]}>
              {connectionStatus.connected ? '●' : connectionStatus.offlineAvailable ? '●' : '●'}
            </Text>
            <Text style={styles.statusText}>{connectionStatus.message}</Text>
          </View>
        )}

        {/* Action buttons (shown after loading completes) */}
        {showButtons && (
          <Animated.View style={[
            styles.buttonsContainer,
            { opacity: buttonOpacity, transform: [{ translateY: buttonY }] },
          ]}>
            <TouchableOpacity
              style={[
                styles.getStartedButton,
                !connectionStatus.canContinue && styles.buttonDisabled,
              ]}
              onPress={handleGetStarted}
              activeOpacity={0.8}
              disabled={!connectionStatus.canContinue}
            >
              <LinearGradient
                colors={[C.gold, '#A8863A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.getStartedText}>GET STARTED</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Retry button (shown when connection failed) */}
            {!connectionStatus.connected && !connectionStatus.offlineAvailable && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Text style={styles.retryButtonText}>⟳ RETRY CONNECTION</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </View>

      {/* Footer / Loading */}
      <View style={styles.footer}>
        <View style={styles.loadingStatus}>
          {/* Label row */}
          <View style={styles.loadingLabel}>
            <Animated.View
              style={[
                styles.loadingDot,
                dotDone
                  ? { backgroundColor: connectionStatus.connected ? '#4CAF50' : C.gold }
                  : { opacity: dotPulse },
              ]}
            />
            <Text
              style={[styles.loadingText, { opacity: loadingTextOp }]}
              numberOfLines={1}
            >
              {loadingText}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.loadingBar}>
            <Animated.View style={[styles.loadingProgress, { width: progressWidth }]}>
              <LinearGradient
                colors={[C.maroonLight, C.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          {/* Percent */}
          <Text style={styles.loadingPercent}>{progressPct}%</Text>
        </View>

        {/* Version */}
        <Text style={styles.versionText}>v{APP_CONFIG.VERSION}</Text>
      </View>

      {/* ── Building silhouette ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.buildingWrap,
          { opacity: buildingOp, transform: [{ translateY: buildingY }] },
        ]}
      >
        <Svg viewBox="0 0 390 130" width={SW} height={130} preserveAspectRatio="none">
          <Defs>
            <SvgLinearGradient id="bldGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#6B0F1A" stopOpacity={0.7} />
              <Stop offset="100%" stopColor="#3D0009" stopOpacity={0.95} />
            </SvgLinearGradient>
          </Defs>

          {/* Left buildings */}
          <Rect x={0} y={80} width={18} height={50} fill="url(#bldGrad)" />
          <Rect x={20} y={65} width={25} height={65} fill="url(#bldGrad)" />
          <Rect x={47} y={55} width={8} height={75} fill="url(#bldGrad)" />
          <Rect x={57} y={70} width={20} height={60} fill="url(#bldGrad)" />
          <Rect x={79} y={50} width={30} height={80} fill="url(#bldGrad)" />
          {/* Flag left */}
          <Rect x={93} y={42} width={1.5} height={10} fill="rgba(201,169,110,0.6)" />
          <Polygon points="95,42 102,45.5 95,49" fill="rgba(201,169,110,0.5)" />

          {/* Center buildings */}
          <Rect x={112} y={30} width={12} height={100} fill="url(#bldGrad)" />
          <Rect x={145} y={15} width={100} height={115} fill="url(#bldGrad)" />
          <Rect x={170} y={8} width={50} height={10} fill="url(#bldGrad)" />
          <Polygon points="185,0 195,8 205,0" fill="rgba(107,15,26,0.8)" />
          {/* Flagpole */}
          <Rect x={194} y={-2} width={2} height={14} fill="rgba(201,169,110,0.8)" />
          <Polygon points="196,-2 205,2 196,6" fill="rgba(201,169,110,0.7)" />

          {/* Windows row 1 */}
          {[155, 173, 191, 209, 227].map(x => (
            <Rect key={'w1' + x} x={x} y={35} width={12} height={8} fill="rgba(250,247,242,0.06)" rx={1} />
          ))}
          {/* Windows row 2 */}
          {[155, 173, 191, 209, 227].map(x => (
            <Rect key={'w2' + x} x={x} y={50} width={12} height={8}
              fill={x === 191 ? 'rgba(250,247,242,0.08)' : 'rgba(250,247,242,0.05)'}
              rx={1}
            />
          ))}
          {/* Windows row 3 */}
          {[155, 173, 209, 227].map(x => (
            <Rect key={'w3' + x} x={x} y={65} width={12} height={8} fill="rgba(250,247,242,0.05)" rx={1} />
          ))}

          {/* Entrance */}
          <Rect x={182} y={95} width={26} height={35} fill="rgba(61,0,9,0.9)" rx={3} />
          <Rect x={183} y={95} width={24} height={22} fill="rgba(250,247,242,0.04)" rx={10} />

          {/* Right buildings */}
          <Rect x={248} y={45} width={30} height={85} fill="url(#bldGrad)" />
          <Rect x={280} y={60} width={22} height={70} fill="url(#bldGrad)" />
          <Rect x={304} y={70} width={28} height={60} fill="url(#bldGrad)" />
          <Rect x={334} y={55} width={12} height={75} fill="url(#bldGrad)" />
          <Rect x={348} y={68} width={22} height={62} fill="url(#bldGrad)" />
          <Rect x={372} y={78} width={18} height={52} fill="url(#bldGrad)" />

          {/* Ground */}
          <Rect x={0} y={126} width={390} height={4} fill="rgba(107,15,26,0.8)" />
        </Svg>
      </Animated.View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.maroonDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
  },

  // Compass
  compassRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.15)',
    top: '50%',
    left: '50%',
    marginTop: -(RING_SIZE / 2),
    marginLeft: -(RING_SIZE / 2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassRingInner1: {
    position: 'absolute',
    width: RING_SIZE - 36,
    height: RING_SIZE - 36,
    borderRadius: (RING_SIZE - 36) / 2,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.10)',
    borderStyle: 'dashed',
  },
  compassRingInner2: {
    position: 'absolute',
    width: RING_SIZE - 72,
    height: RING_SIZE - 72,
    borderRadius: (RING_SIZE - 72) / 2,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.08)',
  },

  // Cross lines
  lineH: {
    position: 'absolute',
    width: RING_SIZE,
    height: 1,
    backgroundColor: 'rgba(201,169,110,0.12)',
  },
  lineV: {
    position: 'absolute',
    width: 1,
    height: RING_SIZE,
    backgroundColor: 'rgba(201,169,110,0.12)',
  },
  lineD1: {
    position: 'absolute',
    width: 240,
    height: 1,
    backgroundColor: 'rgba(201,169,110,0.12)',
    opacity: 0.5,
    transform: [{ rotate: '45deg' }],
  },
  lineD2: {
    position: 'absolute',
    width: 240,
    height: 1,
    backgroundColor: 'rgba(201,169,110,0.12)',
    opacity: 0.5,
    transform: [{ rotate: '-45deg' }],
  },

  // Cardinals
  cardinalWrap: {
    position: 'absolute',
    width: 170,
    height: 170,
    top: '50%',
    left: '50%',
    marginTop: -85,
    marginLeft: -85,
  },
  cardinal: {
    position: 'absolute',
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(201,169,110,0.5)',
  },
  cardinalN: { top: -12, left: '50%', transform: [{ translateX: -4 }] },
  cardinalS: { bottom: -12, left: '50%', transform: [{ translateX: -4 }] },
  cardinalW: { left: -12, top: '50%', transform: [{ translateY: -6 }] },
  cardinalE: { right: -12, top: '50%', transform: [{ translateY: -6 }] },

  // Corners
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    opacity: 0.2,
  },
  cornerTL: { top: 48, left: 20, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: C.gold },
  cornerTR: { top: 48, right: 20, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: C.gold },
  cornerBL: { bottom: 20, left: 20, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: C.gold },
  cornerBR: { bottom: 20, right: 20, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: C.gold },

  // Particles
  particle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: C.gold,
  },

  // Content
  content: {
    alignItems: 'center',
    zIndex: 10,
  },

  // Logo ---need change
  logoMark: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuterRing: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 2.5,
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  logoInnerRing: {
    position: 'absolute',
    width: LOGO_SIZE - 24,
    height: LOGO_SIZE - 24,
    borderRadius: (LOGO_SIZE - 24) / 2,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.4)',
  },
  logoFill: {
    position: 'absolute',
    width: LOGO_SIZE - 36,
    height: LOGO_SIZE - 36,
    borderRadius: (LOGO_SIZE - 36) / 2,
  },
  navPin: {
    alignItems: 'center',
    marginTop: -6,
  },
  pinHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FAF7F2',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pinTail: {
    width: 2,
    height: 12,
    backgroundColor: 'rgba(250,247,242,0.5)',
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },

  // App name
  appName: {
    alignItems: 'center',
  },
  nameOWrap: {
    alignItems: 'center',
  },
  nameO: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 80,
    color: '#FAF7F2',
    lineHeight: 72,
    letterSpacing: -2,
  },
  nameOUnderline: {
    width: 48,
    height: 2,
    backgroundColor: C.gold,
    opacity: 0.7,
    marginTop: 2,
  },
  nameSee: {
    fontFamily: 'Montserrat_200ExtraLight',
    fontSize: 34,
    color: 'rgba(250,247,242,0.85)',
    letterSpacing: 16,
    marginTop: 2,
  },

  // Tagline
  tagline: {
    alignItems: 'center',
    marginTop: 20,
  },
  taglineMain: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 9.5,
    letterSpacing: 4,
    color: C.gold,
    textTransform: 'uppercase',
  },
  dividerLine: {
    width: 60,
    height: 1,
    backgroundColor: C.gold,
    opacity: 0.5,
    marginVertical: 10,
  },
  taglineSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 8.5,
    letterSpacing: 2,
    color: 'rgba(250,247,242,0.4)',
    textTransform: 'uppercase',
  },

  // Connection status message
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(250,247,242,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.15)',
  },
  statusDot: {
    fontSize: 10,
    marginRight: 8,
  },
  statusDotConnected: {
    color: '#4CAF50',
  },
  statusDotOffline: {
    color: C.gold,
  },
  statusDotError: {
    color: '#FF5252',
  },
  statusText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(250,247,242,0.7)',
    textTransform: 'uppercase',
  },

  // Buttons
  buttonsContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  getStartedButton: {
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: C.gold,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 14,
  },
  buttonGradient: {
    paddingHorizontal: 50,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    letterSpacing: 3,
    color: C.maroonDark,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  adminButton: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.35)',
    backgroundColor: 'rgba(250,247,242,0.04)',
  },
  adminButtonText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(250,247,242,0.55)',
    textTransform: 'uppercase',
  },
  retryButton: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.5)',
    backgroundColor: 'rgba(201,169,110,0.1)',
    marginBottom: 10,
  },
  retryButtonText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.gold,
    textTransform: 'uppercase',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  loadingStatus: {
    alignItems: 'center',
    width: 220,
  },
  loadingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
    marginBottom: 8,
  },
  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.gold,
    marginRight: 7,
  },
  loadingText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 8,
    letterSpacing: 1.5,
    color: 'rgba(250,247,242,0.55)',
    textTransform: 'uppercase',
  },
  loadingBar: {
    width: 220,
    height: 2,
    backgroundColor: 'rgba(250,247,242,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  loadingProgress: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingPercent: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 7,
    letterSpacing: 2,
    color: 'rgba(201,169,110,0.5)',
    alignSelf: 'flex-end',
  },
  versionText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 7,
    letterSpacing: 2,
    color: 'rgba(250,247,242,0.25)',
    marginTop: 12,
    textTransform: 'uppercase',
  },

  // Building
  buildingWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
  },
});

export default WelcomeScreen;
