import React from 'react';
import { render } from '@testing-library/react-native';
import SvgMap from '../SvgMap';

// Mock the config
jest.mock('../../config', () => ({
  MAP_ASSETS: {
    DEFAULT_CAMPUS_MAP: 'Mahogany_building.svg',
  },
}));

// Mock the SVG component
jest.mock('../../assets/Mahogany_building.svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props) => <View {...props} testID="mahogany-svg" />,
  };
});

describe('SvgMap Component', () => {
  it('renders correctly with default map', () => {
    const { getByTestId } = render(<SvgMap />);
    expect(getByTestId('mahogany-svg')).toBeTruthy();
  });

  it('renders error message for invalid map', () => {
    const { getByText } = render(<SvgMap mapName="invalid.svg" />);
    expect(getByText(/SVG Load Error: invalid.svg/)).toBeTruthy();
  });
});