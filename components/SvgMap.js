import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import MahoganyMapSource from '../assets/Mahogany_building.svg';

const SvgMap = (props) => {
  const [xml, setXml] = useState(null);

  useEffect(() => {
    const loadSvg = async () => {
      try {
        // Resolve the asset (which might be a number/ID)
        const asset = Asset.fromModule(MahoganyMapSource);
        await asset.downloadAsync(); // Ensure it's available locally
        
        const uri = asset.localUri || asset.uri;
        if (uri) {
          const content = await FileSystem.readAsStringAsync(uri);
          setXml(content);
        }
      } catch (e) {
        console.error("Failed to load SVG map:", e);
      }
    };
    loadSvg();
  }, []);

  if (!xml) {
    return (
      <View 
        style={{
          width: props.width, 
          height: props.height, 
          justifyContent: 'center', 
          alignItems: 'center'
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <SvgXml xml={xml} {...props} />;
};

export default SvgMap;
