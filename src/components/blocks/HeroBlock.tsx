// src/components/blocks/HeroBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeroBlockProps {
  content: {
    title: string;
    subtitle: string;
    icon: string;
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

export default function HeroBlock({ content, styling, variables }: HeroBlockProps) {
  const title = replaceVariables(content.title, variables);
  const subtitle = replaceVariables(content.subtitle, variables);
  const iconName = iconMap[content.icon] || content.icon;

  return (
    <View style={styles.heroSection}>
      {iconName && iconMap[content.icon] && (
        <Ionicons name={iconName as any} size={48} color={styling.primaryColor} style={styles.heroIcon} />
      )}
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 30,
  },
  heroIcon: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});