// src/components/blocks/TextSectionBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TextSectionBlockProps {
  content: {
    title: string;
    content: string;
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

export default function TextSectionBlock({ content, styling, variables }: TextSectionBlockProps) {
  const title = replaceVariables(content.title, variables);
  const textContent = replaceVariables(content.content, variables);

  return (
    <View style={styles.textSection}>
      <Text style={[styles.textTitle, { color: styling.primaryColor }]}>
        {title}
      </Text>
      <Text style={styles.textContent}>
        {textContent}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  textSection: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
  },
  textTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  textContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});