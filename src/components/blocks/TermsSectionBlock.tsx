// src/components/blocks/TermsSectionBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TermsSectionBlockProps {
  content: {
    title: string;
    content: string;
  };
  styling: { primaryColor: string; accentColor: string };
  variables: Record<string, string>;
  quote?: {
    termsAndConditions?: string;
    paymentTerms?: string;
    notes?: string;
  };
}

const replaceVariables = (text: string, variables: Record<string, string>): string => {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || `{${key}}`);
  });
  return result;
};

export default function TermsSectionBlock({ content, styling, variables, quote }: TermsSectionBlockProps) {
  const title = replaceVariables(content.title, variables);
  
  // ✅ DEFENSIVE FIX: Handle undefined quote gracefully
  const termsText = quote?.termsAndConditions || replaceVariables(content.content, variables);

  // Debug logging to help troubleshoot
  console.log('[TermsSectionBlock] Props received:', {
    hasContent: !!content,
    hasStyling: !!styling,
    hasVariables: !!variables,
    hasQuote: !!quote,
    quoteKeys: quote ? Object.keys(quote) : 'NO_QUOTE',
    termsFromQuote: quote?.termsAndConditions,
    termsFromTemplate: content?.content,
    finalTermsText: termsText
  });

  return (
    <View style={styles.termsSection}>
      <Text style={[styles.termsTitle, { color: styling.primaryColor }]}>
        {title}
      </Text>
      <Text style={styles.termsText}>
        {termsText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  termsSection: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  termsText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});