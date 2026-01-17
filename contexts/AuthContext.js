import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    
    // Register callback for session expiry (401 from API)
    ApiService.setLogoutCallback(() => {
      setUser(null);
      setIsAdmin(false);
      // We can also show an alert here if needed, but the redirect is automatic via state change
    });
  }, []);

  const checkAuthStatus = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const adminStatus = await AsyncStorage.getItem('isAdmin');
      const token = await AsyncStorage.getItem('authToken');
      
      if (storedUser && adminStatus === 'true' && token) {
        setUser(JSON.parse(storedUser));
        setIsAdmin(true);
      } else {
        // Inconsistent state or no session
        await AsyncStorage.multiRemove(['user', 'isAdmin', 'authToken']);
        setUser(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await ApiService.adminLogin(username, password);
      
      if (response.success) {
        setUser(response.user);
        setIsAdmin(true);
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.error || 'Login failed. Please try again.' 
      };
    }
  };

  const logout = async () => {
    try {
      await ApiService.adminLogout();
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
