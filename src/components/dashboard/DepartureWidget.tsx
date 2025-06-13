// src/components/dashboard/DepartureWidget.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import { appointmentService } from '../../services/appointmentService';

// Conditional import for Location
let Location: any = null;
try {
  Location = require('expo-location');
} catch (error) {
  if (__DEV__) {
    console.log('expo-location not available');
  }
}

interface DepartureWidgetProps {
  onNavigate?: () => void;
  onRunningLate?: () => void;
}

export default function DepartureWidget({ onNavigate, onRunningLate }: DepartureWidgetProps) {
  const { user } = useAuth();
  const [nextAppointment, setNextAppointment] = useState<any>(null);
  const [timeToLeave, setTimeToLeave] = useState<number>(0);
  const [isLate, setIsLate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [realTimeETA, setRealTimeETA] = useState<number | null>(null);
  const [trafficCondition, setTrafficCondition] = useState<'normal' | 'moderate' | 'heavy' | null>(null);
  const [locationAvailable, setLocationAvailable] = useState(false);
  
  // Animation values
  const pulseAnim = new Animated.Value(1);

  // User preferences
  const userPrefs = {
    preferredGPS: user?.preferences?.navigation?.preferredGPS || 'google',
    arrivalBuffer: user?.preferences?.navigation?.arrivalBuffer || 5,
    smsMethod: user?.preferences?.communication?.smsMethod || 'ghl',
    autoNotifyOnDepart: user?.preferences?.communication?.autoNotifyOnDepart || false,
  };

  // Try to get location if available
  useEffect(() => {
    if (!Location) {
      setLocationAvailable(false);
      return;
    }

    let locationSubscription: any = null;
    
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationAvailable(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        setCurrentLocation(location);
        setLocationAvailable(true);

        // Subscribe to location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000, // Update every minute
            distanceInterval: 100, // Or every 100 meters
          },
          (location) => {
            setCurrentLocation(location);
          }
        );
      } catch (error) {
        if (__DEV__) {
          console.log('Location error:', error);
        }
        setLocationAvailable(false);
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch appointment and calculate departure time
  useEffect(() => {
    fetchNextAppointment();
    const interval = setInterval(fetchNextAppointment, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [user?.locationId]);

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (nextAppointment) {
        calculateTimeToLeave();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [nextAppointment, currentLocation]);

  // Pulse animation for when running late
  useEffect(() => {
    if (isLate) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [isLate]);

  const fetchNextAppointment = async () => {
    try {
      // Use appointmentService instead of api.get
      const appointments = await appointmentService.getTodaysAppointments(
        user?.locationId,
        user?.id
      );
      
      const now = new Date();
      const upcoming = appointments
        .filter(apt => {
          const aptTime = new Date(apt.start || apt.time);
          return aptTime > now && apt.status !== 'Cancelled';
        })
        .sort((a, b) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime());
      
      if (upcoming.length > 0) {
        setNextAppointment(upcoming[0]);
      } else {
        setNextAppointment(null);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to fetch appointments:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeToLeave = () => {
    if (!nextAppointment) return;

    const now = new Date();
    const appointmentTime = new Date(nextAppointment.start || nextAppointment.time);
    const driveTime = nextAppointment.estimatedDriveTime || 15; // Default 15 min
    const bufferTime = userPrefs.arrivalBuffer;
    
    // Calculate when to leave (appointment time - drive time - buffer)
    const departureTime = new Date(appointmentTime.getTime() - (driveTime + bufferTime) * 60000);
    const minutesUntilDeparture = Math.floor((departureTime.getTime() - now.getTime()) / 60000);
    
    setTimeToLeave(minutesUntilDeparture);
    setIsLate(minutesUntilDeparture < 0);

    // Update traffic condition based on real-time data if available
    if (realTimeETA && driveTime) {
      const trafficRatio = realTimeETA / driveTime;
      if (trafficRatio > 1.3) {
        setTrafficCondition('heavy');
      } else if (trafficRatio > 1.1) {
        setTrafficCondition('moderate');
      } else {
        setTrafficCondition('normal');
      }
    }
  };

  const formatTimeRemaining = (minutes: number): string => {
    if (minutes < 0) {
      const late = Math.abs(minutes);
      if (late < 60) return `${late}m late`;
      return `${Math.floor(late / 60)}h ${late % 60}m late`;
    }
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const handleNavigate = () => {
    if (!nextAppointment?.address) return;

    const address = nextAppointment.address;
    const encodedAddress = encodeURIComponent(address);
    
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
      apple: `maps://app?daddr=${encodedAddress}`,
      waze: `https://waze.com/ul?q=${encodedAddress}&navigate=yes`,
    };

    const url = urls[userPrefs.preferredGPS as keyof typeof urls] || urls.google;
    
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
        onNavigate?.();
      } else {
        // Fallback to Google Maps web
        Linking.openURL(urls.google);
      }
    });
  };

  const handleRunningLate = () => {
    Alert.alert(
      'Running Late?',
      'Would you like to notify the customer?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Notification', 
          onPress: () => {
            // TODO: Implement SMS notification
            onRunningLate?.();
            Alert.alert('Notification Sent', 'Customer has been notified');
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </View>
    );
  }

  if (!nextAppointment) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          <Text style={styles.emptyText}>No more appointments today!</Text>
        </View>
      </View>
    );
  }

  const timerColor = isLate ? COLORS.error : timeToLeave <= 10 ? COLORS.warning : COLORS.success;

  return (
    <Animated.View 
      style={[
        styles.container, 
        isLate && { transform: [{ scale: pulseAnim }] }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.timerSection}>
          <Ionicons 
            name={isLate ? "alert-circle" : "time"} 
            size={24} 
            color={timerColor} 
          />
          <View style={styles.timerTextContainer}>
            <Text style={[styles.leaveLabel, { color: timerColor }]}>
              {isLate ? 'Running Late' : 'Leave In'}
            </Text>
            <Text style={[styles.timerText, { color: timerColor }]}>
              {formatTimeRemaining(timeToLeave)}
            </Text>
          </View>
        </View>
        
        <View style={styles.appointmentTimeContainer}>
          <Text style={styles.appointmentTimeLabel}>Appointment</Text>
          <Text style={styles.appointmentTime}>
            {new Date(nextAppointment.start || nextAppointment.time).toLocaleTimeString([], { 
              hour: 'numeric', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.customerName} numberOfLines={1}>
          {nextAppointment.contactName || 'Unknown Customer'}
        </Text>
        <Text style={styles.appointmentType} numberOfLines={1}>
          {nextAppointment.title || 'Appointment'}
        </Text>
        
        {nextAppointment.address && (
          <View style={styles.detailsRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textGray} />
            <Text style={styles.addressText} numberOfLines={2}>
              {nextAppointment.address}
            </Text>
          </View>
        )}
        
        <View style={styles.detailsRow}>
          <Ionicons name="car-outline" size={14} color={COLORS.textGray} />
          <Text style={styles.driveTime}>
            {nextAppointment.estimatedDriveTime || 15} min drive
          </Text>
          {trafficCondition && trafficCondition !== 'normal' && (
            <>
              <View 
                style={[
                  styles.trafficDot, 
                  { backgroundColor: trafficCondition === 'heavy' ? COLORS.error : COLORS.warning }
                ]} 
              />
              <Text 
                style={[
                  styles.trafficText, 
                  { color: trafficCondition === 'heavy' ? COLORS.error : COLORS.warning }
                ]}
              >
                {trafficCondition} traffic
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
          onPress={handleNavigate}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Navigate</Text>
        </TouchableOpacity>
        
        {isLate && (
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleRunningLate}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.accent} />
            <Text style={styles.secondaryButtonText}>Notify</Text>
          </TouchableOpacity>
        )}
      </View>
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerTextContainer: {
    alignItems: 'flex-start',
  },
  leaveLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerText: {
    fontSize: 22,
    fontWeight: '800',
  },
  appointmentTimeContainer: {
    alignItems: 'flex-end',
  },
  appointmentTimeLabel: {
    fontSize: 10,
    color: COLORS.textGray,
  },
  appointmentTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  infoSection: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  appointmentType: {
    fontSize: 13,
    color: COLORS.textGray,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    color: COLORS.textGray,
    flex: 1,
  },
  driveTime: {
    fontSize: 12,
    color: COLORS.textGray,
  },
  trafficDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  trafficText: {
    fontSize: 12,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.button,
    gap: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.accent,
    gap: 6,
  },
  secondaryButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});