import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import JobCard from '../components/JobCard';
import NavButton from '../components/NavButton';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';


const mockJobs = [
  { id: '1', title: 'Kitchen Remodel – Mike R.' }, // TODO: Replace with jobs from DB
  { id: '2', title: 'Panel Upgrade – Anna C.' },  // TODO: Replace with jobs from DB
];

const actions = [
  { label: 'Dashboard', icon: 'grid-outline', screen: 'Dashboard' },
  { label: 'Contacts', icon: 'person-circle-outline', screen: 'Contacts' },
  { label: 'Projects', icon: 'folder-open-outline', screen: 'Projects' },
  { label: 'Quote Builder', icon: 'construct-outline', screen: 'QuoteBuilder' },
  { label: 'Conversations', icon: 'chatbox-ellipses-outline', screen: 'Conversations' },
  { label: 'Job Completion', icon: 'checkmark-done-circle-outline', screen: 'JobCompletion' },
]; // TODO: If these are role-based or dynamic, replace with config from DB or user permissions

export default function HomeScreen({ navigation }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function loadAppointments() {
      try {
        const data = await fetchAppointments();
        setAppointments(data); // TODO: Ensure data is shaped correctly from GHL sync
      } catch (error) {
        console.error('Failed to fetch appointments:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAppointments();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        name={user?.name || 'User'}  // TODO: Replace with dynamic user name from DB
        navigation={navigation}
        onPressNotification={() => {}}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Today's Appointments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Appointments</Text>
          {loading ? (
            <Text>Loading...</Text>
          ) : appointments.length === 0 ? (
            <Text>No appointments today.</Text>
          ) : (
            appointments.map((item) => (
              <View key={item._id || item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>{item.time}</Text>
              </View>
            ))
          )}
        </View>

        {/* Jobs In Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs In Progress</Text>
          {mockJobs.map((item) => (
            <JobCard key={item.id} title={item.title} />
          ))}
        </View>

        {/* Action Buttons */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1F36',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    color: '#1A1F36',
    fontWeight: '500',
  },
  cardSub: {
    fontSize: 14,
    color: '#AAB2BD',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
});
