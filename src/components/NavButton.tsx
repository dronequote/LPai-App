import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export default function NavButton({ label, iconName, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Ionicons name={iconName} size={24} color="#00B3E6" />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '30%',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    margin: 6,
    elevation: 2,
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    color: '#1A1F36',
  },
});
