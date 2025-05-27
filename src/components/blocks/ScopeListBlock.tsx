// src/components/blocks/ScopeListBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ScopeListBlockProps {
  content: {
    title: string;
    items: string[];
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

export default function ScopeListBlock({ content, styling, variables }: ScopeListBlockProps) {
  const title = replaceVariables(content.title, variables);

  return (
    <View style={styles.scopeSection}>
      <Text style={[styles.scopeTitle, { color: styling.primaryColor }]}>
        {title}
      </Text>
      <View style={styles.scopeList}>
        {content.items.map((item, index) => (
          <Text key={index} style={styles.scopeItem}>
            {replaceVariables(item, variables)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scopeSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scopeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  scopeList: {
    gap: 8,
  },
  scopeItem: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
});