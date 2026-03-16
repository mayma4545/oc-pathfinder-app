/**
 * O See – Mobile Campus Navigator
 * Admin Dashboard – Enhanced UI Integration
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Platform,
  Easing,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path, Circle, Rect, Line, G, Text as SvgText,
  Defs, LinearGradient as SvgGrad, Stop,
} from 'react-native-svg';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/ApiService';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  maroon: '#6B0F1A',
  maroonDark: '#3D0009',
  maroonLight: '#B03045',
  maroonFaint: 'rgba(107,15,26,0.07)',
  white: '#FFFFFF',
  black: '#1A1A1A',
  charcoal: '#374151',
  gray: '#9CA3AF',
  grayMid: '#6B7280',
  grayLight: '#E5E7EB',
  grayFaint: '#F3F4F6',
  gold: '#C9A96E',
  goldDark: '#A8824A',
  goldFaint: 'rgba(201,169,110,0.1)',
  blue: '#3B82F6',
  blueFaint: 'rgba(59,130,246,0.1)',
  green: '#16A34A',
  greenFaint: 'rgba(22,163,74,0.1)',
  orange: '#EA580C',
  orangeFaint: 'rgba(234,88,12,0.1)',
  purple: '#7C3AED',
  purpleFaint: 'rgba(124,58,237,0.1)',
};

const { width: SW, height: SH } = Dimensions.get('window');
const MENU_WIDTH = SW * 0.75;

// ─── Mock data for now ────────────────────────────────────────────────────────
const HISTORY = [
  { id: 1, action: 'Node Added', detail: 'Room 412 – Ipil Building', user: 'admin', time: '2 mins ago', type: 'add' },
  { id: 2, action: 'Edge Updated', detail: 'Acacia Hall → Admin Office', user: 'admin', time: '18 mins ago', type: 'edit' },
  { id: 3, action: 'Node Deleted', detail: 'Old Gate – Entrance', user: 'jdoe', time: '1 hr ago', type: 'delete' },
  { id: 4, action: 'Edge Added', detail: 'Library → Computer Lab 2', user: 'admin', time: '3 hrs ago', type: 'add' },
  { id: 5, action: 'Event Created', detail: 'Foundation Day – Main Plaza', user: 'mcruz', time: '5 hrs ago', type: 'event' },
  { id: 6, action: 'Node Updated', detail: 'Guidance Office – Main Bldg', user: 'admin', time: 'Yesterday', type: 'edit' },
  { id: 7, action: 'Edge Deleted', detail: 'Old Path – Science Bldg', user: 'jdoe', time: 'Yesterday', type: 'delete' },
];

const CHART_DATA = [
  { label: 'Acacia→\nLib', value: 87 },
  { label: 'Gate→\nAdmin', value: 74 },
  { label: 'Cafe→\nGym', value: 61 },
  { label: 'Lab→\nRoom 401', value: 55 },
  { label: 'Library→\nLab2', value: 48 },
  { label: 'Chapel→\nAdmin', value: 39 },
];

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'map', label: 'Map Overview', icon: 'map', screen: 'MapOverview' },
  { id: 'nodes', label: 'Manage Nodes', icon: 'node', screen: 'NodesList' },
  { id: 'edges', label: 'Manage Edges', icon: 'edge', screen: 'EdgesList' },
  { id: 'events', label: 'Manage Events', icon: 'event', screen: 'EventsList' },
  { id: 'backtoapp', label: 'Back to App', icon: 'back', screen: 'PointSelection' },
  { id: 'logout', label: 'Logout', icon: 'logout' },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconMenu = ({ size = 22, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="3" y1="18" x2="15" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const IconClose = ({ size = 20, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const IconGrid = ({ size = 18, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.7" />
    <Rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.7" />
    <Rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.7" />
    <Rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.7" />
  </Svg>
);

const IconMap = ({ size = 18, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <Line x1="9" y1="3" x2="9" y2="18" stroke={color} strokeWidth="1.7" />
    <Line x1="15" y1="6" x2="15" y2="21" stroke={color} strokeWidth="1.7" />
  </Svg>
);

const IconNode = ({ size = 18, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.7" />
    <Circle cx="4" cy="4" r="2" stroke={color} strokeWidth="1.5" />
    <Circle cx="20" cy="4" r="2" stroke={color} strokeWidth="1.5" />
    <Circle cx="4" cy="20" r="2" stroke={color} strokeWidth="1.5" />
    <Circle cx="20" cy="20" r="2" stroke={color} strokeWidth="1.5" />
    <Line x1="6" y1="6" x2="9" y2="9" stroke={color} strokeWidth="1.3" />
    <Line x1="18" y1="6" x2="15" y2="9" stroke={color} strokeWidth="1.3" />
    <Line x1="6" y1="18" x2="9" y2="15" stroke={color} strokeWidth="1.3" />
    <Line x1="18" y1="18" x2="15" y2="15" stroke={color} strokeWidth="1.3" />
  </Svg>
);

const IconEdge = ({ size = 18, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="5" cy="12" r="3" stroke={color} strokeWidth="1.7" />
    <Circle cx="19" cy="12" r="3" stroke={color} strokeWidth="1.7" />
    <Line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth="1.7" strokeDasharray="2,2" />
    <Path d="M13 9l3 3-3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const IconEvent = ({ size = 18, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.7" />
    <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="1.7" />
    <Circle cx="8" cy="15" r="1" fill={color} />
    <Circle cx="12" cy="15" r="1" fill={color} />
    <Circle cx="16" cy="15" r="1" fill={color} />
  </Svg>
);

const IconBackApp = ({ size = 18, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 5l-7 7 7 7" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const IconLogout = ({ size = 18, color = '#EF4444' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const menuIcon = (id, size, color) => {
  switch (id) {
    case 'dashboard': return <IconGrid size={size} color={color} />;
    case 'map': return <IconMap size={size} color={color} />;
    case 'nodes': return <IconNode size={size} color={color} />;
    case 'edges': return <IconEdge size={size} color={color} />;
    case 'events': return <IconEvent size={size} color={color} />;
    case 'backtoapp': return <IconBackApp size={size} color={color} />;
    case 'logout': return <IconLogout size={size} color={color} />;
    default: return null;
  }
};

// History type config
const HISTORY_TYPE = {
  add: { color: C.green, bg: C.greenFaint, label: 'ADD' },
  edit: { color: C.blue, bg: C.blueFaint, label: 'EDIT' },
  delete: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'DEL' },
  event: { color: C.orange, bg: C.orangeFaint, label: 'EVENT' },
};

// ─── Column Chart ─────────────────────────────────────────────────────────────
const ColumnChart = () => {
  const anim = useRef(CHART_DATA.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(80,
      anim.map(a =>
        Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false })
      )
    ).start();
  }, []);

  const chartW = SW - 44 - 40;
  const chartH = 140;
  const barWidth = (chartW - 10) / CHART_DATA.length - 8;
  const maxVal = Math.max(...CHART_DATA.map(d => d.value));

  return (
    <View style={{ height: chartH + 40, paddingTop: 8 }}>
      {/* Y-axis guide lines */}
      <Svg
        width={chartW}
        height={chartH}
        style={{ position: 'absolute', top: 8, left: 0 }}
      >
        <Defs>
          <SvgGrad id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={C.maroon} stopOpacity="1" />
            <Stop offset="100%" stopColor={C.maroonLight} stopOpacity="0.8" />
          </SvgGrad>
        </Defs>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <G key={i}>
            <Line
              x1={0} y1={chartH - chartH * p}
              x2={chartW} y2={chartH - chartH * p}
              stroke="rgba(107,15,26,0.06)" strokeWidth="1"
            />
            <SvgText
              x={-2} y={chartH - chartH * p + 4}
              fontSize="7" fill={C.gray} textAnchor="end"
            >
              {Math.round(maxVal * p)}
            </SvgText>
          </G>
        ))}
      </Svg>

      {/* Bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH, gap: 8, paddingLeft: 16 }}>
        {CHART_DATA.map((d, i) => {
          const barH = anim[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, (d.value / maxVal) * chartH],
          });
          return (
            <View key={i} style={{ alignItems: 'center', width: barWidth }}>
              {/* Value label */}
              <Text style={styles.chartValue}>{d.value}</Text>
              {/* Bar */}
              <Animated.View style={{ width: barWidth, height: barH, borderRadius: 5, overflow: 'hidden' }}>
                <LinearGradient
                  colors={[C.maroon, C.maroonLight]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </View>
          );
        })}
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 16, marginTop: 6 }}>
        {CHART_DATA.map((d, i) => (
          <Text key={i} style={[styles.chartLabel, { width: barWidth }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

// ─── Animated counter helper component ───────────────────────────────────────
function AnimatedCounter({ anim, style, color }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => anim.removeListener(id);
  }, []);
  return (
    <Text style={[style, { color }]}>
      {display.toLocaleString()}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const AdminDashboardScreen = ({ navigation }) => {
  const { logout, user } = useAuth();

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [stats, setStats] = useState({ nodes: 0, edges: 0, users: 0 });

  // Animations
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-20)).current;
  const contentOp = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(24)).current;
  const menuSlide = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const menuBgOp = useRef(new Animated.Value(0)).current;
  const statAnims = useRef([0, 0, 0].map(() => new Animated.Value(0))).current;

  // Initial animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(headerY, { toValue: 0, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(contentOp, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(contentY, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  // Fetch stats when screen is focused
  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        try {
          const response = await ApiService.getDataVersion();
          if (response && response.success && response.version) {
            setStats({
              nodes: response.version.nodes_count || 0,
              edges: response.version.edges_count || 0,
              users: response.version.annotations_count || 0, // Using annotations count as placeholder for users as per spec
            });

            // Start stat counter animations after setting stats
            Animated.stagger(100,
              statAnims.map(a =>
                Animated.timing(a, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false })
              )
            ).start();
          }
        } catch (error) {
          console.error('Failed to fetch dashboard stats:', error);
        }
      };

      fetchStats();
    }, [])
  );

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(menuBgOp, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: -MENU_WIDTH, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(menuBgOp, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('Welcome');
        },
      },
    ]);
  };

  const handleMenuPress = (id, screen) => {
    setActiveMenu(id);
    closeMenu();
    if (id === 'logout') {
      handleLogout();
    } else if (screen) {
      navigation.navigate(screen);
    }
  };

  // Animated stat values
  const nodeCount = statAnims[0].interpolate({ inputRange: [0, 1], outputRange: [0, stats.nodes] });
  const edgeCount = statAnims[1].interpolate({ inputRange: [0, 1], outputRange: [0, stats.edges] });
  const userCount = statAnims[2].interpolate({ inputRange: [0, 1], outputRange: [0, stats.users] });

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
        <LinearGradient
          colors={[C.maroonDark, C.maroon]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          {/* Left: logo + title */}
          <View style={styles.headerLeft}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>O</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Admin Dashboard</Text>
              <Text style={styles.headerSub}>Osmena Colleges Navigator</Text>
            </View>
          </View>

          {/* Right: menu button */}
          <TouchableOpacity style={styles.menuBtn} onPress={openMenu} activeOpacity={0.75}>
            <IconMenu size={20} color={C.white} />
          </TouchableOpacity>
        </LinearGradient>
        <View style={styles.headerAccent} />
      </Animated.View>

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────────────────── */}
      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: C.grayFaint }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }] }}>

          {/* ── WELCOME STRIP ───────────────────────────────────────────────── */}
          <View style={styles.welcomeStrip}>
            <View>
              <Text style={styles.welcomeTitle}>Good day, {user?.username || 'Admin'} 👋</Text>
              <Text style={styles.welcomeSub}>Here's what's happening on campus.</Text>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>

          {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
          <View style={styles.statsGrid}>

            {/* Nodes */}
            <View style={[styles.statCard, { borderTopColor: C.maroon }]}>
              <View style={[styles.statIconWrap, { backgroundColor: C.maroonFaint }]}>
                <IconNode size={18} color={C.maroon} />
              </View>
              <AnimatedCounter anim={nodeCount} style={styles.statNum} color={C.maroon} />
              <Text style={styles.statLabel}>Total Nodes</Text>
            </View>

            {/* Edges */}
            <View style={[styles.statCard, { borderTopColor: C.blue }]}>
              <View style={[styles.statIconWrap, { backgroundColor: C.blueFaint }]}>
                <IconEdge size={18} color={C.blue} />
              </View>
              <AnimatedCounter anim={edgeCount} style={styles.statNum} color={C.blue} />
              <Text style={styles.statLabel}>Total Edges</Text>
            </View>

            {/* Users */}
            <View style={[styles.statCard, { borderTopColor: C.green }]}>
              <View style={[styles.statIconWrap, { backgroundColor: C.greenFaint }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx="9" cy="7" r="4" stroke={C.green} strokeWidth="1.7" />
                  <Path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke={C.green} strokeWidth="1.7" strokeLinecap="round" />
                  <Path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.85" stroke={C.green} strokeWidth="1.7" strokeLinecap="round" />
                </Svg>
              </View>
              <AnimatedCounter anim={userCount} style={styles.statNum} color={C.green} />
              <Text style={styles.statLabel}>App Users</Text>
            </View>

          </View>

          {/* ── COLUMN CHART ────────────────────────────────────────────────── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>Most Frequent Paths</Text>
              <View style={styles.sectionLine} />
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>Top 6</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>Commonly used routes by app users</Text>
            <ColumnChart />
          </View>

          {/* ── HISTORY CHANGES ─────────────────────────────────────────────── */}
          <View style={[styles.sectionCard, { marginBottom: 24 }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: C.blue }]} />
              <Text style={styles.sectionTitle}>History of Changes</Text>
              <View style={styles.sectionLine} />
              <TouchableOpacity style={styles.viewAllBtn}>
                <Text style={styles.viewAllText}>View all</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>Recent modifications to map data</Text>

            <View style={styles.historyList}>
              {HISTORY.map((item, index) => {
                const t = HISTORY_TYPE[item.type];
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.historyItem,
                      index === HISTORY.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    {/* Type badge */}
                    <View style={[styles.historyBadge, { backgroundColor: t.bg }]}>
                      <Text style={[styles.historyBadgeText, { color: t.color }]}>{t.label}</Text>
                    </View>

                    {/* Content */}
                    <View style={styles.historyContent}>
                      <Text style={styles.historyAction}>{item.action}</Text>
                      <Text style={styles.historyDetail} numberOfLines={1}>{item.detail}</Text>
                      <View style={styles.historyMeta}>
                        <Text style={styles.historyUser}>@{item.user}</Text>
                        <Text style={styles.historyDot}>·</Text>
                        <Text style={styles.historyTime}>{item.time}</Text>
                      </View>
                    </View>

                    {/* Timeline dot */}
                    <View style={[styles.historyDotRight, { backgroundColor: t.color }]} />
                  </View>
                );
              })}
            </View>
          </View>

        </Animated.View>
      </Animated.ScrollView>

      {/* ── SLIDE-OUT MENU ──────────────────────────────────────────────────── */}
      {menuOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Dark overlay */}
          <Animated.View style={[styles.menuOverlay, { opacity: menuBgOp }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={closeMenu} activeOpacity={1} />
          </Animated.View>

          {/* Menu panel */}
          <Animated.View style={[styles.menuPanel, { transform: [{ translateX: menuSlide }] }]}>
            <LinearGradient
              colors={[C.maroonDark, '#2a0008']}
              style={styles.menuGradient}
            >
              {/* Menu header */}
              <View style={styles.menuHeader}>
                <View style={styles.menuLogoWrap}>
                  <View style={styles.menuLogo}>
                    <Text style={styles.menuLogoText}>O</Text>
                  </View>
                  <View>
                    <Text style={styles.menuAppName}>O SEE</Text>
                    <Text style={styles.menuAppSub}>Admin Panel</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.menuCloseBtn} onPress={closeMenu} activeOpacity={0.75}>
                  <IconClose size={18} color="rgba(250,247,242,0.6)" />
                </TouchableOpacity>
              </View>

              {/* Gold line */}
              <View style={styles.menuDivider} />

              {/* Admin info */}
              <View style={styles.menuAdminInfo}>
                <View style={styles.menuAvatar}>
                  <Text style={styles.menuAvatarText}>A</Text>
                </View>
                <View>
                  <Text style={styles.menuAdminName}>{user?.username || 'Administrator'}</Text>
                  <Text style={styles.menuAdminRole}>Super Admin · Osmena Colleges</Text>
                </View>
              </View>

              <View style={styles.menuSectionLabel}>
                <Text style={styles.menuSectionLabelText}>NAVIGATION</Text>
              </View>

              {/* Menu items */}
              <View style={styles.menuItems}>
                {MENU_ITEMS.map((item) => {
                  const isActive = activeMenu === item.id;
                  const isLogout = item.id === 'logout';
                  const isBack = item.id === 'backtoapp';
                  const iconColor = isLogout ? '#EF4444' : isActive ? C.gold : 'rgba(250,247,242,0.65)';
                  const textColor = isLogout ? '#EF4444' : isActive ? C.gold : 'rgba(250,247,242,0.8)';

                  if (isLogout || isBack) {
                    // Separator before these items
                    return (
                      <React.Fragment key={item.id}>
                        {isBack && <View style={styles.menuItemSeparator} />}
                        <TouchableOpacity
                          style={[styles.menuItem, isActive && styles.menuItemActive]}
                          onPress={() => handleMenuPress(item.id, item.screen)}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.menuItemIcon, isActive && styles.menuItemIconActive]}>
                            {menuIcon(item.id, 17, iconColor)}
                          </View>
                          <Text style={[styles.menuItemLabel, { color: textColor }]}>
                            {item.label}
                          </Text>
                          {isActive && <View style={styles.menuItemActiveDot} />}
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.menuItem, isActive && styles.menuItemActive]}
                      onPress={() => handleMenuPress(item.id, item.screen)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.menuItemIcon, isActive && styles.menuItemIconActive]}>
                        {menuIcon(item.id, 17, iconColor)}
                      </View>
                      <Text style={[styles.menuItemLabel, { color: textColor }]}>
                        {item.label}
                      </Text>
                      {isActive && <View style={styles.menuItemActiveDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Menu footer */}
              <View style={styles.menuFooter}>
                <Text style={styles.menuFooterText}>O See · v1.0.0</Text>
              </View>

            </LinearGradient>
          </Animated.View>
        </View>
      )}

    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: C.grayFaint,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    shadowColor: C.maroonDark,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 10,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  headerAccent: {
    height: 3,
    backgroundColor: C.gold,
    opacity: 0.6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: C.gold,
    backgroundColor: 'rgba(201,169,110,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 24,
    color: C.gold,
    lineHeight: 28,
  },
  headerTitle: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 20,
    color: C.white,
    letterSpacing: 0.3,
    lineHeight: 23,
  },
  headerSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 8,
    color: 'rgba(201,169,110,0.8)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll content ────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 30,
  },

  // ── Welcome strip ─────────────────────────────────────────────────────────
  welcomeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 22,
    color: C.maroon,
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  welcomeSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: C.grayMid,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  dateBadge: {
    backgroundColor: C.maroonFaint,
    borderWidth: 1,
    borderColor: 'rgba(107,15,26,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateBadgeText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 9.5,
    color: C.maroon,
    letterSpacing: 0.3,
  },

  // ── Stat cards ────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 6,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 9.5,
    color: C.gray,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── Section card ──────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.gold,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: C.maroon,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.grayLight,
  },
  sectionBadge: {
    backgroundColor: C.maroonFaint,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(107,15,26,0.12)',
  },
  sectionBadgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 8.5,
    color: C.maroon,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10.5,
    color: C.gray,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  viewAllBtn: {
    backgroundColor: C.maroonFaint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(107,15,26,0.12)',
  },
  viewAllText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 8.5,
    color: C.maroon,
    letterSpacing: 0.5,
  },

  // ── Chart ─────────────────────────────────────────────────────────────────
  chartValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 9,
    color: C.maroon,
    textAlign: 'center',
    marginBottom: 3,
  },
  chartLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 7.5,
    color: C.gray,
    textAlign: 'center',
    lineHeight: 10,
  },

  // ── History ───────────────────────────────────────────────────────────────
  historyList: {
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.grayFaint,
  },
  historyBadge: {
    width: 40,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  historyBadgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 7.5,
    letterSpacing: 0.5,
  },
  historyContent: {
    flex: 1,
    gap: 1,
  },
  historyAction: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: C.black,
    letterSpacing: 0.2,
  },
  historyDetail: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10.5,
    color: C.grayMid,
    letterSpacing: 0.2,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  historyUser: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 9,
    color: C.maroon,
    letterSpacing: 0.3,
  },
  historyDot: {
    color: C.gray,
    fontSize: 9,
  },
  historyTime: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 9,
    color: C.gray,
    letterSpacing: 0.2,
  },
  historyDotRight: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },

  // ── Menu overlay ──────────────────────────────────────────────────────────
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 20,
  },
  menuPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
    elevation: 20,
  },
  menuGradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 46,
  },

  // Menu header
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  menuLogoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.gold,
    backgroundColor: 'rgba(201,169,110,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLogoText: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 26,
    color: C.gold,
    lineHeight: 30,
  },
  menuAppName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: C.white,
    letterSpacing: 4,
  },
  menuAppSub: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 9,
    color: 'rgba(201,169,110,0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  menuCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuDivider: {
    height: 1,
    backgroundColor: C.gold,
    opacity: 0.25,
    marginHorizontal: 20,
    marginBottom: 16,
  },

  // Admin info
  menuAdminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.15)',
  },
  menuAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.maroonLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAvatarText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: C.white,
  },
  menuAdminName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12.5,
    color: C.white,
    letterSpacing: 0.2,
  },
  menuAdminRole: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 9,
    color: 'rgba(201,169,110,0.65)',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  menuSectionLabel: {
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  menuSectionLabelText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 8,
    color: 'rgba(250,247,242,0.25)',
    letterSpacing: 2.5,
  },

  // Menu items
  menuItems: {
    paddingHorizontal: 12,
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
  },
  menuItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemIconActive: {
    backgroundColor: 'rgba(201,169,110,0.15)',
  },
  menuItemLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.3,
    flex: 1,
  },
  menuItemActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  menuItemSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 8,
    marginHorizontal: 12,
  },

  // Menu footer
  menuFooter: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  menuFooterText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 9,
    color: 'rgba(250,247,242,0.2)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

export default AdminDashboardScreen;
