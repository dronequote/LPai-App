// src/components/dashboard/TodayScheduleWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { appointmentService } from '../../services/appointmentService';

interface TimeSlot {
  time: string;
  appointment?: any;
  isNow?: boolean;
  isPast?: boolean;
}

export default function TodayScheduleWidget() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchTodaySchedule();
    // Refresh every 5 minutes
    const interval = setInterval(fetchTodaySchedule, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.locationId]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [loading]);

  const fetchTodaySchedule = async () => {
    try {
      // Use appointmentService instead of api.get
      const todayAppointments = await appointmentService.getTodaysAppointments(
        user?.locationId,
        user?.id
      );
      
      const activeAppointments = todayAppointments
        .filter(apt => apt.status !== 'Cancelled')
        .sort((a, b) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime());
      
      setAppointments(activeAppointments);
      generateTimeSlots(activeAppointments);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load schedule:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = (appointments: any[]) => {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    
    // Generate slots from 8 AM to 6 PM
    for (let hour = 8; hour <= 18; hour++) {
      const timeString = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
      const slotTime = new Date();
      slotTime.setHours(hour, 0, 0, 0);
      
      // Find appointment for this time slot
      const appointment = appointments.find(apt => {
        const aptHour = new Date(apt.start || apt.time).getHours();
        return aptHour === hour;
      });
      
      slots.push({
        time: timeString,
        appointment,
        isNow: hour === currentHour,
        isPast: hour < currentHour,
      });
    }
    
    setTimeSlots(slots);
    
    // Auto-scroll to current time
    setTimeout(() => {
      const currentIndex = slots.findIndex(slot => slot.isNow);
      if (currentIndex > 0 && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: currentIndex * 60,
          animated: true,
        });
      }
    }, 300);
  };

  const handleAppointmentPress = (appointment: any) => {
    navigation.navigate('AppointmentDetail', { appointmentId: appointment._id });
  };

  const handleViewCalendar = () => {
    navigation.navigate('Calendar');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return COLORS.success;
      case 'In Progress': return COLORS.primary;
      case 'No Show': return COLORS.error;
      default: return COLORS.accent;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return 'checkmark-circle';
      case 'In Progress': return 'time';
      case 'No Show': return 'close-circle';
      default: return 'calendar';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="time" size={20} color={COLORS.primary} />
          <Text style={styles.title}>Today's Schedule</Text>
        </View>
        <TouchableOpacity onPress={handleViewCalendar}>
          <Text style={styles.viewAllText}>Full Calendar</Text>
        </TouchableOpacity>
      </View>

      {appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.textGray} />
          <Text style={styles.emptyTitle}>No appointments today</Text>
          <Text style={styles.emptySubtitle}>Enjoy your free time!</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.scheduleContainer}
          contentContainerStyle={styles.scheduleContent}
        >
          {timeSlots.map((slot, index) => (
            <View 
              key={index} 
              style={[
                styles.timeSlot,
                slot.isNow && styles.currentTimeSlot,
                slot.isPast && styles.pastTimeSlot,
              ]}
            >
              <View style={styles.timeColumn}>
                <Text 
                  style={[
                    styles.timeText,
                    slot.isNow && styles.currentTimeText,
                    slot.isPast && styles.pastTimeText,
                  ]}
                >
                  {slot.time}
                </Text>
                {slot.isNow && (
                  <View style={styles.nowIndicator}>
                    <Text style={styles.nowText}>NOW</Text>
                  </View>
                )}
              </View>

              <View style={styles.appointmentColumn}>
                {slot.appointment ? (
                  <TouchableOpacity
                    style={[
                      styles.appointmentCard,
                      { borderLeftColor: getStatusColor(slot.appointment.status) }
                    ]}
                    onPress={() => handleAppointmentPress(slot.appointment)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.appointmentHeader}>
                      <Text style={styles.appointmentTitle} numberOfLines={1}>
                        {slot.appointment.title}
                      </Text>
                      <Ionicons
                        name={getStatusIcon(slot.appointment.status)}
                        size={16}
                        color={getStatusColor(slot.appointment.status)}
                      />
                    </View>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {slot.appointment.contactName || 'Unknown Customer'}
                    </Text>
                    {slot.appointment.address && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={12} color={COLORS.textGray} />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {slot.appointment.address}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.emptySlot}>
                    {!slot.isPast && (
                      <TouchableOpacity 
                        style={styles.addButton}
                        onPress={() => navigation.navigate('CreateAppointment', { 
                          defaultTime: slot.time 
                        })}
                      >
                        <Ionicons name="add" size={16} color={COLORS.primary} />
                        <Text style={styles.addText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 16,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  scheduleContainer: {
    maxHeight: 300,
  },
  scheduleContent: {
    paddingBottom: 8,
  },
  timeSlot: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
  },
  currentTimeSlot: {
    backgroundColor: `${COLORS.primary}10`,
  },
  pastTimeSlot: {
    opacity: 0.6,
  },
  timeColumn: {
    width: 80,
    paddingRight: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textGray,
  },
  currentTimeText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  pastTimeText: {
    color: COLORS.textGray,
  },
  nowIndicator: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  nowText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  appointmentColumn: {
    flex: 1,
    paddingVertical: 8,
  },
  appointmentCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.small,
    padding: 10,
    borderLeftWidth: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
    marginRight: 8,
  },
  customerName: {
    fontSize: 12,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: COLORS.textGray,
    flex: 1,
  },
  emptySlot: {
    height: 44,
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  addText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
});