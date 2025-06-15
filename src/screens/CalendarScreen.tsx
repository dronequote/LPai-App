// src/screens/CalendarScreen.tsx
// Updated: June 13, 2025
// Description: Calendar screen with upcoming appointments list and proper timezone handling

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
  ScrollView,
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
import CompactAppointmentCard from '../components/CompactAppointmentCard';
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

  // Get user's GHL ID for filtering
  const userGhlId = user?.ghlUserId || user?.userId;

  // Filter calendars to only show ones where user is a team member
  const userCalendars = calendars.filter(calendar => 
    calendar.teamMembers?.some(member => member.userId === userGhlId)
  );

  // Get user timezone (default to system timezone)
  const userTimezone = user?.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver';

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});

  // Maps for fast lookup
  const contactsMap: { [key: string]: Contact } = Object.fromEntries(
    contacts.map((c) => [c._id, c])
  );

  // Helper function to get appointment start time (handles different field names and formats)
  const getAppointmentStart = (appointment: any): string | null => {
    // Check multiple possible field names in order of preference
    let possibleStart = appointment.start || appointment.startTime || appointment.time || appointment.appointmentStart;
    
    // Handle MongoDB Date object format
    if (possibleStart && typeof possibleStart === 'object' && possibleStart.$date) {
      possibleStart = possibleStart.$date;
    }
    
    if (__DEV__ && possibleStart && appointment._id.includes('684c')) {
      console.log(`📅 [Calendar] Appointment ${appointment._id} start:`, possibleStart);
    }
    
    return possibleStart || null;
  };

  // Helper function to get appointment end time
  const getAppointmentEnd = (appointment: any): string | null => {
    let possibleEnd = appointment.end || appointment.endTime || appointment.appointmentEnd || null;
    
    // Handle MongoDB Date object format
    if (possibleEnd && typeof possibleEnd === 'object' && possibleEnd.$date) {
      possibleEnd = possibleEnd.$date;
    }
    
    return possibleEnd;
  };

  // Convert UTC to local date string (YYYY-MM-DD)
  const getLocalDateString = (utcDateString: string): string => {
    if (!utcDateString) return '';
    const date = new Date(utcDateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format time for display
  const formatTime = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Fetch all appointments
  const fetchAppointments = async () => {
    if (!user?.locationId || !userGhlId) return;
    
    try {
      // Clear cache to ensure fresh data
      await appointmentService.clearCache();
      
      // Get appointments for a wider date range to ensure we get all
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1); // 1 month ago
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2); // 2 months ahead
      
      const appointmentsData = await appointmentService.list(user.locationId, {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        limit: 100, // Get up to 100 appointments
        status: undefined, // Get all statuses
        // Don't pass userId - let's see if we get all appointments
      });
      
      if (__DEV__) {
        console.log('📅 [Calendar] Fetched appointments:', appointmentsData.length);
        console.log('📅 [Calendar] User GHL ID:', userGhlId);
        console.log('📅 [Calendar] Date range:', {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        });
        if (appointmentsData.length > 0) {
          console.log('First appointment:', appointmentsData[0]);
        }
      }
      
      // Filter appointments by assignedUserId matching our user's GHL ID
      const userAppointments = appointmentsData.filter(apt => 
        apt.assignedUserId === userGhlId
      );
      
      if (__DEV__) {
        console.log('📅 [Calendar] Filtered to user appointments:', userAppointments.length);
      }
      
      // Filter out appointments with invalid dates
      const validAppointments = userAppointments.filter(apt => {
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
            marks[dateKey] = { 
              marked: true,
              dots: [] 
            };
          }
          
          // Add dot for this appointment's calendar color
          if (!marks[dateKey].dots.find((d: any) => d.color === calendarColor)) {
            marks[dateKey].dots.push({ 
              key: apt._id,
              color: calendarColor 
            });
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
      
      if (__DEV__) {
        console.log('📅 [Calendar] Marked dates:', Object.keys(marks));
      }
      
      setMarkedDates(marks);
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [Calendar] Failed to fetch appointments:', error);
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
  }, [user?.locationId, userGhlId]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [user?.locationId, userGhlId]);

  // Fetch contacts
  useEffect(() => {
    if (!user?.locationId || !contactService?.list) return;
    
    contactService.list(user.locationId)
      .then(setContacts)
      .catch((e) => {
        if (__DEV__) console.error('Failed to fetch contacts:', e);
      });
  }, [user?.locationId]);

  // Get appointments for selected date
  const getAppointmentsForDate = useCallback((date: string) => {
    const filtered = appointments.filter((apt) => {
      const startDate = getAppointmentStart(apt);
      if (!startDate) return false;
      
      const apptDateLocal = getLocalDateString(startDate);
      const matchesDate = apptDateLocal === date;
      
      if (__DEV__ && matchesDate) {
        console.log(`📅 [Calendar] Appointment on ${date}:`, {
          id: apt._id,
          title: apt.title,
          assignedUserId: apt.assignedUserId,
        });
      }
      
      return matchesDate;
    });

    if (__DEV__ && date === selectedDate) {
      console.log(`📅 [Calendar] Appointments for ${date}:`, filtered.length);
    }

    return filtered;
  }, [appointments]);

  // Get upcoming appointments (next 5)
  const getUpcomingAppointments = useCallback((): AppointmentSection[] => {
    const now = new Date();
    const upcoming = appointments
      .filter(apt => {
        const startDate = getAppointmentStart(apt);
        if (!startDate) return false;
        
        const aptDate = new Date(startDate);
        return aptDate >= now;
      })
      .sort((a, b) => {
        const aStart = getAppointmentStart(a);
        const bStart = getAppointmentStart(b);
        if (!aStart || !bStart) return 0;
        return new Date(aStart).getTime() - new Date(bStart).getTime();
      });

    if (__DEV__) {
      console.log(`📅 [Calendar] Total upcoming appointments found:`, upcoming.length);
    }

    // Group by date
    const sections: { [key: string]: Appointment[] } = {};
    let count = 0;
    
    for (const apt of upcoming) {
      if (count >= 5) break; // Only show first 5
      
      const startDate = getAppointmentStart(apt);
      if (!startDate) continue;
      
      const dateKey = getLocalDateString(startDate);
      if (!sections[dateKey]) {
        sections[dateKey] = [];
      }
      sections[dateKey].push(apt);
      count++;
    }

    // Convert to section array
    return Object.entries(sections).map(([date, apts]) => ({
      title: formatDateHeader(date),
      data: apts,
    }));
  }, [appointments]);

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
  const upcomingSections = getUpcomingAppointments();

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
      <CompactAppointmentCard
        appointment={item}
        contact={contact}
        calendar={calendar}
        onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item._id })}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
      </View>

      <FlatList
        ListHeaderComponent={() => (
          <>
            {/* Calendar */}
            <Calendar
              onDayPress={(day) => {
                if (__DEV__) {
                  console.log('📅 [Calendar] Day pressed:', day.dateString);
                }
                setSelectedDate(day.dateString);
              }}
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
              current={selectedDate}
            />

            {/* Selected date appointments */}
            <View style={styles.selectedDateSection}>
              <Text style={styles.sectionTitle}>
                {formatDateHeader(selectedDate)}
              </Text>
              {loading ? (
                <ActivityIndicator style={styles.loader} color={COLORS.accent} />
              ) : filteredAppointments.length > 0 ? (
                <View style={styles.appointmentsList}>
                  {filteredAppointments.map((appointment) => (
                    <View key={appointment._id} style={styles.appointmentItem}>
                      {renderAppointmentItem({ item: appointment })}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noAppointments}>No appointments</Text>
              )}
            </View>

            {/* Upcoming appointments section */}
            <View style={styles.upcomingSection}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              {upcomingSections.length > 0 ? (
                upcomingSections.map((section, sectionIndex) => (
                  <View key={sectionIndex}>
                    <Text style={styles.dateHeader}>{section.title}</Text>
                    <View style={styles.appointmentsList}>
                      {section.data.map((appointment) => (
                        <View key={appointment._id} style={styles.appointmentItem}>
                          {renderAppointmentItem({ item: appointment })}
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noAppointments}>No upcoming appointments</Text>
              )}
            </View>

            {/* Bottom padding for FAB */}
            <View style={{ height: 100 }} />
          </>
        )}
        data={[]} // Empty data since we're using ListHeaderComponent
        renderItem={null}
        keyExtractor={() => 'calendar'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenCreateModal}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <CreateAppointmentModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          if (!user?._id || !user?.locationId || !userGhlId) {
            Alert.alert('Error', 'Session expired. Please log in again.');
            return;
          }
          
          if (__DEV__) {
            console.log('📅 [Calendar] Creating appointment with ghlUserId:', userGhlId);
          }
          
          try {
            await appointmentService.create({
              ...data,
              userId: user._id,
              assignedUserId: userGhlId, // Use GHL ID for assignment
              locationId: user.locationId,
            });
            setShowCreateModal(false);
            fetchAppointments();
          } catch (err: any) {
            if (__DEV__) {
              console.error('❌ [Calendar] Failed to create appointment:', err);
            }
            
            // Clear cache on error to ensure fresh data
            await appointmentService.clearCache();
            
            let errorMessage = 'Failed to create appointment';
            if (err.response?.data?.error?.includes('user id not part of calendar team')) {
              errorMessage = 'You are not authorized for this calendar. Please select a different calendar.';
            } else if (err.response?.data?.error) {
              errorMessage = err.response.data.error;
            }
            
            Alert.alert('Error', errorMessage);
          }
        }}
        contacts={contacts}
        calendars={userCalendars} // Only show calendars where user is a team member
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: {
    fontSize: FONT.header,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  calendar: { 
    marginHorizontal: 10,
    borderRadius: RADIUS.card,
    ...SHADOW.card,
  },
  selectedDateSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  upcomingSection: {
    marginTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  dateHeader: {
    fontSize: FONT.body,
    fontWeight: '500',
    color: COLORS.textLight,
    marginTop: 16,
    marginBottom: 8,
  },
  appointmentsList: {
    gap: 8,
  },
  appointmentItem: {
    marginBottom: 8,
  },
  noAppointments: {
    fontSize: FONT.body,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: 20,
  },
  loader: {
    paddingVertical: 20,
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