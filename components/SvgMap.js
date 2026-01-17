import React from 'react';
import { View, Text } from 'react-native';
import MahoganyMap from '../assets/Mahogany_building.svg';
import { MAP_ASSETS } from '../config';

const MAP_COMPONENTS = {
  'Mahogany_building.svg': MahoganyMap,
};

const SvgMap = ({ mapName = MAP_ASSETS.DEFAULT_CAMPUS_MAP, ...props }) => {
  const MapComponent = MAP_COMPONENTS[mapName];

  if (typeof MapComponent === 'function') {
    return <MapComponent {...props} />;
  }

  console.error(`SvgMap: Map "${mapName}" is not a valid component. Is react-native-svg-transformer configured?`);
  
  return (
    <View style={[{ width: props.width, height: props.height, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }, props.style]}>
      <Text style={{ color: 'red', textAlign: 'center' }}>SVG Load Error: {mapName}</Text>
    </View>
  );
};

export default SvgMap;