// src/screens/CalendarScreen.tsx
// Updated: 2025-06-19
// Description: Apple Calendar-inspired design with day, week, and month views - Fixed today date

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { useAppointments } from '../hooks/useAppointments';
import { contactService } from '../services/contactService';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import CompactAppointmentCard from '../components/CompactAppointmentCard';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Appointment, Contact } from '../../packages/types/dist';

type CalendarScreenProps = {
  navigation: any;
  route: any;
};

type ViewMode = 'day' | 'week' | 'month';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HOUR_HEIGHT = 60;
const TIME_COLUMN_WIDTH = 50;
const DAY_COLUMN_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH) / 7;

export default function CalendarScreen({ navigation, route }: CalendarScreenProps) {
  const { user } = useAuth();
  const { calendars, calendarMap, refetchCalendars } = useCalendar();

  // Get user's GHL ID for filtering
  const userGhlId = user?.ghlUserId || user?.userId;

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<string | null>(null);
  const [createModalTime, setCreateModalTime] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Animation values
  const scrollViewRef = useRef<ScrollView>(null);
  const swipeAnim = useRef(new Animated.Value(0)).current;

  // Get today's date string properly
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper functions - MUST BE DEFINED BEFORE USING THEM
  const getAppointmentStart = (appointment: any): string | null => {
    let possibleStart = appointment.start || appointment.startTime || appointment.time || appointment.appointmentStart;
    if (possibleStart && typeof possibleStart === 'object' && possibleStart.$date) {
      possibleStart = possibleStart.$date;
    }
    return possibleStart || null;
  };

  const getAppointmentEnd = (appointment: any): string | null => {
    let possibleEnd = appointment.end || appointment.endTime || appointment.appointmentEnd || null;
    if (possibleEnd && typeof possibleEnd === 'object' && possibleEnd.$date) {
      possibleEnd = possibleEnd.$date;
    }
    return possibleEnd;
  };

  const getLocalDateString = (utcDateString: string): string => {
    if (!utcDateString) return '';
    const date = new Date(utcDateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Create a local date to avoid timezone issues
  const createLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid DST issues
  };

  const getWeekDates = (date: string): string[] => {
    const d = createLocalDate(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const weekDay = new Date(d);
      weekDay.setDate(d.getDate() + i);
      const year = weekDay.getFullYear();
      const month = String(weekDay.getMonth() + 1).padStart(2, '0');
      const dayNum = String(weekDay.getDate()).padStart(2, '0');
      week.push(`${year}-${month}-${dayNum}`);
    }
    return week;
  };

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    let startDate, endDate;
    
    if (viewMode === 'month') {
      startDate = new Date(selectedDate);
      startDate.setDate(1);
      startDate.setDate(startDate.getDate() - 7);
      
      endDate = new Date(selectedDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setDate(endDate.getDate() + 7);
    } else {
      startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 7);
      
      endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 14);
    }
    
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };
  }, [selectedDate, viewMode]);

  // Use React Query for appointments
  const { 
    data: appointmentsData = [], 
    isLoading, 
    isRefetching,
    refetch: refetchAppointments 
  } = useAppointments(user?.locationId || '', {
    ...dateRange,
    limit: 100,
  });

  // Filter appointments (temporarily showing all)
  const appointments = useMemo(() => {
    // TODO: Re-enable user filtering once we figure out the correct user ID
    // return appointmentsData.filter(apt => apt.assignedUserId === userGhlId);
    const validAppointments = appointmentsData.filter(apt => {
      const startDate = getAppointmentStart(apt);
      return startDate && !isNaN(new Date(startDate).getTime());
    });
    
    if (__DEV__) {
      console.log('📅 [Calendar] Valid appointments:', validAppointments.length);
    }
    
    return validAppointments;
  }, [appointmentsData, userGhlId]);

  // Memoized contacts map for fast lookup
  const contactsMap: { [key: string]: Contact } = useMemo(() => 
    Object.fromEntries(contacts.map((c) => [c._id, c])),
    [contacts]
  );

  const navigateToToday = () => {
    const today = getTodayString();
    setSelectedDate(today);
  };

  const changeWeek = (direction: number) => {
    const current = createLocalDate(selectedDate);
    current.setDate(current.getDate() + (direction * 7));
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const changeDay = (direction: number) => {
    const current = createLocalDate(selectedDate);
    current.setDate(current.getDate() + direction);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch contacts
  const fetchContacts = async () => {
    if (!user?.locationId) return;
    
    try {
      const contactsData = await contactService.list(user.locationId, { limit: 100 });
      setContacts(contactsData);
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [Calendar] Failed to fetch contacts:', error);
      }
    }
  };

  // Pull to refresh - now includes React Query refetch
  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchAppointments(),
      fetchContacts(),
      refetchCalendars(),
    ]);
  }, [refetchAppointments]);

  // Initial load
  useEffect(() => {
    if (user?.locationId) {
      fetchContacts();
    }
  }, [user?.locationId]);

  // Memoized marked dates for calendar
  const markedDates = useMemo(() => {
    const marks: any = {};
    
    // Add appointment dots
    appointments.forEach(apt => {
      const startDate = getAppointmentStart(apt);
      if (startDate) {
        const dateKey = getLocalDateString(startDate);
        const calendarColor = calendarMap[apt.calendarId]?.color || COLORS.accent;
        
        if (!marks[dateKey]) {
          marks[dateKey] = { dots: [] };
        }
        
        if (!marks[dateKey].dots.find((d: any) => d.color === calendarColor)) {
          marks[dateKey].dots.push({ 
            key: apt._id,
            color: calendarColor 
          });
        }
      }
    });
    
    // Get today's date
    const today = getTodayString();
    
    // Mark today with blue background
    if (!marks[today]) {
      marks[today] = { dots: [] };
    }
    marks[today].customStyles = {
      container: {
        backgroundColor: COLORS.accent,
        borderRadius: 16,
      },
      text: {
        color: COLORS.white,
      }
    };
    
    // Mark selected date if it's not today
    if (selectedDate !== today) {
      if (!marks[selectedDate]) {
        marks[selectedDate] = { dots: [] };
      }
      marks[selectedDate].selected = true;
      marks[selectedDate].customStyles = {
        container: {
          borderWidth: 2,
          borderColor: COLORS.accent,
          borderRadius: 16,
          backgroundColor: 'transparent',
        },
        text: {
          color: COLORS.textDark,
        }
      };
    }
    
    return marks;
  }, [appointments, selectedDate, calendarMap]);

  // Get appointments for a specific date
  const getAppointmentsForDate = useCallback((date: string) => {
    return appointments.filter((apt) => {
      const startDate = getAppointmentStart(apt);
      if (!startDate) return false;
      return getLocalDateString(startDate) === date;
    }).sort((a, b) => {
      const aStart = getAppointmentStart(a);
      const bStart = getAppointmentStart(b);
      if (!aStart || !bStart) return 0;
      return new Date(aStart).getTime() - new Date(bStart).getTime();
    });
  }, [appointments]);

  // Handle time slot tap
  const handleTimeSlotTap = (date: string, hour: number) => {
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(hour, 0, 0, 0);
    
    setCreateModalDate(date);
    setCreateModalTime(selectedDateTime.toISOString());
    setShowCreateModal(true);
  };

  // Render appointment in week/day view
  const renderTimeSlotAppointment = (appointment: Appointment, dayIndex: number) => {
    const startTime = getAppointmentStart(appointment);
    const endTime = getAppointmentEnd(appointment);
    if (!startTime) return null;
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000);
    
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const duration = endHour - startHour;
    
    const calendar = calendarMap[appointment.calendarId];
    const contact = contactsMap[appointment.contactId];
    
    const top = startHour * HOUR_HEIGHT;
    const height = Math.max(duration * HOUR_HEIGHT - 2, 30);
    const left = viewMode === 'week' ? TIME_COLUMN_WIDTH + (dayIndex * DAY_COLUMN_WIDTH) + 2 : TIME_COLUMN_WIDTH + 2;
    const width = viewMode === 'week' ? DAY_COLUMN_WIDTH - 4 : SCREEN_WIDTH - TIME_COLUMN_WIDTH - 4;
    
    return (
      <TouchableOpacity
        key={appointment._id}
        style={[
          styles.timeSlotAppointment,
          {
            top,
            left,
            height,
            width,
            backgroundColor: calendar?.color || COLORS.accent,
          }
        ]}
        onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appointment._id })}
        activeOpacity={0.9}
      >
        <View style={styles.appointmentTimeContent}>
          <Text style={styles.appointmentTimeTitle} numberOfLines={1}>
            {appointment.title || 'Appointment'}
          </Text>
          {height > 40 && contact && (
            <Text style={styles.appointmentTimeContact} numberOfLines={1}>
              {contact.firstName} {contact.lastName}
            </Text>
          )}
          {height > 60 && (
            <Text style={styles.appointmentTimeTime} numberOfLines={1}>
              {formatTime(startTime)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const weekDates = getWeekDates(selectedDate);
    const todayString = getTodayString();
    
    if (__DEV__) {
      console.log('📅 [Calendar] Week dates:', weekDates);
      console.log('📅 [Calendar] Today string:', todayString);
    }
    
    const weekAppointments = weekDates.map(date => getAppointmentsForDate(date));
    const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
    
    return (
      <View style={styles.weekContainer}>
        {/* Header with day names - now outside ScrollView to stay fixed */}
        <View style={styles.weekHeader}>
          <View style={{ width: TIME_COLUMN_WIDTH }} />
          {weekDates.map((date, index) => {
            const d = createLocalDate(date);
            const isToday = date === todayString;
            const isSelected = date === selectedDate;
            
            return (
              <View
                key={date}
                style={styles.weekHeaderDay}
              >
                <Text style={[
                  styles.weekHeaderDayName,
                  isToday && styles.weekHeaderToday
                ]}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[
                  styles.weekHeaderDayNumber,
                  isToday && styles.weekHeaderTodayNumber,
                  isSelected && !isToday && styles.weekHeaderSelectedNumber
                ]}>
                  {d.getDate()}
                </Text>
              </View>
            );
          })}
        </View>
        
        <ScrollView
          ref={scrollViewRef}
          style={styles.weekScrollView}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => {
            // Scroll to current time on layout
            const now = new Date();
            const currentHour = now.getHours() + now.getMinutes() / 60;
            const scrollPosition = (currentHour * HOUR_HEIGHT) - (e.nativeEvent.layout.height / 2);
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({ y: Math.max(0, scrollPosition), animated: true });
            }, 150);
          }}
        >
          {/* Time grid */}
          <View style={styles.timeGrid}>
            {/* Hour rows */}
            {Array.from({ length: 24 }, (_, hour) => (
              <View key={hour} style={styles.hourRow}>
                <View style={styles.timeLabel}>
                  <Text style={styles.timeLabelText}>{formatHour(hour)}</Text>
                </View>
                <View style={styles.hourCells}>
                  {weekDates.map((date, dayIndex) => (
                    <TouchableOpacity
                      key={`${date}-${hour}`}
                      style={styles.hourCell}
                      onPress={() => handleTimeSlotTap(date, hour)}
                    >
                      <View style={styles.gridLine} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            
            {/* Appointments */}
            <View style={styles.appointmentsOverlay}>
              {weekAppointments.map((dayAppointments, dayIndex) =>
                dayAppointments.map(apt => renderTimeSlotAppointment(apt, dayIndex))
              )}
            </View>
            
            {/* Current time line - only show if we're looking at current week */}
            {weekDates.includes(todayString) && currentHour >= 0 && currentHour <= 24 && (
              <View style={[styles.currentTimeLine, { top: currentHour * HOUR_HEIGHT }]}>
                <View style={styles.currentTimeCircle} />
                <View style={styles.currentTimeLineBar} />
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render day view
  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(selectedDate);
    const todayString = getTodayString();
    const isToday = selectedDate === todayString;
    const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
    
    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.dayContainer}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => {
          // Scroll to current time on layout
          if (isToday) {
            const now = new Date();
            const currentHour = now.getHours() + now.getMinutes() / 60;
            const scrollPosition = (currentHour * HOUR_HEIGHT) - (e.nativeEvent.layout.height / 2);
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({ y: Math.max(0, scrollPosition), animated: true });
            }, 150);
          }
        }}
      >
        {/* Time grid */}
        <View style={styles.timeGrid}>
          {/* Hour rows */}
          {Array.from({ length: 24 }, (_, hour) => (
            <TouchableOpacity
              key={hour}
              style={styles.hourRow}
              onPress={() => handleTimeSlotTap(selectedDate, hour)}
            >
              <View style={styles.timeLabel}>
                <Text style={styles.timeLabelText}>{formatHour(hour)}</Text>
              </View>
              <View style={styles.dayHourCell}>
                <View style={styles.gridLine} />
              </View>
            </TouchableOpacity>
          ))}
          
          {/* Appointments */}
          <View style={styles.appointmentsOverlay}>
            {dayAppointments.map(apt => renderTimeSlotAppointment(apt, 0))}
          </View>
          
          {/* Current time line */}
          {isToday && currentHour >= 0 && currentHour <= 24 && (
            <View style={[styles.currentTimeLine, { top: currentHour * HOUR_HEIGHT }]}>
              <View style={styles.currentTimeCircle} />
              <View style={styles.currentTimeLineBar} />
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // Render month view appointments
  const renderMonthAppointments = () => {
    const selectedDateAppointments = getAppointmentsForDate(selectedDate);
    const displayDate = createLocalDate(selectedDate);
    
    return (
      <View style={styles.appointmentsList}>
        <Text style={styles.dateHeader}>
          {displayDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
        {selectedDateAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No events</Text>
          </View>
        ) : (
          selectedDateAppointments.map((appointment) => {
            const startTime = getAppointmentStart(appointment);
            const endTime = getAppointmentEnd(appointment);
            const contact = contactsMap[appointment.contactId];
            const calendar = calendarMap[appointment.calendarId];
            
            return (
              <TouchableOpacity 
                key={appointment._id}
                style={styles.appointmentItem}
                onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appointment._id })}
              >
                <View style={[styles.appointmentBar, { backgroundColor: calendar?.color || COLORS.accent }]} />
                <View style={styles.appointmentContent}>
                  <View style={styles.appointmentTime}>
                    <Text style={styles.timeText}>{startTime ? formatTime(startTime) : ''}</Text>
                    {endTime && (
                      <Text style={styles.timeSeparator}>-</Text>
                    )}
                    {endTime && (
                      <Text style={styles.timeText}>{formatTime(endTime)}</Text>
                    )}
                  </View>
                  <View style={styles.appointmentDetails}>
                    <Text style={styles.appointmentTitle} numberOfLines={1}>
                      {appointment.title || 'Appointment'}
                    </Text>
                    {contact && (
                      <Text style={styles.contactName} numberOfLines={1}>
                        {contact.firstName} {contact.lastName}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // Loading skeleton
  if (isLoading && appointments.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Calendar</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={navigateToToday}>
            <Text style={styles.todayButton}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={28} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewToggleContainer}>
        {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.viewToggleButton,
              viewMode === mode && styles.viewToggleButtonActive
            ]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[
              styles.viewToggleText,
              viewMode === mode && styles.viewToggleTextActive
            ]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Content */}
      {viewMode === 'month' ? (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
          }
        >
          {/* Calendar */}
          <View style={styles.calendarContainer}>
            <Calendar
              current={selectedDate}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              theme={{
                backgroundColor: COLORS.background,
                calendarBackground: COLORS.white,
                textSectionTitleColor: COLORS.textLight,
                selectedDayBackgroundColor: COLORS.white,
                selectedDayTextColor: COLORS.textDark,
                todayTextColor: COLORS.white,
                todayBackgroundColor: COLORS.accent,
                dayTextColor: COLORS.textDark,
                textDisabledColor: COLORS.border,
                dotColor: COLORS.accent,
                selectedDotColor: COLORS.accent,
                arrowColor: COLORS.accent,
                monthTextColor: COLORS.textDark,
                textDayFontFamily: FONT.regular,
                textMonthFontFamily: FONT.semiBold,
                textDayHeaderFontFamily: FONT.medium,
                textDayFontSize: 14,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 12,
                'stylesheet.day.basic': {
                  base: {
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  today: {
                    backgroundColor: COLORS.accent,
                    borderRadius: 16,
                    width: 32,
                    height: 32,
                  },
                  todayText: {
                    color: COLORS.white,
                    fontWeight: '600',
                  },
                  selected: {
                    borderWidth: 2,
                    borderColor: COLORS.accent,
                    borderRadius: 16,
                    width: 32,
                    height: 32,
                  },
                  selectedText: {
                    color: COLORS.textDark,
                    fontWeight: '600',
                  },
                },
              }}
              firstDay={0}
              markingType={'multi-dot'}
              style={styles.calendar}
            />
          </View>

          {/* Appointments List */}
          {renderMonthAppointments()}
        </ScrollView>
      ) : viewMode === 'week' ? (
        <View style={styles.weekViewContainer}>
          {/* Navigation arrows */}
          <View style={styles.weekNavigation}>
            <TouchableOpacity onPress={() => changeWeek(-1)} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.weekTitle}>
              {createLocalDate(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeWeek(1)} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>
          {renderWeekView()}
        </View>
      ) : (
        <View style={styles.dayViewContainer}>
          {/* Navigation with date in center */}
          <View style={styles.dayNavigation}>
            <TouchableOpacity onPress={() => changeDay(-1)} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.dayNavigationTitle}>
              {createLocalDate(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <TouchableOpacity onPress={() => changeDay(1)} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>
          {renderDayView()}
        </View>
      )}

      {/* Create Modal */}
      <CreateAppointmentModal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateModalDate(null);
          setCreateModalTime(null);
        }}
        onSubmit={async (data) => {
          if (!user?._id || !user?.locationId || !userGhlId) {
            Alert.alert('Error', 'Session expired. Please log in again.');
            return;
          }
          
          try {
            const appointmentData = {
              ...data,
              userId: user._id,
              assignedUserId: userGhlId,
              locationId: user.locationId,
            };
            
            // If we have a pre-selected time, use it
            if (createModalTime) {
              appointmentData.start = createModalTime;
              const endTime = new Date(createModalTime);
              endTime.setHours(endTime.getHours() + 1);
              appointmentData.end = endTime.toISOString();
            }
            
            const result = await appointmentService.create(appointmentData);
            
            setShowCreateModal(false);
            setCreateModalDate(null);
            setCreateModalTime(null);
            // React Query will automatically refetch after create
          } catch (err: any) {
            let errorMessage = 'Failed to create appointment';
            if (err.response?.data?.error) {
              errorMessage = err.response.data.error;
            }
            Alert.alert('Error', errorMessage);
          }
        }}
        contacts={contacts}
        selectedDate={createModalDate || selectedDate}
        selectedTime={createModalTime}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontFamily: FONT.bold,
    color: COLORS.textDark,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  todayButton: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  viewToggleText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
  },
  viewToggleTextActive: {
    fontFamily: FONT.semiBold,
    color: COLORS.accent,
  },
  
  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  
  // Month view styles
  calendarContainer: {
    backgroundColor: COLORS.white,
    ...SHADOW.light,
  },
  calendar: {
    // Calendar styles
  },
  appointmentsList: {
    backgroundColor: COLORS.white,
    marginTop: 10,
    paddingVertical: 16,
  },
  dateHeader: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  appointmentItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  appointmentBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  appointmentContent: {
    flex: 1,
    flexDirection: 'row',
  },
  appointmentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    minWidth: 100,
  },
  timeText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  timeSeparator: {
    fontSize: 12,
    color: COLORS.textGray,
    marginHorizontal: 4,
  },
  appointmentDetails: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  contactName: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
  },
  
  // Week view styles
  weekViewContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  weekTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  navButton: {
    padding: 8,
  },
  weekContainer: {
    flex: 1,
  },
  weekScrollView: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
    // Keep header at top
    position: 'relative',
    zIndex: 10,
  },
  weekHeaderDay: {
    width: DAY_COLUMN_WIDTH,
    alignItems: 'center',
  },
  weekHeaderDayName: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  weekHeaderDayNumber: {
    fontSize: 18,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  weekHeaderToday: {
    color: COLORS.accent,
  },
  weekHeaderTodayNumber: {
    color: COLORS.white,
    backgroundColor: COLORS.accent,
    borderRadius: 15,
    width: 30,
    height: 30,
    textAlign: 'center',
    lineHeight: 30,
    overflow: 'hidden',
  },
  weekHeaderSelectedNumber: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 15,
    width: 30,
    height: 30,
    textAlign: 'center',
    lineHeight: 26,
  },
  
  // Day view styles
  dayViewContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  dayNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayNavigationTitle: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  dayContainer: {
    flex: 1,
  },
  dayHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayHeaderDate: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  
  // Time grid styles
  timeGrid: {
    position: 'relative',
  },
  hourRow: {
    flexDirection: 'row',
    height: HOUR_HEIGHT,
  },
  timeLabel: {
    width: TIME_COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: -8,
  },
  timeLabelText: {
    fontSize: 11,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
  },
  hourCells: {
    flex: 1,
    flexDirection: 'row',
  },
  hourCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  dayHourCell: {
    flex: 1,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.border,
  },
  appointmentsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  timeSlotAppointment: {
    position: 'absolute',
    borderRadius: 4,
    padding: 4,
    overflow: 'hidden',
  },
  appointmentTimeContent: {
    flex: 1,
  },
  appointmentTimeTitle: {
    fontSize: 12,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
  },
  appointmentTimeContact: {
    fontSize: 11,
    fontFamily: FONT.regular,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 2,
  },
  appointmentTimeTime: {
    fontSize: 10,
    fontFamily: FONT.regular,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: 2,
  },
  
  // Current time line
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.error,
    marginLeft: TIME_COLUMN_WIDTH - 6,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.error,
  },
});