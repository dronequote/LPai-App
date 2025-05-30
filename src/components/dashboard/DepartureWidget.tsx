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
import api from '../../lib/api';

// Conditional import for Location
let Location: any = null;
try {
  Location = require('expo-location');
} catch (error) {
  console.log('expo-location not available');
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

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000,
            distanceInterval: 100,
          },
          (newLocation) => {
            setCurrentLocation(newLocation);
          }
        );
      } catch (error) {
        setLocationAvailable(false);
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch next appointment
  useEffect(() => {
    fetchNextAppointment();
    const interval = setInterval(fetchNextAppointment, 60000);
    return () => clearInterval(interval);
  }, [user?.locationId]);

  // Calculate real-time ETA when location or appointment changes
  useEffect(() => {
    if (currentLocation && nextAppointment && locationAvailable) {
      calculateRealTimeETA();
      const interval = setInterval(calculateRealTimeETA, 120000);
      return () => clearInterval(interval);
    }
  }, [currentLocation, nextAppointment, locationAvailable]);

  // Update countdown
  useEffect(() => {
    if (!nextAppointment) return;
    
    const timer = setInterval(() => {
      updateCountdown();
    }, 1000);

    updateCountdown();
    return () => clearInterval(timer);
  }, [nextAppointment, realTimeETA]);

  const fetchNextAppointment = async () => {
    try {
      setLoading(true);
      
      const res = await api.get('/api/appointments', {
        params: {
          locationId: user?.locationId,
          userId: user?._id,
        }
      });

      const appointments = res.data || [];
      const now = new Date();
      
      const upcoming = appointments
        .filter((a: any) => new Date(a.start || a.time) > now)
        .sort((a: any, b: any) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime());

      if (upcoming.length > 0) {
        const next = upcoming[0];
        
        try {
          const contactRes = await api.get(`/api/contacts/${next.contactId}`);
          const contact = contactRes.data;
          
          setNextAppointment({
            ...next,
            contact,
            appointmentTime: new Date(next.start || next.time),
          });
          
        } catch (contactError) {
          setNextAppointment({
            ...next,
            contact: null,
            appointmentTime: new Date(next.start || next.time),
          });
        }
      } else {
        setNextAppointment(null);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRealTimeETA = async () => {
    if (!currentLocation || !nextAppointment?.contact?.address) return;

    try {
      const response = await api.post('/api/maps/calculate-eta', {
        origin: {
          lat: currentLocation.coords.latitude,
          lng: currentLocation.coords.longitude,
        },
        destination: nextAppointment.contact.address,
      });

      if (response.data.success && response.data.duration) {
        setRealTimeETA(response.data.duration);
        setTrafficCondition(response.data.trafficCondition);
      } else {
        setRealTimeETA(null);
        setTrafficCondition(null);
      }
    } catch (error) {
      setRealTimeETA(null);
      setTrafficCondition(null);
    }
  };

  const updateCountdown = () => {
    if (!nextAppointment) return;

    const appointmentTime = new Date(nextAppointment.appointmentTime);
    const now = new Date();
    
    // Use calculated ETA or default 20 minutes if no route available
    const travelTime = realTimeETA || 20;
    const bufferTime = userPrefs.arrivalBuffer;
    const departureTime = new Date(appointmentTime.getTime() - (travelTime + bufferTime) * 60000);
    
    const timeDiff = departureTime.getTime() - now.getTime();
    const minutesUntilDeparture = Math.floor(timeDiff / 60000);
    
    setTimeToLeave(minutesUntilDeparture);
    setIsLate(minutesUntilDeparture < 0);

    if (minutesUntilDeparture < 10 && minutesUntilDeparture > 0) {
      startPulseAnimation();
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
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

  const handleNavigate = async () => {
    if (!nextAppointment?.contact?.address) {
      Alert.alert('No Address', 'No address available for navigation');
      return;
    }

    Alert.alert(
      'Navigation',
      'Would you like to notify the customer that you\'re on your way?',
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => openNavigation(false),
        },
        {
          text: 'Yes',
          onPress: () => openNavigation(true),
        },
      ]
    );
  };

  const openNavigation = async (notifyCustomer: boolean) => {
    if (notifyCustomer) {
      Alert.alert('Notification sent', 'Customer has been notified you\'re on the way');
    }

    const address = encodeURIComponent(nextAppointment.contact.address);
    let url = '';

    switch (userPrefs.preferredGPS) {
      case 'apple':
        url = `maps://app?daddr=${address}`;
        break;
      case 'waze':
        url = `waze://?q=${address}&navigate=yes`;
        break;
      case 'google':
      default:
        url = Platform.OS === 'ios'
          ? `comgooglemaps://?daddr=${address}`
          : `google.navigation:q=${address}`;
    }

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://maps.google.com/maps?daddr=${address}`);
      }
    });

    onNavigate?.();
  };

  const handleRunningLate = () => {
    Alert.alert(
      'Running Late',
      'How late will you be?',
      [
        { text: '5 minutes', onPress: () => sendLateNotification(5) },
        { text: '10 minutes', onPress: () => sendLateNotification(10) },
        { text: '15 minutes', onPress: () => sendLateNotification(15) },
        { text: '30 minutes', onPress: () => sendLateNotification(30) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const sendLateNotification = async (minutes: number) => {
    const newArrivalTime = new Date(nextAppointment.appointmentTime);
    newArrivalTime.setMinutes(newArrivalTime.getMinutes() + minutes);
    
    const arrivalTimeString = newArrivalTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    
    Alert.alert(
      'Customer Notified',
      `${nextAppointment.contact?.firstName} has been notified.\nNew arrival time: ${arrivalTimeString}`
    );
  };

  const formatTime = (minutes: number) => {
    if (minutes < 0) {
      const late = Math.abs(minutes);
      return `${late} min late`;
    }
    if (minutes === 0) {
      return 'Leave now!';
    }
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getUrgencyColor = () => {
    if (isLate) return '#FF4444';
    if (timeToLeave < 5) return '#FF6B6B';
    if (timeToLeave < 10) return '#FFA500';
    return COLORS.accent;
  };

  const getTrafficColor = () => {
    switch (trafficCondition) {
      case 'heavy': return '#FF4444';
      case 'moderate': return '#FFA500';
      default: return '#27AE60';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </View>
    );
  }

  if (!nextAppointment) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={32} color={COLORS.accent} />
          <Text style={styles.emptyText}>No more appointments today!</Text>
        </View>
      </View>
    );
  }

  const appointmentTime = new Date(nextAppointment.appointmentTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={[styles.container, { borderColor: getUrgencyColor() }]}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.timerSection}>
            <Ionicons name="car" size={20} color={getUrgencyColor()} />
            <View style={styles.timerTextContainer}>
              <Text style={[styles.leaveLabel, { color: getUrgencyColor() }]}>
                {isLate ? 'LATE BY' : 'LEAVE IN'}
              </Text>
              <Text style={[styles.timerText, { color: getUrgencyColor() }]}>
                {formatTime(timeToLeave)}
              </Text>
            </View>
          </View>
          <View style={styles.appointmentTimeContainer}>
            <Text style={styles.appointmentTimeLabel}>Appointment</Text>
            <Text style={styles.appointmentTime}>{appointmentTime}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.infoSection}>
          <Text style={styles.customerName} numberOfLines={1}>
            {nextAppointment.contact?.firstName} {nextAppointment.contact?.lastName}
          </Text>
          <Text style={styles.appointmentType}>{nextAppointment.title}</Text>
          
          <View style={styles.detailsRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textGray} />
            <Text style={styles.addressText} numberOfLines={1}>
              {nextAppointment.contact?.address || 'No address'}
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Ionicons name="car-outline" size={14} color={COLORS.textGray} />
            <Text style={styles.driveTime}>
              {realTimeETA !== null 
                ? `${realTimeETA} min drive` 
                : 'Route unavailable'}
            </Text>
            {realTimeETA !== null && trafficCondition && (
              <>
                <View style={[styles.trafficDot, { backgroundColor: getTrafficColor() }]} />
                <Text style={[styles.trafficText, { color: getTrafficColor() }]}>
                  {trafficCondition === 'normal' ? 'Clear' : trafficCondition === 'moderate' ? 'Moderate' : 'Heavy'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: getUrgencyColor() }]}
            onPress={handleNavigate}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Navigate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleRunningLate}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.accent} />
            <Text style={styles.secondaryButtonText}>Running Late</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
    ...SHADOW.card,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
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