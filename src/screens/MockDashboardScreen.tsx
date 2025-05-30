// src/screens/DashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import api from '../lib/api';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    activeProjects: 0,
    weekRevenue: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // Load your data here
    // For now, using mock data
    setStats({
      todayAppointments: 3,
      activeProjects: 5,
      weekRevenue: 4250,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Good {getTimeOfDay()}, {user?.name?.split(' ')[0]}! 👋
            </Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Calendar')}>
            <Ionicons name="calendar" size={24} color="#00B3E6" />
            <Text style={styles.statNumber}>{stats.todayAppointments}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Projects')}>
            <Ionicons name="briefcase" size={24} color="#27AE60" />
            <Text style={styles.statNumber}>{stats.activeProjects}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard}>
            <Ionicons name="cash" size={24} color="#9B59B6" />
            <Text style={styles.statNumber}>${stats.weekRevenue}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </TouchableOpacity>
        </View>

        {/* Next Appointment Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Appointment</Text>
          <TouchableOpacity 
            style={styles.appointmentCard}
            onPress={() => navigation.navigate('AppointmentDetail')}
          >
            <View style={styles.appointmentTime}>
              <Text style={styles.timeText}>3:20</Text>
              <Text style={styles.timePeriod}>PM</Text>
            </View>
            <View style={styles.appointmentInfo}>
              <Text style={styles.customerName}>Sarah Miller</Text>
              <Text style={styles.jobType}>Leak Repair</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.textGray} />
                <Text style={styles.locationText}>123 Main St</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.navigateButton}>
              <Ionicons name="navigate" size={20} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="camera" size={24} color="#00B3E6" />
              </View>
              <Text style={styles.actionLabel}>Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="document-text" size={24} color="#27AE60" />
              </View>
              <Text style={styles.actionLabel}>Quote</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="card" size={24} color="#9B59B6" />
              </View>
              <Text style={styles.actionLabel}>Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="time" size={24} color="#F39C12" />
              </View>
              <Text style={styles.actionLabel}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  date: {
    fontSize: 14,
    color: COLORS.textGray,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: (width - 60) / 3,
    ...SHADOW.card,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  appointmentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW.card,
  },
  appointmentTime: {
    alignItems: 'center',
    marginRight: 16,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  timeText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.accent,
  },
  timePeriod: {
    fontSize: 14,
    color: COLORS.accent,
  },
  appointmentInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  jobType: {
    fontSize: 14,
    color: COLORS.textGray,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.textGray,
    marginLeft: 4,
  },
  navigateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    width: (width - 60) / 4,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.textDark,
    fontWeight: '500',
  },
});