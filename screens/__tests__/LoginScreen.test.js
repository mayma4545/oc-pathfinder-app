import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { AuthProvider } from '../../contexts/AuthContext';
import { Alert } from 'react-native';

// Mock the AuthContext
const mockLogin = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

// Mock Navigation
const mockNavigation = {
  replace: jest.fn(),
  goBack: jest.fn(),
};

// Spy on Alert.alert
jest.spyOn(Alert, 'alert');

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows error alert when login fields are empty', () => {
    const { getByText } = render(<LoginScreen navigation={mockNavigation} />);
    
    fireEvent.press(getByText('Login'));
    
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter both username and password'
    );
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows specific error alert when login fails with invalid credentials', async () => {
    // Mock login to return failure
    mockLogin.mockResolvedValueOnce({
      success: false,
      error: 'Invalid username or password',
    });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Enter username'), 'wronguser');
    fireEvent.changeText(getByPlaceholderText('Enter password'), 'wrongpass');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('wronguser', 'wrongpass');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Login Failed',
        'Invalid username or password'
      );
    });
  });

  it('handles unexpected errors gracefully', async () => {
    // Mock login to throw an error
    mockLogin.mockRejectedValueOnce(new Error('Network error'));

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Enter username'), 'user');
    fireEvent.changeText(getByPlaceholderText('Enter password'), 'pass');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to login. Please try again.'
      );
    });
  });
});
