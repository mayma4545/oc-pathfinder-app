/**
 * AdminDrawerLayout
 * Shared header + slide-out sidebar for all admin screens.
 * Wrap your screen content as children and it gets the header/drawer for free.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path, Circle, Rect, Line, G,
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
import { useNavigation } from '@react-navigation/native';
import { Easing } from 'react-native';

import { useAuth } from '../contexts/AuthContext';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  maroon: '#6B0F1A',
  maroonDark: '#3D0009',
  maroonLight: '#B03045',
  white: '#FFFFFF',
  gold: '#C9A96E',
};

const { width: SW } = Dimensions.get('window');
const MENU_WIDTH = SW * 0.75;

// ─── Menu items ───────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',    icon: 'grid',  screen: 'AdminDashboard' },
  { id: 'map',       label: 'Map Overview', icon: 'map',   screen: 'MapOverview' },
  { id: 'nodes',     label: 'Manage Nodes', icon: 'node',  screen: 'NodesList' },
  { id: 'edges',     label: 'Manage Edges', icon: 'edge',  screen: 'EdgesList' },
  { id: 'events',    label: 'Manage Events',icon: 'event', screen: 'EventsList' },
  { id: 'backtoapp', label: 'Back to App',  icon: 'back',  screen: 'PointSelection' },
  { id: 'logout',    label: 'Logout',       icon: 'logout' },
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
    case 'map':       return <IconMap  size={size} color={color} />;
    case 'nodes':     return <IconNode size={size} color={color} />;
    case 'edges':     return <IconEdge size={size} color={color} />;
    case 'events':    return <IconEvent size={size} color={color} />;
    case 'backtoapp': return <IconBackApp size={size} color={color} />;
    case 'logout':    return <IconLogout size={size} color={color} />;
    default:          return null;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * Props:
 *  - title        {string}   – page title shown in header
 *  - activeScreen {string}   – menu item id that should be highlighted (e.g. 'nodes')
 *  - rightElement {ReactNode}– optional element rendered on the right side of the header
 *  - children     {ReactNode}– the screen body (takes all remaining space)
 */
const AdminDrawerLayout = ({ title, activeScreen, rightElement, children }) => {
  const { logout, user } = useAuth();
  const navigation = useNavigation();

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuSlide = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const menuBgOp  = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: 0,          duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(menuBgOp,  { toValue: 1,          duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: -MENU_WIDTH, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(menuBgOp,  { toValue: 0,           duration: 240, useNativeDriver: true }),
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
    closeMenu();
    if (id === 'logout') {
      handleLogout();
    } else if (screen) {
      navigation.navigate(screen);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
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
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSub}>Osmena Colleges Navigator</Text>
            </View>
          </View>

          {/* Right: optional extra element + menu button */}
          <View style={styles.headerRight}>
            {rightElement ? rightElement : null}
            <TouchableOpacity style={styles.menuBtn} onPress={openMenu} activeOpacity={0.75}>
              <IconMenu size={20} color={C.white} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={styles.headerAccent} />
      </View>

      {/* ── BODY (children) ───────────────────────────────────────────────── */}
      <View style={styles.body}>
        {children}
      </View>

      {/* ── SLIDE-OUT MENU ────────────────────────────────────────────────── */}
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

              {/* Gold divider */}
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
                  const isActive  = activeScreen === item.id;
                  const isLogout  = item.id === 'logout';
                  const isBack    = item.id === 'backtoapp';
                  const iconColor = isLogout ? '#EF4444' : isActive ? C.gold : 'rgba(250,247,242,0.65)';
                  const textColor = isLogout ? '#EF4444' : isActive ? C.gold : 'rgba(250,247,242,0.8)';

                  const btn = (
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

                  if (isBack) {
                    return (
                      <React.Fragment key={item.id}>
                        <View style={styles.menuItemSeparator} />
                        {btn}
                      </React.Fragment>
                    );
                  }
                  return btn;
                })}
              </View>

              {/* Footer */}
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
    backgroundColor: '#F3F4F6',
  },

  // Header
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
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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

  // Body
  body: {
    flex: 1,
  },

  // Menu overlay
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

export default AdminDrawerLayout;
