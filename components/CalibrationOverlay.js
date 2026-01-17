import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { THEME_COLORS } from '../config';

const CalibrationOverlay = ({ config, onUpdate, onSave, onClose }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map Calibration</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.control}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Dot Base Size</Text>
          <Text style={styles.value}>{config.dotSize?.toFixed(1) || '8.0'}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={2}
          maximumValue={20}
          value={config.dotSize || 8}
          onValueChange={(val) => onUpdate({ ...config, dotSize: val })}
          minimumTrackTintColor={THEME_COLORS.primary}
          maximumTrackTintColor="#000000"
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>Log Dot Size</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Values will be printed to console</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 15,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  closeText: {
    fontSize: 20,
    color: THEME_COLORS.textSecondary,
    padding: 5,
  },
  control: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_COLORS.primary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  saveButton: {
    backgroundColor: THEME_COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 11,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 5,
  }
});

export default CalibrationOverlay;
