// src/components/blocks/BenefitCardsBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BenefitCardsBlockProps {
  content: {
    cards: Array<{
      icon: string;
      title: string;
      subtitle: string;
      description: string;
    }>;
  };
  styling: {
    primaryColor: string;
    accentColor: string;
  };
  variables: Record<string, string>;
}

// Icon mapping from emoji to Ionicons
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

const replaceVariables = (text: string, variables: Record<string, string>): string => {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || `{${key}}`);
  });
  return result;
};

export default function BenefitCardsBlock({ content, styling, variables }: BenefitCardsBlockProps) {
  return (
    <View style={styles.benefitsGrid}>
      {content.cards.map((card, index) => {
        const iconName = iconMap[card.icon] || card.icon;
        const title = replaceVariables(card.title, variables);
        const subtitle = replaceVariables(card.subtitle, variables);
        const description = replaceVariables(card.description, variables);
        
        return (
          <View key={index} style={styles.benefitCard}>
            {iconName && iconMap[card.icon] && (
              <Ionicons name={iconName as any} size={32} color={styling.primaryColor} style={styles.benefitIcon} />
            )}
            <Text style={styles.benefitTitle}>{title}</Text>
            <Text style={[styles.benefitSubtitle, { color: styling.accentColor }]}>{subtitle}</Text>
            <Text style={styles.benefitText}>{description}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  benefitsGrid: {
    gap: 16,
    marginBottom: 30,
  },
  benefitCard: {
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
  benefitIcon: {
    marginBottom: 12,
  },
  benefitTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  benefitSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});