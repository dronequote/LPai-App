// src/components/blocks/QuoteHeaderBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface QuoteHeaderBlockProps {
  content: {
    title: string;
    subtitle: string;
    customerLabel: string;
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

export default function QuoteHeaderBlock({ content, styling, variables }: QuoteHeaderBlockProps) {
  return (
    <View style={styles.quoteHeader}>
      <Text style={[styles.quoteTitle, { color: styling.primaryColor }]}>
        {replaceVariables(content.title, variables)}
      </Text>
      <Text style={styles.quoteSubtitle}>
        {replaceVariables(content.subtitle, variables)}
      </Text>
      <Text style={styles.quoteCustomer}>
        {replaceVariables(content.customerLabel, variables)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quoteHeader: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quoteTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  quoteSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  quoteCustomer: {
    fontSize: 16,
    color: '#6b7280',
  },
});