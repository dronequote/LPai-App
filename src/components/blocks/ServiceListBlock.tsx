// src/components/blocks/ServiceListBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ServiceListBlockProps {
  content: {
    title: string;
    items: string[];
  };
  styling: { primaryColor: string; accentColor: string };
  variables: Record<string, string>;
}

// ✅ FIX: Add missing replaceVariables function
const replaceVariables = (text: string, variables: Record<string, string>): string => {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || `{${key}}`);
  });
  return result;
};

export function ServiceListBlock({ content, styling, variables }: ServiceListBlockProps) {
  return (
    <View style={styles.serviceInfo}>
      <Text style={[styles.serviceInfoTitle, { color: styling.primaryColor }]}>
        {replaceVariables(content.title, variables)}
      </Text>
      <View style={styles.serviceInfoList}>
        {content.items.map((item, index) => (
          <Text key={index} style={styles.serviceInfoItem}>
            {replaceVariables(item, variables)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  serviceInfo: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  serviceInfoList: {
    gap: 8,
  },
  serviceInfoItem: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
});