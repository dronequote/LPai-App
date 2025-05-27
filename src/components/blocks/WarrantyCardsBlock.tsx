// src/components/blocks/WarrantyCardsBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WarrantyCardsBlockProps {
  content: {
    cards: Array<{
      icon: string;
      title: string;
      subtitle: string;
      description: string;
    }>;
  };
  styling: { primaryColor: string; accentColor: string };
  variables: Record<string, string>;
}

const iconMap: Record<string, string> = {
  '🔧': 'construct-outline',
  '🏠': 'home-outline',
  '💰': 'cash-outline',
  '⚙️': 'settings-outline',
  '🛡️': 'shield-outline',
  '📋': 'clipboard-outline',
  '🏆': 'trophy-outline',
  '⚡': 'flash-outline',
  '📞': 'call-outline',
  '✉️': 'mail-outline',
  '📍': 'location-outline',
  '🚨': 'warning-outline',
  '👨‍🔧': 'person-outline',
};

export function WarrantyCardsBlock({ content, styling, variables }: WarrantyCardsBlockProps) {
  return (
    <View style={styles.warrantyCards}>
      {content.cards.map((card, index) => {
        const iconName = iconMap[card.icon] || card.icon;
        
        return (
          <View key={index} style={styles.warrantyCard}>
            {iconName && iconMap[card.icon] && (
              <Ionicons name={iconName as any} size={32} color={styling.primaryColor} style={styles.warrantyCardIcon} />
            )}
            <Text style={styles.warrantyCardTitle}>
              {replaceVariables(card.title, variables)}
            </Text>
            <Text style={[styles.warrantyCardSubtitle, { color: styling.accentColor }]}>
              {replaceVariables(card.subtitle, variables)}
            </Text>
            <Text style={styles.warrantyCardDescription}>
              {replaceVariables(card.description, variables)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  warrantyCards: {
    gap: 16,
    marginBottom: 30,
  },
  warrantyCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  warrantyCardIcon: {
    marginBottom: 12,
  },
  warrantyCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  warrantyCardSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  warrantyCardDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});