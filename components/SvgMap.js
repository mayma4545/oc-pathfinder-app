import React from 'react';
import MahoganyMap from '../assets/Mahogany_building.svg';
import { View, Text } from 'react-native';

const SvgMap = (props) => {
  // Safety check: if transformer works, it's a function. 
  // If it fails (returns number/ID), we show an error instead of crashing.
  if (typeof MahoganyMap === 'function') {
    return <MahoganyMap {...props} />;
  }

  console.error("SvgMap: Imported asset is not a component. Is react-native-svg-transformer configured?");
  
  return (
    <View style={{ width: props.width, height: props.height, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
      <Text style={{ color: 'red', textAlign: 'center' }}>SVG Load Error</Text>
    </View>
  );
};

export default SvgMap;