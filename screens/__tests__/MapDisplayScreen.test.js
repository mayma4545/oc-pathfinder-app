import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import MapDisplayScreen from '../MapDisplayScreen';
import { MAP_ASSETS } from '../../config';
import ApiService from '../../services/ApiService';

// Mock dependencies
jest.mock('../../services/ApiService', () => ({
  findPath: jest.fn(),
  getCampusMap: jest.fn(),
}));
jest.mock('../../services/OfflineService', () => ({
  predictiveCache: jest.fn(),
  getImageUrl: jest.fn(),
  getCampusMapImageUrl: jest.fn(),
  getOfflineStats: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../components/SvgMap', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => <View {...props} testID="svg-map-mock" />;
});

const mockRoute = {
  params: {
    startNode: { node_id: 1, node_code: 'A', name: 'Node A', building: 'B' },
    endNode: { node_id: 2, node_code: 'B', name: 'Node B', building: 'B' },
  },
};

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
};

describe('MapDisplayScreen', () => {
  it('renders correctly after loading', async () => {
    ApiService.findPath.mockResolvedValue({ success: true, path: [] });
    ApiService.getCampusMap.mockResolvedValue({ success: true, map: { image_url: 'test.jpg' } });

    const { findByText } = render(<MapDisplayScreen route={mockRoute} navigation={mockNavigation} />);
    
    expect(await findByText('Route Map')).toBeTruthy();
  });
});
