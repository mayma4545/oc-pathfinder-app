import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboardScreen = ({ navigation }) => {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('PointSelection');
        },
      },
    ]);
  };

  const menuItems = [
    {
      title: 'Map Overview',
      icon: '🗺️',
      description: 'View full campus map with all nodes',
      screen: 'MapOverview',
      color: '#9C27B0',
    },
    {
      title: 'Manage Nodes',
      icon: '📍',
      description: 'Add, edit, or delete location nodes',
      screen: 'NodesList',
      color: '#4CAF50',
    },
    {
      title: 'Manage Edges',
      icon: '↔️',
      description: 'Configure connections between nodes',
      screen: 'EdgesList',
      color: '#2196F3',
    },
    {
      title: 'Manage Events',
      icon: '🎉',
      description: 'Create and manage campus events',
      screen: 'EventsList',
      color: '#E91E63',
    },
    {
      title: 'Manage Annotations',
      icon: '🏷️',
      description: 'Add labels to 360° panorama views',
      screen: 'AnnotationsList',
      color: '#FF9800',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Welcome, {user?.username}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderLeftColor: item.color }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemIcon}>
                  <Text style={styles.iconText}>{item.icon}</Text>
                </View>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemDescription}>{item.description}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Back to App */}
        <TouchableOpacity
          style={styles.backToAppButton}
          onPress={() => navigation.navigate('PointSelection')}
        >
          <Text style={styles.backToAppButtonText}>← Back to App</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    backgroundColor: THEME_COLORS.primary,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 15,
  },
  menuItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  menuItemIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  iconText: {
    fontSize: 24,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 5,
  },
  menuItemDescription: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: THEME_COLORS.textSecondary,
  },
  backToAppButton: {
    margin: 20,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  backToAppButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.primary,
  },
});

export default AdminDashboardScreen;
