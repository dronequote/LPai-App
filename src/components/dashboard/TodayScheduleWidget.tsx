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
import api from '../../lib/api';

interface TimeSlot {
  time: string;
  appointment?: {
    id: string;
    title: string;
    clientName: string;
    duration: number;
    color: string;
  };
  isCurrentTime?: boolean;
}

export default function TodayScheduleWidget() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    generateTimeSlots();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const generateTimeSlots = async () => {
    try {
      // Get today's appointments
      const res = await api.get('/api/appointments', {
        params: { 
          locationId: user?.locationId,
          start: new Date().setHours(0, 0, 0, 0),
          end: new Date().setHours(23, 59, 59, 999)
        }
      });

      const appointments = res.data || [];
      
      // Generate time slots from 8 AM to 6 PM
      const slots: TimeSlot[] = [];
      const currentHour = new Date().getHours();
      
      for (let hour = 8; hour <= 18; hour++) {
        const timeString = hour <= 12 
          ? `${hour === 12 ? 12 : hour} ${hour < 12 ? 'AM' : 'PM'}`
          : `${hour - 12} PM`;
        
        // Find appointment for this time slot
        const appointment = appointments.find((apt: any) => {
          const aptHour = new Date(apt.start || apt.time).getHours();
          return aptHour === hour;
        });

        slots.push({
          time: timeString,
          appointment: appointment ? {
            id: appointment._id,
            title: appointment.title,
            clientName: appointment.contactName || 'Unknown',
            duration: appointment.duration || 60,
            color: getAppointmentColor(appointment.calendarId),
          } : undefined,
          isCurrentTime: hour === currentHour,
        });
      }

      setTimeSlots(slots);
      
      // Auto-scroll to current time
      const currentIndex = slots.findIndex(slot => slot.isCurrentTime);
      if (currentIndex > -1 && scrollViewRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: currentIndex * 60, animated: true });
        }, 500);
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAppointmentColor = (calendarId?: string) => {
    // Different colors for different calendar types
    const colors = ['#00B3E6', '#27AE60', '#9B59B6', '#F39C12', '#E74C3C'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="time" size={24} color={COLORS.accent} />
            <Text style={styles.title}>Today's Schedule</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="time" size={24} color={COLORS.accent} />
          <Text style={styles.title}>Today's Schedule</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Calendar' as never)}>
          <Text style={styles.viewAll}>Full Calendar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.scheduleContainer}
      >
        {timeSlots.map((slot, index) => (
          <View key={index} style={styles.timeSlot}>
            <View style={styles.timeContainer}>
              <Text style={[
                styles.timeText,
                slot.isCurrentTime && styles.currentTimeText
              ]}>
                {slot.time}
              </Text>
              {slot.isCurrentTime && (
                <Animated.View style={[
                  styles.currentTimeDot,
                  { transform: [{ scale: pulseAnim }] }
                ]} />
              )}
            </View>

            <View style={styles.slotContent}>
              {slot.appointment ? (
                <TouchableOpacity
                  style={[
                    styles.appointmentCard,
                    { borderLeftColor: slot.appointment.color }
                  ]}
                  onPress={() => navigation.navigate('AppointmentDetail' as never, {
                    appointmentId: slot.appointment!.id
                  } as never)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.appointmentTitle} numberOfLines={1}>
                    {slot.appointment.title}
                  </Text>
                  <View style={styles.appointmentDetails}>
                    <Ionicons name="person-outline" size={12} color={COLORS.textGray} />
                    <Text style={styles.clientName}>{slot.appointment.clientName}</Text>
                    <Text style={styles.duration}>• {slot.appointment.duration} min</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.emptySlot, slot.isCurrentTime && styles.currentEmptySlot]}>
                  <Text style={styles.emptySlotText}>Available</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    maxHeight: 400,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginLeft: 8,
  },
  viewAll: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
  },
  scheduleContainer: {
    flex: 1,
  },
  timeSlot: {
    flexDirection: 'row',
    marginBottom: 16,
    minHeight: 44,
  },
  timeContainer: {
    width: 70,
    alignItems: 'flex-end',
    paddingRight: 12,
    position: 'relative',
  },
  timeText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    fontWeight: '500',
  },
  currentTimeText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  currentTimeDot: {
    position: 'absolute',
    right: 0,
    top: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  slotContent: {
    flex: 1,
  },
  appointmentCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.small,
    padding: 12,
    borderLeftWidth: 4,
  },
  appointmentTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  appointmentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientName: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 4,
    flex: 1,
  },
  duration: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  emptySlot: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.small,
    padding: 12,
    alignItems: 'center',
  },
  currentEmptySlot: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentMuted + '10',
  },
  emptySlotText: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
  },
});