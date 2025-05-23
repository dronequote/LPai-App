import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import JobCard from '../components/JobCard';
import NavButton from '../components/NavButton';
import CompactAppointmentCard from '../components/CompactAppointmentCard';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import api from '../lib/api';

// --- THEME ---
import { COLORS, FONT, RADIUS } from '../styles/theme';

// --- TYPES ---
import type { Appointment, Contact, Calendar, Project, User } from '../../packages/types/dist';

// --- NAVIGATION TYPES (if using react-navigation) ---
import type { StackNavigationProp } from '@react-navigation/stack';
type Props = {
  navigation: StackNavigationProp<any, any>;
};

// --- QUICK ACTION BUTTONS ---
const actions = [
  { label: 'Calendar', icon: 'calendar-outline', screen: 'Calendar' },
  { label: 'Contacts', icon: 'person-circle-outline', screen: 'Contacts' },
  { label: 'Projects', icon: 'folder-open-outline', screen: 'Projects' },
  { label: 'Quote Builder', icon: 'construct-outline', screen: 'QuoteBuilder' },
  { label: 'Conversations', icon: 'chatbox-ellipses-outline', screen: 'Conversations' },
  { label: 'Job Completion', icon: 'checkmark-done-circle-outline', screen: 'JobCompletion' },
];

export default function HomeScreen({ navigation }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const { user } = useAuth() as { user: User | null };
  const { calendarMap } = useCalendar();

  // --- FETCH APPOINTMENTS ---
  useEffect(() => {
    async function loadAppointments() {
      if (!user?.locationId) return;
      setLoadingAppointments(true);
      try {
        const res = await api.get('/api/appointments', {
          params: { locationId: user.locationId },
        });
        const now = new Date();
        const upcoming = (res.data as Appointment[] || [])
          .filter(a => new Date(a.start || a.time) > now)
          .sort((a, b) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime())
          .slice(0, 3);
        setAppointments(upcoming);
      } catch (error) {
        console.error('Failed to fetch appointments:', error);
        setAppointments([]);
      } finally {
        setLoadingAppointments(false);
      }
    }
    loadAppointments();
  }, [user?.locationId]);

  // --- FETCH CONTACTS ---
  useEffect(() => {
    async function loadContacts() {
      if (!user?.locationId) return;
      setLoadingContacts(true);
      try {
        const res = await api.get('/api/contacts', {
          params: { locationId: user.locationId },
        });
        setContacts(res.data as Contact[] || []);
      } catch (error) {
        console.error('Failed to fetch contacts:', error);
        setContacts([]);
      } finally {
        setLoadingContacts(false);
      }
    }
    loadContacts();
  }, [user?.locationId]);

  // --- FETCH PROJECTS ---
  useEffect(() => {
    async function loadProjects() {
      if (!user?.locationId) return;
      setLoadingProjects(true);
      try {
        const res = await api.get('/api/projects', {
          params: { locationId: user.locationId },
        });
        const activeStatuses = ['Open', 'In Progress', 'Scheduled', 'Quoted'];
        const jobs = (res.data as Project[] || [])
          .filter(p => activeStatuses.includes(p.status))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3);
        setProjects(jobs);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, [user?.locationId]);

  // --- CONTACT LOOKUP MAP ---
  const contactsMap: Record<string, Contact> = Object.fromEntries((contacts || []).map(c => [c._id, c]));

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        name={user?.name || 'User'}
        navigation={navigation}
        onPressNotification={() => {}}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* --- UPCOMING APPOINTMENTS --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          {loadingAppointments || loadingContacts ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : appointments.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming appointments.</Text>
          ) : (
            appointments.map((item) => (
              <CompactAppointmentCard
                key={item._id || item.id}
                appointment={item}
                contact={contactsMap[item.contactId]}
                calendar={calendarMap[item.calendarId]}
                onPress={() =>
                  navigation.navigate('AppointmentDetail', {
                    appointmentId: item._id || item.id,
                  })
                }
              />
            ))
          )}
        </View>

        {/* --- JOBS IN PROGRESS --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs In Progress</Text>
          {loadingProjects ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : projects.length === 0 ? (
            <Text style={styles.emptyText}>No jobs in progress.</Text>
          ) : (
            projects.map((item) => (
              <JobCard
                key={item._id || item.id}
                title={item.title}
                subtitle={item.contactName || item.contactId}
              />
            ))
          )}
        </View>

        {/* --- QUICK ACTION BUTTONS --- */}
        <View style={styles.grid}>
          {actions.map((action, index) => (
            <NavButton
              key={index}
              label={action.label}
              iconName={action.icon}
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
});
