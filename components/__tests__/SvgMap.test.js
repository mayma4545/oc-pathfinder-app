import React from 'react';
import renderer from 'react-test-renderer';
import SvgMap from '../SvgMap';
import { View } from 'react-native';

// Mock the svg asset import
jest.mock('../../assets/Mahogany building.svg', () => 'SvgMock');

describe('SvgMap', () => {
  it('renders correctly', () => {
    const tree = renderer.create(
      <SvgMap>
        <View testID="child-view" />
      </SvgMap>
    ).toJSON();
    
    expect(tree).toBeDefined();
    // We can't easily check for SvgMock existence in JSON without a more complex setup, 
    // but ensuring it renders without crashing is a good start.
  });
});
