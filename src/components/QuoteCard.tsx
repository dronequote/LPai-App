// components/QuoteCard.tsx
// Created: 2025-01-19
// iOS-style quote card component

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import { Quote } from '../../packages/types';

interface QuoteCardProps {
  quote: Quote;
  onPress: () => void;
  showProject?: boolean;
}

export default function QuoteCard({ quote, onPress, showProject = false }: QuoteCardProps) {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return COLORS.textGray;
      case 'sent':
        return COLORS.warning;
      case 'viewed':
        return '#FF9500'; // Orange
      case 'accepted':
      case 'signed':
        return COLORS.success;
      case 'rejected':
        return COLORS.error;
      default:
        return COLORS.textGray;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return 'document-text-outline';
      case 'sent':
        return 'send-outline';
      case 'viewed':
        return 'eye-outline';
      case 'accepted':
      case 'signed':
        return 'checkmark-circle-outline';
      case 'rejected':
        return 'close-circle-outline';
      default:
        return 'document-text-outline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateTotal = () => {
    const subtotal = quote.subtotal || 0;
    const tax = quote.taxAmount || 0;
    const discount = quote.discountAmount || 0;
    return subtotal + tax - discount;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.quoteNumber}>#{quote.quoteNumber || 'DRAFT'}</Text>
          <Text style={styles.title} numberOfLines={1}>{quote.title}</Text>
        </View>
        <Text style={styles.amount}>{formatCurrency(calculateTotal())}</Text>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusContainer}>
          <Ionicons 
            name={getStatusIcon(quote.status) as any} 
            size={16} 
            color={getStatusColor(quote.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(quote.status) }]}>
            {quote.status?.charAt(0).toUpperCase() + quote.status?.slice(1)}
          </Text>
        </View>
        
        {quote.viewedAt && (
          <Text style={styles.viewedText}>
            Viewed {formatDate(quote.viewedAt)}
          </Text>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textGray} />
          <Text style={styles.dateText}>
            {formatDate(quote.createdAt)}
          </Text>
        </View>
        
        {quote.validUntil && (
          <View style={styles.validityContainer}>
            <Ionicons name="time-outline" size={14} color={COLORS.textGray} />
            <Text style={styles.validityText}>
              Valid until {formatDate(quote.validUntil)}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {quote.status === 'draft' && (
          <View style={styles.actionButton}>
            <Ionicons name="send" size={16} color={COLORS.accent} />
            <Text style={styles.actionText}>Send</Text>
          </View>
        )}
        
        {quote.status === 'sent' && (
          <View style={styles.actionButton}>
            <Ionicons name="eye" size={16} color={COLORS.textGray} />
            <Text style={styles.actionText}>Preview</Text>
          </View>
        )}
        
        {(quote.status === 'viewed' || quote.status === 'accepted') && !quote.signatures?.length && (
          <View style={styles.actionButton}>
            <Ionicons name="create" size={16} color={COLORS.accent} />
            <Text style={[styles.actionText, { color: COLORS.accent }]}>Sign</Text>
          </View>
        )}
        
        {quote.signatures?.length > 0 && (
          <View style={styles.signedBadge}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
            <Text style={styles.signedText}>Signed</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.medium,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  quoteNumber: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  amount: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.accent,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    marginLeft: 6,
  },
  viewedText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 4,
  },
  validityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  validityText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textGray,
    marginLeft: 4,
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightSuccess,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  signedText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.success,
    marginLeft: 4,
  },
});