import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SectionList,
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
  navigation: any;
};

type AppointmentSection = {
  title: string;
  data: Appointment[];
};

export default function CalendarScreen({ navigation }: CalendarScreenProps) {
  const { user } = useAuth();
  const { calendars, calendarMap, refetchCalendars } = useCalendar();

  // Get user timezone (default to system timezone)
  const userTimezone = user?.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver';

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [showUpcomingView, setShowUpcomingView] = useState(false);

  // Maps for fast lookup
  const contactsMap: { [key: string]: Contact } = Object.fromEntries(
    contacts.map((c) => [c._id, c])
  );

  // Helper function to convert UTC to local date
  const getLocalDate = (utcDateString: string): Date => {
    return new Date(utcDateString);
  };

  // Helper function to get date string in local timezone
  const getLocalDateString = (utcDateString: string): string => {
    const date = getLocalDate(utcDateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Helper function to get appointment start time
  const getAppointmentStart = (appointment: any): string | null => {
    return appointment.start || appointment.startTime || appointment.time || null;
  };

  // Helper function to get appointment end time
  const getAppointmentEnd = (appointment: any): string | null => {
    return appointment.end || appointment.endTime || null;
  };

  // Fetch all appointments
  const fetchAppointments = async () => {
    if (!user?.locationId) return;
    
    try {
      const appointmentsData = await appointmentService.list(user.locationId);
      
      if (__DEV__) {
        console.log('Fetched appointments:', appointmentsData.length);
      }
      
      // Filter out appointments with invalid dates
      const validAppointments = appointmentsData.filter(apt => {
        const startDate = getAppointmentStart(apt);
        return startDate && !isNaN(new Date(startDate).getTime());
      });
      
      setAppointments(validAppointments);
      
      // Create marked dates for calendar
      const marks: any = {};
      validAppointments.forEach(apt => {
        const startDate = getAppointmentStart(apt);
        if (startDate) {
          const dateKey = getLocalDateString(startDate);
          const calendarColor = calendarMap[apt.calendarId]?.color || COLORS.accent;
          
          if (!marks[dateKey]) {
            marks[dateKey] = { dots: [] };
          }
          
          // Add dot for this appointment's calendar color
          if (!marks[dateKey].dots.find((d: any) => d.color === calendarColor)) {
            marks[dateKey].dots.push({ color: calendarColor });
          }
        }
      });
      
      // Mark selected date
      if (marks[selectedDate]) {
        marks[selectedDate].selected = true;
        marks[selectedDate].selectedColor = COLORS.accent;
      } else {
        marks[selectedDate] = { selected: true, selectedColor: COLORS.accent };
      }
      
      setMarkedDates(marks);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to fetch appointments:', error);
      }
      Alert.alert('Error', 'Failed to load appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAppointments(),
      refetchCalendars(),
    ]);
  }, [user?.locationId]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [user?.locationId]);

  // Fetch users (for admin view)
  useEffect(() => {
    if (user?.role === 'admin' && user?.locationId && userService?.list) {
      userService.list(user.locationId)
        .then(setUsers)
        .catch((e) => {
          if (__DEV__) console.error('Failed to fetch users:', e);
        });
    }
  }, [user?.role, user?.locationId]);

  // Fetch contacts
  useEffect(() => {
    if (!user?.locationId || !contactService?.list) return;
    
    contactService.list(user.locationId)
      .then(setContacts)
      .catch((e) => {
        if (__DEV__) console.error('Failed to fetch contacts:', e);
      });
  }, [user?.locationId]);

  // Filter appointments for selected date
  const getAppointmentsForDate = useCallback((date: string) => {
    return appointments.filter((apt) => {
      const startDate = getAppointmentStart(apt);
      if (!startDate) return false;
      
      const apptDateLocal = getLocalDateString(startDate);
      const matchesDate = apptDateLocal === date;
      
      if (!user) return false;
      
      if (user.role === 'admin' && showAllUsers) {
        return matchesDate;
      }
      
      return matchesDate && (apt.userId === user._id || apt.userId === user.userId);
    });
  }, [appointments, user, showAllUsers]);

  // Get next 5 appointments grouped by date
  const getUpcomingAppointmentSections = useCallback((): AppointmentSection[] => {
    const now = new Date();
    const upcoming = appointments
      .filter(apt => {
        const startDate = getAppointmentStart(apt);
        if (!startDate) return false;
        
        const isUpcoming = new Date(startDate) >= now;
        
        if (!user) return false;
        if (user.role === 'admin' && showAllUsers) {
          return isUpcoming;
        }
        return isUpcoming && (apt.userId === user._id || apt.userId === user.userId);
      })
      .sort((a, b) => {
        const aStart = getAppointmentStart(a);
        const bStart = getAppointmentStart(b);
        if (!aStart || !bStart) return 0;
        return new Date(aStart).getTime() - new Date(bStart).getTime();
      })
      .slice(0, 5); // Get first 5

    // Group by date
    const sections: { [key: string]: Appointment[] } = {};
    upcoming.forEach(apt => {
      const startDate = getAppointmentStart(apt);
      if (!startDate) return;
      
      const dateKey = getLocalDateString(startDate);
      if (!sections[dateKey]) {
        sections[dateKey] = [];
      }
      sections[dateKey].push(apt);
    });

    // Convert to section array
    return Object.entries(sections).map(([date, apts]) => ({
      title: formatDateHeader(date),
      data: apts,
    }));
  }, [appointments, user, showAllUsers]);

  // Format date header
  const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const filteredAppointments = getAppointmentsForDate(selectedDate);

  // Handle FAB
  const handleOpenCreateModal = async () => {
    if (!user?.locationId) return;
    
    try {
      await refetchCalendars();
      setShowCreateModal(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load calendars');
    }
  };

  // Delete appointment
  const handleDeleteAppointment = (appointmentId: string) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              await appointmentService.update(appointmentId, { status: 'cancelled' });
              fetchAppointments();
            } catch (err) {
              Alert.alert('Error', 'Failed to cancel appointment');
            }
          },
        },
      ]
    );
  };

  const renderAppointmentItem = ({ item }: { item: Appointment }) => {
    const contact = contactsMap[item.contactId] || contacts.find(
      (c) => c._id === item.contactId || c.contactId === item.contactId
    );
    const calendar = calendarMap[item.calendarId];
    
    return (
      <AppointmentCard
        appointment={item}
        contact={contact}
        calendar={calendar}
        onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item._id })}
        onContactPress={() => {
          if (contact) navigation.navigate('ContactDetailScreen', { contact });
        }}
        onEdit={() => {}}
        onCancel={() => handleDeleteAppointment(item._id)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => setShowUpcomingView(!showUpcomingView)}
        >
          <Ionicons 
            name={showUpcomingView ? "calendar" : "list"} 
            size={24} 
            color={COLORS.accent} 
          />
        </TouchableOpacity>
      </View>

      {showUpcomingView ? (
        // Upcoming appointments view
        <SectionList
          sections={getUpcomingAppointmentSections()}
          keyExtractor={(item) => item._id}
          renderItem={renderAppointmentItem}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No upcoming appointments</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        // Calendar view
        <FlatList
          ListHeaderComponent={() => (
            <>
              <Calendar
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={markedDates}
                markingType="multi-dot"
                style={styles.calendar}
                theme={{
                  todayTextColor: COLORS.accent,
                  arrowColor: COLORS.accent,
                  dotColor: COLORS.accent,
                  selectedDayBackgroundColor: COLORS.accent,
                  selectedDayTextColor: '#fff',
                }}
                minDate={'2020-01-01'}
                maxDate={'2030-12-31'}
                current={selectedDate}
              />

              {user?.role === 'admin' && (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, !showAllUsers && styles.toggleBtnActive]}
                    onPress={() => setShowAllUsers(false)}
                  >
                    <Text style={!showAllUsers ? styles.toggleTextActive : styles.toggleText}>
                      My Appointments
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, showAllUsers && styles.toggleBtnActive]}
                    onPress={() => setShowAllUsers(true)}
                  >
                    <Text style={showAllUsers ? styles.toggleTextActive : styles.toggleText}>
                      All Users
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.sectionTitle}>
                {loading
                  ? 'Loading...'
                  : filteredAppointments.length > 0
                  ? `${formatDateHeader(selectedDate)} (${filteredAppointments.length})`
                  : `No appointments for ${formatDateHeader(selectedDate)}`}
              </Text>
            </>
          )}
          data={loading ? [] : filteredAppointments}
          keyExtractor={(item) => item._id}
          renderItem={renderAppointmentItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenCreateModal}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <CreateAppointmentModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          if (!user?._id || !user?.locationId) {
            Alert.alert('Error', 'Session expired. Please log in again.');
            return;
          }
          
          try {
            await appointmentService.create({
              ...data,
              userId: user._id,
              locationId: user.locationId,
            });
            setShowCreateModal(false);
            fetchAppointments();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to create appointment');
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
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: {
    fontSize: FONT.header,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  viewToggle: {
    padding: 8,
  },
  calendar: { 
    marginBottom: 10, 
    borderRadius: RADIUS.card, 
    marginHorizontal: 10,
    ...SHADOW.card,
  },
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
  sectionHeader: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHeaderText: {
    fontSize: FONT.body,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  listContent: { 
    paddingBottom: 100 
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT.body,
    color: COLORS.textLight,
  },
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