import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './contexts/AuthContext';

// Screens
import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import PointSelectionScreen from './screens/PointSelectionScreen';
import MapDisplayScreen from './screens/MapDisplayScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import NodesListScreen from './screens/admin/NodesListScreen';
import NodeFormScreen from './screens/admin/NodeFormScreen';
import EdgesListScreen from './screens/admin/EdgesListScreen';
import EdgeFormScreen from './screens/admin/EdgeFormScreen';
import AnnotationsListScreen from './screens/admin/AnnotationsListScreen';
import MapOverviewScreen from './screens/admin/MapOverviewScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <AuthProvider>
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

          {/* Admin Screens */}
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="NodesList" component={NodesListScreen} />
          <Stack.Screen name="NodeForm" component={NodeFormScreen} />
          <Stack.Screen name="EdgesList" component={EdgesListScreen} />
          <Stack.Screen name="EdgeForm" component={EdgeFormScreen} />
          <Stack.Screen name="AnnotationsList" component={AnnotationsListScreen} />
          <Stack.Screen name="MapOverview" component={MapOverviewScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}

