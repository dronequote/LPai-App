// src/components/blocks/QuoteBreakdownBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface QuoteBreakdownBlockProps {
  content: {
    title: string;
    labels: {
      subtotal: string;
      tax: string;
      total: string;
      quantity: string;
      sectionTotal: string;
    };
  };
  styling: { primaryColor: string; accentColor: string };
  variables: Record<string, string>;
  quote: any; // The quote object with sections, pricing, etc.
}

const replaceVariables = (text: string, variables: Record<string, string>): string => {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || `{${key}}`);
  });
  return result;
};

export default function QuoteBreakdownBlock({ content, styling, variables, quote }: QuoteBreakdownBlockProps) {
  console.log('[QuoteBreakdownBlock] Received props:', {
    hasContent: !!content,
    hasStyling: !!styling,
    hasVariables: !!variables,
    hasQuote: !!quote,
    quoteStructure: quote ? {
      hasSections: Array.isArray(quote.sections),
      sectionsLength: quote.sections?.length,
      hasSubtotal: quote.hasOwnProperty('subtotal'),
      hasTotal: quote.hasOwnProperty('total'),
      hasTermsAndConditions: quote.hasOwnProperty('termsAndConditions')
    } : 'NO_QUOTE'
  });

  if (!quote) {
    return (
      <View style={styles.pricingBreakdown}>
        <Text style={styles.noDataText}>No quote data available</Text>
      </View>
    );
  }

  const sections = quote.sections || [];
  const subtotal = quote.subtotal || 0;
  const taxAmount = quote.taxAmount || 0;
  const total = quote.total || 0;

  return (
    <View style={styles.pricingBreakdown}>
      {sections.map((section: any, index: number) => (
        <View key={index} style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { borderBottomColor: styling?.primaryColor || '#2E86AB' }]}>
            {section.name || 'Unnamed Section'}
          </Text>
          {(section.lineItems || []).map((item: any, itemIndex: number) => (
            <View key={itemIndex} style={styles.lineItem}>
              <View style={styles.lineItemLeft}>
                <Text style={styles.lineItemName}>{item.name || 'Unnamed Item'}</Text>
                <Text style={styles.lineItemQty}>
                  {content?.labels?.quantity || 'Qty'}: {item.quantity || 1}
                </Text>
              </View>
              <Text style={[styles.lineItemPrice, { color: styling?.primaryColor || '#2E86AB' }]}>
                ${(item.totalPrice || 0).toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={styles.sectionTotal}>
            <Text style={[styles.sectionTotalText, { color: styling?.accentColor || '#A23B72' }]}>
              {content?.labels?.sectionTotal || 'Section Total'}: ${(section.subtotal || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{content?.labels?.subtotal || 'Subtotal'}</Text>
          <Text style={styles.totalValue}>${subtotal.toLocaleString()}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{content?.labels?.tax || 'Tax'}</Text>
          <Text style={styles.totalValue}>${taxAmount.toLocaleString()}</Text>
        </View>
        <View style={[styles.totalRow, styles.finalTotal]}>
          <Text style={[styles.finalTotalLabel, { color: styling?.primaryColor || '#2E86AB' }]}>
            {content?.labels?.total || 'Total'}
          </Text>
          <Text style={[styles.finalTotalValue, { color: styling?.accentColor || '#A23B72' }]}>
            ${total.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pricingBreakdown: {
    gap: 16,
    marginBottom: 24,
  },
  sectionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lineItemLeft: {
    flex: 1,
  },
  lineItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  lineItemQty: {
    fontSize: 14,
    color: '#6b7280',
  },
  lineItemPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'flex-end',
  },
  sectionTotalText: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  finalTotal: {
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    marginTop: 8,
  },
  finalTotalLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  finalTotalValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  noDataText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
});