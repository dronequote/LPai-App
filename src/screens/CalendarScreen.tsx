import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { appointmentService } from '../services/appointmentService';
import { contactService } from '../services/contactService';
import { userService } from '../services/userService';
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
    refetchCalendars,
  } = useCalendar();

  // Helper function to validate dates
  const isValidDate = (dateString: any): boolean => {
    if (!dateString) return false;
    try {
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
    } catch {
      return false;
    }
  };

  // Helper function to get appointment start time (handles different field names)
  const getAppointmentStart = (appointment: any): string | null => {
    return appointment.start || appointment.startTime || appointment.time || null;
  };

  // Helper function to get appointment end time (handles different field names)
  const getAppointmentEnd = (appointment: any): string | null => {
    return appointment.end || appointment.endTime || null;
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    // Ensure we're not in an invalid timezone scenario
    if (isNaN(today.getTime())) {
      return '2025-01-01'; // Fallback date
    }
    return today.toISOString().split('T')[0];
  });
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

  // Fetch all appointments for the location using appointmentService
  const fetchAppointments = async () => {
    if (!user?.locationId) return;
    setLoading(true);
    try {
      const appointmentsData = await appointmentService.list(user.locationId);
      
      if (__DEV__) {
        console.log('Raw appointments data:', appointmentsData);
        // Check for invalid dates
        appointmentsData.forEach((apt, index) => {
          const startDate = getAppointmentStart(apt);
          const endDate = getAppointmentEnd(apt);
          if (!isValidDate(startDate)) {
            console.error(`Invalid date in appointment ${index}:`, apt);
          }
        });
      }
      
      // Filter out appointments with invalid dates
      const validAppointments = appointmentsData.filter(apt => {
        const startDate = getAppointmentStart(apt);
        const hasValidDate = isValidDate(startDate);
        if (!hasValidDate && __DEV__) {
          console.warn('Filtering out appointment with invalid date:', apt);
        }
        return hasValidDate;
      });
      
      setAppointments(validAppointments);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to fetch appointments:', error);
      }
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user?.locationId]);

  // Fetch users (for admin view) using userService
  useEffect(() => {
    if (user?.role === 'admin' && user?.locationId) {
      // Check if userService exists, otherwise skip for now
      if (typeof userService !== 'undefined' && userService.list) {
        userService.list(user.locationId)
          .then(setUsers)
          .catch((e) => {
            if (__DEV__) {
              console.error('Failed to fetch users:', e);
            }
            setUsers([]);
          });
      } else {
        if (__DEV__) {
          console.log('userService not available yet');
        }
      }
    }
  }, [user?.role, user?.locationId]);

  // Fetch contacts (for contact picker in modal) using contactService
  useEffect(() => {
    if (!user?.locationId) return;
    
    // Check if contactService exists, otherwise skip for now
    if (typeof contactService !== 'undefined' && contactService.list) {
      contactService.list(user.locationId)
        .then(setContacts)
        .catch((e) => {
          if (__DEV__) {
            console.error('Failed to fetch contacts:', e);
          }
          setContacts([]);
        });
    } else {
      if (__DEV__) {
        console.log('contactService not available yet');
      }
    }
  }, [user?.locationId]);

  // Filter appointments for the selected day and user/admin toggle
  const filteredAppointments = appointments.filter((a) => {
    const startDate = getAppointmentStart(a);
    if (!isValidDate(startDate)) {
      if (__DEV__) {
        console.warn('Invalid appointment date:', a);
      }
      return false;
    }
    const apptDate = new Date(startDate).toISOString().split('T')[0];
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
      if (__DEV__) {
        console.error('[CalendarScreen] No user.locationId found.');
      }
      return;
    }
    try {
      await refetchCalendars();
      setShowCreateModal(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load calendars for appointment.');
      if (__DEV__) {
        console.error('[CalendarScreen] Failed to load calendars:', err);
      }
    }
  };

  // Delete appointment with confirmation using appointmentService
  const handleDeleteAppointment = (appointmentId: string) => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Appointment',
        style: 'destructive',
        onPress: async () => {
          try {
            // Use appointmentService to update status
            await appointmentService.update(appointmentId, { status: 'cancelled' });
            fetchAppointments(); // Refresh the list
          } catch (err) {
            Alert.alert('Error', 'Failed to cancel appointment.');
            if (__DEV__) {
              console.error('[CalendarScreen] Failed to cancel appointment:', err);
            }
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={() => (
          <>
            <Text style={styles.header}>Calendar</Text>
            {selectedDate && (
              <Calendar
                onDayPress={(day) => {
                  if (__DEV__) {
                    console.log('Day pressed:', day);
                  }
                  setSelectedDate(day.dateString);
                }}
                markedDates={{
                  [selectedDate]: { selected: true, selectedColor: COLORS.accent },
                }}
                style={styles.calendar}
                theme={{
                  todayTextColor: COLORS.accent,
                  arrowColor: COLORS.accent,
                }}
                // Add these props to prevent date issues
                minDate={'2020-01-01'}
                maxDate={'2030-12-31'}
                current={selectedDate}
              />
            )}

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

            {loading && (
              <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.accent} />
            )}
          </>
        )}
        data={loading ? [] : filteredAppointments}
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
              onPress={() => {
                navigation.navigate('AppointmentDetail', { 
                  appointmentId: item._id 
                });
              }}
              onContactPress={() => {
                if (contact) navigation.navigate('ContactDetailScreen', { contact: contact });
              }}
              onEdit={() => {/* edit logic */}}
              onCancel={() => handleDeleteAppointment(item._id)}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
      />

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
            // Use appointmentService to create appointment
            await appointmentService.create({
              ...data,
              userId: user._id,
              locationId: user.locationId,
            });
            setShowCreateModal(false);
            fetchAppointments(); // Refresh the list
          } catch (err: any) {
            if (__DEV__) {
              console.error('[CalendarScreen] Failed to create appointment:', err);
            }
            
            // Better error message based on the error
            let errorMessage = 'Failed to create appointment.';
            if (err.response?.status === 400 && err.response?.data?.error?.includes('GHL API key')) {
              errorMessage = 'Authentication issue. Please contact support to refresh OAuth tokens.';
            } else if (err.response?.data?.error) {
              errorMessage = err.response.data.error;
            }
            
            Alert.alert('Error', errorMessage);
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
  listContent: { paddingBottom: 100 }, // Add padding for FAB
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