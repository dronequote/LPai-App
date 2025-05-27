// src/components/blocks/ContactInfoBlock.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ContactInfoBlockProps {
  content: {
    title: string;
    items: Array<{
      icon: string;
      label: string;
      value: string;
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

export default function ContactInfoBlock({ content, styling, variables }: ContactInfoBlockProps) {
  const title = replaceVariables(content.title, variables);

  return (
    <View style={styles.contactSection}>
      <Text style={[styles.contactTitle, { color: styling.primaryColor }]}>{title}</Text>
      {content.items.map((item, index) => {
        const iconName = iconMap[item.icon] || item.icon;
        const value = replaceVariables(item.value, variables);
        
        return (
          <View key={index} style={styles.contactItem}>
            {iconName && iconMap[item.icon] && (
              <Ionicons name={iconName as any} size={16} color={styling.accentColor} style={styles.contactIcon} />
            )}
            <Text style={styles.contactText}>{item.label}: {value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contactSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactIcon: {
    marginRight: 8,
  },
  contactText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
});