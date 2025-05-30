// src/components/dashboard/TodayStatsWidget.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

export default function TodayStatsWidget({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    appointments: 0,
    completed: 0,
    revenue: 0,
    photos: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    // In real app, load from API
    // For now, using realistic mock data
    setStats({
      appointments: 3,
      completed: 2,
      revenue: 1250,
      photos: 8,
    });
  };

  const statCards = [
    {
      icon: 'calendar',
      color: '#00B3E6',
      value: `${stats.completed}/${stats.appointments}`,
      label: 'Completed',
      onPress: () => navigation.navigate('Calendar'),
    },
    {
      icon: 'cash',
      color: '#27AE60',
      value: `$${stats.revenue}`,
      label: 'Collected',
      onPress: () => navigation.navigate('Projects'),
    },
    {
      icon: 'camera',
      color: '#9B59B6',
      value: stats.photos,
      label: 'Photos',
      onPress: () => navigation.navigate('Projects'),
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Progress</Text>
      <View style={styles.statsRow}>
        {statCards.map((stat, index) => (
          <TouchableOpacity
            key={index}
            style={styles.statCard}
            onPress={stat.onPress}
          >
            <Ionicons name={stat.icon} size={24} color={stat.color} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 4,
  },
});