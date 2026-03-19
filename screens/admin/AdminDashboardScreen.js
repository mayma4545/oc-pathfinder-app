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
  Platform,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path, Circle, Line, G, Text as SvgText,
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
import AdminDrawerLayout from '../../components/AdminDrawerLayout';

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

const { width: SW } = Dimensions.get('window');

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

// History type config
const HISTORY_TYPE = {
  add:    { color: C.green,    bg: C.greenFaint,  label: 'ADD' },
  edit:   { color: C.blue,     bg: C.blueFaint,   label: 'EDIT' },
  delete: { color: '#EF4444',  bg: 'rgba(239,68,68,0.1)', label: 'DEL' },
  event:  { color: C.orange,   bg: C.orangeFaint, label: 'EVENT' },
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
              <Text style={styles.chartValue}>{d.value}</Text>
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
  const { user } = useAuth();

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
  });

  const [stats, setStats] = useState({ nodes: 0, edges: 0, users: 0 });

  // Animations
  const contentOp = useRef(new Animated.Value(0)).current;
  const contentY  = useRef(new Animated.Value(24)).current;
  const statAnims = useRef([0, 0, 0].map(() => new Animated.Value(0))).current;

  // Initial fade-in
  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(contentOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(contentY,  { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
              users: response.version.annotations_count || 0,
            });

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

  // Animated stat values
  const nodeCount = statAnims[0].interpolate({ inputRange: [0, 1], outputRange: [0, stats.nodes] });
  const edgeCount = statAnims[1].interpolate({ inputRange: [0, 1], outputRange: [0, stats.edges] });
  const userCount = statAnims[2].interpolate({ inputRange: [0, 1], outputRange: [0, stats.users] });

  if (!fontsLoaded) return null;

  return (
    <AdminDrawerLayout title="Admin Dashboard" activeScreen="dashboard">
      <StatusBar barStyle="light-content" />

      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: C.grayFaint }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }] }}>

          {/* ── WELCOME STRIP ─────────────────────────────────────────────── */}
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

          {/* ── STAT CARDS ────────────────────────────────────────────────── */}
          <View style={styles.statsGrid}>

            {/* Nodes */}
            <View style={[styles.statCard, { borderTopColor: C.maroon }]}>
              <View style={[styles.statIconWrap, { backgroundColor: C.maroonFaint }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="4" stroke={C.maroon} strokeWidth="1.7" />
                  <Circle cx="4" cy="4" r="2" stroke={C.maroon} strokeWidth="1.5" />
                  <Circle cx="20" cy="4" r="2" stroke={C.maroon} strokeWidth="1.5" />
                  <Circle cx="4" cy="20" r="2" stroke={C.maroon} strokeWidth="1.5" />
                  <Circle cx="20" cy="20" r="2" stroke={C.maroon} strokeWidth="1.5" />
                </Svg>
              </View>
              <AnimatedCounter anim={nodeCount} style={styles.statNum} color={C.maroon} />
              <Text style={styles.statLabel}>Total Nodes</Text>
            </View>

            {/* Edges */}
            <View style={[styles.statCard, { borderTopColor: C.blue }]}>
              <View style={[styles.statIconWrap, { backgroundColor: C.blueFaint }]}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx="5" cy="12" r="3" stroke={C.blue} strokeWidth="1.7" />
                  <Circle cx="19" cy="12" r="3" stroke={C.blue} strokeWidth="1.7" />
                  <Line x1="8" y1="12" x2="16" y2="12" stroke={C.blue} strokeWidth="1.7" strokeDasharray="2,2" />
                </Svg>
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

          {/* ── COLUMN CHART ──────────────────────────────────────────────── */}
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

          {/* ── HISTORY CHANGES ───────────────────────────────────────────── */}
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
                    <View style={[styles.historyBadge, { backgroundColor: t.bg }]}>
                      <Text style={[styles.historyBadgeText, { color: t.color }]}>{t.label}</Text>
                    </View>

                    <View style={styles.historyContent}>
                      <Text style={styles.historyAction}>{item.action}</Text>
                      <Text style={styles.historyDetail} numberOfLines={1}>{item.detail}</Text>
                      <View style={styles.historyMeta}>
                        <Text style={styles.historyUser}>@{item.user}</Text>
                        <Text style={styles.historyDot}>·</Text>
                        <Text style={styles.historyTime}>{item.time}</Text>
                      </View>
                    </View>

                    <View style={[styles.historyDotRight, { backgroundColor: t.color }]} />
                  </View>
                );
              })}
            </View>
          </View>

        </Animated.View>
      </Animated.ScrollView>
    </AdminDrawerLayout>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

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
});

export default AdminDashboardScreen;
