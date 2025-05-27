// src/components/blocks/SpecificationsBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SpecificationsBlockProps {
  content: {
    specs: Array<{
      title: string;
      items: string[];
    }>;
  };
  styling: { primaryColor: string; accentColor: string };
  variables: Record<string, string>;
}

const replaceVariables = (text: string, variables: Record<string, string>): string => {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || `{${key}}`);
  });
  return result;
};

export default function SpecificationsBlock({ content, styling, variables }: SpecificationsBlockProps) {
  return (
    <View style={styles.specificationsGrid}>
      {content.specs.map((spec, index) => (
        <View key={index} style={styles.specCard}>
          <Text style={[styles.specTitle, { color: styling.primaryColor }]}>
            {replaceVariables(spec.title, variables)}
          </Text>
          {spec.items.map((item, itemIndex) => (
            <Text key={itemIndex} style={styles.specText}>
              {replaceVariables(item, variables)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  specificationsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  specCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  specTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  specText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 4,
  },
});