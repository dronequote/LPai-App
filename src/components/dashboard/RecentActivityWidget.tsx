// src/components/dashboard/RecentActivityWidget.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../../styles/theme';

const activities = [
  {
    id: '1',
    type: 'quote',
    icon: 'document-text',
    color: '#27AE60',
    title: 'Quote signed',
    subtitle: 'Sarah Miller - $3,200',
    time: '2 hours ago',
  },
  {
    id: '2',
    type: 'payment',
    icon: 'card',
    color: '#9B59B6',
    title: 'Payment received',
    subtitle: 'John Smith - $450',
    time: '3 hours ago',
  },
  {
    id: '3',
    type: 'photo',
    icon: 'camera',
    color: '#00B3E6',
    title: 'Photos uploaded',
    subtitle: 'Bathroom renovation - 12 photos',
    time: '5 hours ago',
  },
];

export default function RecentActivityWidget() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>
      
      {activities.map((activity, index) => (
        <TouchableOpacity
          key={activity.id}
          style={[
            styles.activityItem,
            index < activities.length - 1 && styles.activityBorder,
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: activity.color + '20' }]}>
            <Ionicons name={activity.icon} size={20} color={activity.color} />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
          </View>
          <Text style={styles.activityTime}>{activity.time}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  viewAll: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activityBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  activitySubtitle: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 2,
  },
  activityTime: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
  },
});