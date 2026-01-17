import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DownloadProvider } from './contexts/DownloadContext';
import DownloadProgressIndicator from './components/DownloadProgressIndicator';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import SyncManager from './services/SyncManager';

// Screens
import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import PointSelectionScreen from './screens/PointSelectionScreen';
import MapDisplayScreen from './screens/MapDisplayScreen';
import OfflineSettingsScreen from './screens/OfflineSettingsScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import NodesListScreen from './screens/admin/NodesListScreen';
import NodeFormScreen from './screens/admin/NodeFormScreen';
import EdgesListScreen from './screens/admin/EdgesListScreen';
import EdgeFormScreen from './screens/admin/EdgeFormScreen';
import AnnotationsListScreen from './screens/admin/AnnotationsListScreen';
import MapOverviewScreen from './screens/admin/MapOverviewScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAdmin } = useAuth();

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        {/* Public Screens */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="PointSelection" component={PointSelectionScreen} />
        <Stack.Screen name="MapDisplay" component={MapDisplayScreen} />
        <Stack.Screen name="OfflineSettings" component={OfflineSettingsScreen} />

        {/* Admin Screens - Only available when authenticated */}
        {isAdmin && (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="NodesList" component={NodesListScreen} />
            <Stack.Screen name="NodeForm" component={NodeFormScreen} />
            <Stack.Screen name="EdgesList" component={EdgesListScreen} />
            <Stack.Screen name="EdgeForm" component={EdgeFormScreen} />
            <Stack.Screen name="AnnotationsList" component={AnnotationsListScreen} />
            <Stack.Screen name="MapOverview" component={MapOverviewScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  // Initialize SyncManager on app start
  useEffect(() => {
    SyncManager.initialize();
    return () => SyncManager.cleanup();
  }, []);

  return (
    <AuthProvider>
      <DownloadProvider>
        <View style={styles.container}>
          <NetworkStatusBanner />
          <AppNavigator />
          {/* Global Download Progress Indicator */}
          <DownloadProgressIndicator />
        </View>
      </DownloadProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

