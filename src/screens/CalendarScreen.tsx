import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext'; // <- USE CONTEXT!
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import AppointmentCard from '../components/AppointmentCard';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Appointment, Contact } from '../../packages/types/dist';

type CalendarScreenProps = {
  navigation: any; // Adjust for react-navigation types
};

export default function CalendarScreen({ navigation }: CalendarScreenProps) {
  const { user } = useAuth();
  const {
    calendars,
    calendarMap,
    refetchCalendars, // ✅ correct name!
  } = useCalendar();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Maps for fast lookup
  const contactsMap: { [key: string]: Contact } = Object.fromEntries(
    contacts.map((c) => [c._id, c])
  );

  // Fetch all appointments for the location
  const fetchAppointments = () => {
    if (!user?.locationId) return;
    setLoading(true);
    api
      .get('/api/appointments', { params: { locationId: user.locationId } })
      .then((res) => setAppointments(res.data))
      .catch((e) => {
        console.error('Failed to fetch appointments:', e);
        setAppointments([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();
  }, [user?.locationId]);

  // Fetch users (for admin view)
  useEffect(() => {
    if (user?.role === 'admin' && user?.locationId) {
      api
        .get('/api/users', { params: { locationId: user.locationId } })
        .then((res) => setUsers(res.data))
        .catch((e) => {
          console.error('Failed to fetch users:', e);
          setUsers([]);
        });
    }
  }, [user?.role, user?.locationId]);

  // Fetch contacts (for contact picker in modal)
  useEffect(() => {
    if (!user?.locationId) return;
    api
      .get('/api/contacts', { params: { locationId: user.locationId } })
      .then((res) => setContacts(res.data))
      .catch((e) => {
        console.error('Failed to fetch contacts:', e);
        setContacts([]);
      });
  }, [user?.locationId]);

  // Filter appointments for the selected day and user/admin toggle
  const filteredAppointments = appointments.filter((a) => {
    const apptDate = new Date(a.start || a.time).toISOString().split('T')[0];
    const byDate = apptDate === selectedDate;
    if (!user || !user.role) return false;
    if (user.role === 'admin') {
      if (!showAllUsers) {
        return byDate && (a.userId === user._id || a.userId === user.userId);
      }
      return byDate;
    }
    return byDate && (a.userId === user._id || a.userId === user.userId);
  });

  // Handle FAB: Refresh calendars via context, then open modal
  const handleOpenCreateModal = async () => {
    if (!user?.locationId) {
      console.error('[CalendarScreen] No user.locationId found.');
      return;
    }
    try {
      await refetchCalendars(); // <- CORRECT USAGE, no argument
      setShowCreateModal(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load calendars for appointment.');
      console.error('[CalendarScreen] Failed to load calendars:', err);
    }
  };

  // Delete appointment with confirmation
  const handleDeleteAppointment = (appointmentId: string) => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'keep', style: 'cancel' },
      {
        text: 'Cancel Appointment',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.patch(`/api/appointments/${appointmentId}`, { status: 'cancelled' });
            fetchAppointments();
          } catch (err) {
            Alert.alert('Error', 'Failed to cancel appointment.');
            console.error('[CalendarScreen] Failed to cancel appointment:', err);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Calendar</Text>
      <Calendar
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          [selectedDate]: { selected: true, selectedColor: COLORS.accent },
        }}
        style={styles.calendar}
        theme={{
          todayTextColor: COLORS.accent,
          arrowColor: COLORS.accent,
        }}
      />

      {/* Admin: Toggle between My Appointments and All Users */}
      {user?.role === 'admin' && (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !showAllUsers && styles.toggleBtnActive]}
            onPress={() => setShowAllUsers(false)}
          >
            <Text style={!showAllUsers ? styles.toggleTextActive : styles.toggleText}>My Appointments</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, showAllUsers && styles.toggleBtnActive]}
            onPress={() => setShowAllUsers(true)}
          >
            <Text style={showAllUsers ? styles.toggleTextActive : styles.toggleText}>All Users</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>
        {loading
          ? 'Loading...'
          : filteredAppointments.length > 0
          ? `Appointments for ${selectedDate}:`
          : `No appointments for ${selectedDate}.`}
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.accent} />
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item._id}
          renderItem={({ item }: { item: Appointment }) => {
            const contact = contactsMap[item.contactId] || contacts.find(
              (c) => c._id === item.contactId || c.contactId === item.contactId
            );
            const calendar = calendarMap[item.calendarId];
            return (
              <AppointmentCard
                appointment={item}
                contact={contact}
                calendar={calendar}
                onContactPress={() => {
                  if (contact) navigation.navigate('EditContact', { contactId: contact._id });
                }}
                onEdit={() => {/* edit logic */}}
                onCancel={() => handleDeleteAppointment(item._id)}
              />
            );
          }}
          style={styles.list}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenCreateModal}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Create Appointment Modal */}
      <CreateAppointmentModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          if (!user?._id || !user?.locationId) {
            Alert.alert('Auth Error', 'Your session has expired. Please log out and log back in.');
            return;
          }
          if (!data.contactId || !data.calendarId) {
            Alert.alert('Missing Data', 'Contact and Calendar are required.');
            return;
          }
          try {
            await api.post('/api/appointments', {
              ...data,
              userId: user._id,
              locationId: user.locationId,
            });
            setShowCreateModal(false);
            fetchAppointments();
          } catch (err) {
            Alert.alert('Error', 'Failed to create appointment.');
            console.error('[CalendarScreen] Failed to create appointment:', err);
          }
        }}
        contacts={contacts}
        calendars={calendars}
        selectedDate={selectedDate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    fontSize: FONT.header,
    fontWeight: '700',
    color: COLORS.textDark,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 6,
  },
  calendar: { marginBottom: 10, borderRadius: RADIUS.card, marginHorizontal: 10 },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    justifyContent: 'flex-end',
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.accentMuted,
    marginLeft: 8,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.accent,
  },
  toggleText: {
    color: COLORS.textDark,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    color: COLORS.textDark,
  },
  list: { paddingHorizontal: 12 },
  fab: {
    position: 'absolute',
    right: 28,
    bottom: 28,
    backgroundColor: COLORS.accent,
    width: 56,
    height: 56,
    borderRadius: RADIUS.fab,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.fab,
  },
});
