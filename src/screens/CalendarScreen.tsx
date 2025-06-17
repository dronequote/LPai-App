// src/screens/CalendarScreen.tsx
// Updated: 2025-01-06
// Description: Calendar screen with upcoming appointments list - using services only

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
import CreateAppointmentModal from '../components/CreateAppointmentModal';
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

  // Helper function to get appointment start time
  const getAppointmentStart = (appointment: any): string | null => {
    let possibleStart = appointment.start || appointment.startTime || appointment.time || appointment.appointmentStart;
    
    // Handle MongoDB Date object format
    if (possibleStart && typeof possibleStart === 'object' && possibleStart.$date) {
      possibleStart = possibleStart.$date;
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

  // Fetch all appointments using appointmentService
  const fetchAppointments = async () => {
    if (!user?.locationId || !userGhlId) {
      if (__DEV__) {
        console.log('📅 [Calendar] Missing locationId or userGhlId');
      }
      return;
    }
    
    try {
      // Get appointments for a wider date range
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1); // 1 month ago
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2); // 2 months ahead
      
      const appointmentsData = await appointmentService.list(user.locationId, {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        limit: 100,
      });
      
      if (__DEV__) {
        console.log('📅 [Calendar] Fetched appointments:', appointmentsData.length);
      }
      
      // Filter appointments by assignedUserId matching our user's GHL ID
      const userAppointments = appointmentsData.filter(apt => 
        apt.assignedUserId === userGhlId
      );
      
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
      
      setMarkedDates(marks);
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [Calendar] Failed to fetch appointments:', error);
      }
      // Don't show error alert for appointments - it's too disruptive
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch contacts using contactService
  const fetchContacts = async () => {
    if (!user?.locationId) {
      if (__DEV__) {
        console.log('📅 [Calendar] Cannot fetch contacts - no locationId');
      }
      return;
    }
    
    try {
      const contactsData = await contactService.list(user.locationId, { limit: 100 });
      setContacts(contactsData);
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [Calendar] Failed to fetch contacts:', error);
      }
      // Don't show error - contacts are not critical for calendar
    }
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAppointments(),
      fetchContacts(),
      refetchCalendars(),
    ]);
  }, [user?.locationId, userGhlId]);

  // Initial load
  useEffect(() => {
    if (user?.locationId) {
      setLoading(true);
      Promise.all([
        fetchAppointments(),
        fetchContacts(),
      ]).finally(() => setLoading(false));
    }
  }, [user?.locationId, userGhlId]);

  // Get appointments for selected date
  const getAppointmentsForDate = useCallback((date: string) => {
    return appointments.filter((apt) => {
      const startDate = getAppointmentStart(apt);
      if (!startDate) return false;
      return getLocalDateString(startDate) === date;
    });
  }, [appointments]);

  // Get upcoming appointments (next 5)
  const getUpcomingAppointments = useCallback((): AppointmentSection[] => {
    const now = new Date();
    const upcoming = appointments
      .filter(apt => {
        const startTime = getAppointmentStart(apt);
        if (!startTime) return false;
        const startDate = new Date(startTime);
        return startDate > now;
      })
      .sort((a, b) => {
        const aStart = getAppointmentStart(a);
        const bStart = getAppointmentStart(b);
        if (!aStart || !bStart) return 0;
        return new Date(aStart).getTime() - new Date(bStart).getTime();
      })
      .slice(0, 5);

    // Group by date
    const sections: AppointmentSection[] = [];
    const dateGroups: { [key: string]: Appointment[] } = {};

    upcoming.forEach(apt => {
      const startTime = getAppointmentStart(apt);
      if (!startTime) return;
      
      const date = new Date(startTime);
      const dateKey = date.toDateString();
      
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(apt);
    });

    // Convert to sections array
    Object.keys(dateGroups).forEach(dateKey => {
      const date = new Date(dateKey);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      let title = dateKey;
      if (date.toDateString() === today.toDateString()) {
        title = 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        title = 'Tomorrow';
      } else {
        title = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      }
      
      sections.push({
        title,
        data: dateGroups[dateKey],
      });
    });

    return sections;
  }, [appointments]);

  // Handle opening create modal
  const handleOpenCreateModal = () => {
    if (!user?.locationId) {
      Alert.alert('Error', 'Location information is missing. Please log in again.');
      return;
    }
    setShowCreateModal(true);
  };

  const renderAppointmentItem = ({ item }: { item: Appointment }) => {
    return (
      <CompactAppointmentCard
        appointment={item}
        contact={contactsMap[item.contactId]}
        calendar={calendarMap[item.calendarId]}
        onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item._id })}
        navigation={navigation}
      />
    );
  };

  const upcomingSections = getUpcomingAppointments();

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={() => (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Calendar</Text>
            </View>

            {/* Calendar Component */}
            <View style={styles.calendarContainer}>
              <Calendar
                current={selectedDate}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={markedDates}
                theme={{
                  backgroundColor: COLORS.background,
                  calendarBackground: COLORS.white,
                  textSectionTitleColor: COLORS.textLight,
                  selectedDayBackgroundColor: COLORS.accent,
                  selectedDayTextColor: COLORS.white,
                  todayTextColor: COLORS.accent,
                  dayTextColor: COLORS.textDark,
                  textDisabledColor: COLORS.border,
                  dotColor: COLORS.accent,
                  selectedDotColor: COLORS.white,
                  arrowColor: COLORS.accent,
                  monthTextColor: COLORS.textDark,
                  textDayFontFamily: FONT.regular,
                  textMonthFontFamily: FONT.semiBold,
                  textDayHeaderFontFamily: FONT.medium,
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                }}
                markingType={'multi-dot'}
              />
            </View>

            {/* Selected Date Appointments */}
            <View style={styles.selectedDateSection}>
              <Text style={styles.sectionTitle}>
                {new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.accent} style={styles.loader} />
              ) : (
                <FlatList
                  data={getAppointmentsForDate(selectedDate)}
                  renderItem={renderAppointmentItem}
                  keyExtractor={(item) => item._id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  ListEmptyComponent={
                    <Text style={styles.noAppointments}>No appointments scheduled</Text>
                  }
                />
              )}
            </View>

            {/* Upcoming Appointments */}
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

      {/* Create Modal - Pass contacts array */}
      <CreateAppointmentModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          if (!user?._id || !user?.locationId || !userGhlId) {
            Alert.alert('Error', 'Session expired. Please log in again.');
            return;
          }
          
          try {
            await appointmentService.create({
              ...data,
              userId: user._id,
              assignedUserId: userGhlId,
              locationId: user.locationId,
            });
            setShowCreateModal(false);
            await fetchAppointments(); // Refresh appointments
          } catch (err: any) {
            let errorMessage = 'Failed to create appointment';
            if (err.response?.data?.error) {
              errorMessage = err.response.data.error;
            }
            Alert.alert('Error', errorMessage);
          }
        }}
        contacts={contacts} // Pass the contacts array
        selectedDate={selectedDate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 24,
    fontFamily: FONT.bold,
    color: COLORS.textDark,
  },
  calendarContainer: {
    backgroundColor: COLORS.white,
    marginBottom: 10,
    ...SHADOW.medium,
  },
  selectedDateSection: {
    backgroundColor: COLORS.white,
    paddingVertical: 15,
    marginBottom: 10,
    ...SHADOW.light,
  },
  upcomingSection: {
    backgroundColor: COLORS.white,
    padding: 20,
    ...SHADOW.light,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  horizontalList: {
    paddingHorizontal: 20,
  },
  appointmentsList: {
    paddingHorizontal: 20,
  },
  appointmentItem: {
    marginBottom: 10,
  },
  dateHeader: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textLight,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  noAppointments: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: 20,
  },
  loader: {
    paddingVertical: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.large,
  },
});