// src/screens/AppointmentDetailScreen.tsx
// Updated: 2025-06-18
// Description: Optimized appointment details with modern UI

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { appointmentService } from '../services/appointmentService';
import { contactService } from '../services/contactService';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Appointment, Contact, Calendar } from '../../packages/types/dist';

type AppointmentDetailRouteParams = {
  appointmentId: string;
};

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 'custom', label: 'Custom duration' },
];

const LOCATION_OPTIONS = [
  { label: 'Contact Address', value: 'address', icon: 'location-outline' },
  { label: 'Phone Call', value: 'phone', icon: 'call-outline' },
  { label: 'Video Call', value: 'video', icon: 'videocam-outline' },
  { label: 'Custom Location', value: 'custom', icon: 'navigate-outline' },
];

export default function AppointmentDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { calendars } = useCalendar();
  
  const { appointmentId } = route.params as AppointmentDetailRouteParams;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [locationType, setLocationType] = useState('address');
  const [customLocation, setCustomLocation] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState<number | string>(60);
  const [customDuration, setCustomDuration] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Contact search
  const [contactSearch, setContactSearch] = useState('');
  const [showContactSearch, setShowContactSearch] = useState(false);

  // Calculate appointment end time
  const appointmentEndTime = useMemo(() => {
    if (!appointment?.start || !appointment?.end) return null;
    return new Date(appointment.end);
  }, [appointment]);

  // Calculate duration in minutes
  const appointmentDuration = useMemo(() => {
    if (!appointment?.start || !appointment?.end) return 60;
    const start = new Date(appointment.start);
    const end = new Date(appointment.end);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }, [appointment]);

  // Fetch appointment details and contacts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch appointment
        const appointmentData = await appointmentService.getDetails(appointmentId);
        setAppointment(appointmentData);
        
        // Set form fields
        setTitle(appointmentData.title || '');
        setNotes(appointmentData.notes || '');
        setLocationType(appointmentData.locationType || 'address');
        setCustomLocation(appointmentData.customLocation || '');
        setSelectedCalendarId(appointmentData.calendarId || '');
        setSelectedContactId(appointmentData.contactId || '');
        setDate(new Date(appointmentData.start));
        setDuration(appointmentDuration);

        // Fetch contact if contactId exists
        if (appointmentData.contactId) {
          try {
            const contactData = await contactService.getDetails(appointmentData.contactId);
            setContact(contactData);
          } catch (err) {
            console.error('Failed to fetch contact:', err);
          }
        }

        // Get calendar from context
        if (appointmentData.calendarId && calendars) {
          const foundCalendar = calendars.find(cal => 
            cal.id === appointmentData.calendarId || cal.calendarId === appointmentData.calendarId
          );
          setCalendar(foundCalendar || null);
        }

        // Fetch all contacts for editing
        const contactsData = await contactService.list(user?.locationId || '');
        setAllContacts(contactsData);

      } catch (err) {
        console.error('Failed to fetch data:', err);
        Alert.alert('Error', 'Failed to load appointment details');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    if (appointmentId && user?.locationId) {
      fetchData();
    }
  }, [appointmentId, user?.locationId, calendars]);

  const handleSave = async () => {
    if (!appointment || !selectedContactId || !selectedCalendarId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    try {
      setSaving(true);
      const finalDuration = duration === 'custom' ? parseInt(customDuration) || 60 : Number(duration);
      const endDate = new Date(date.getTime() + finalDuration * 60000);
      
      await appointmentService.update(
        appointment._id,
        {
          title,
          notes,
          locationType,
          customLocation,
          contactId: selectedContactId,
          calendarId: selectedCalendarId,
          start: date.toISOString(),
          end: endDate.toISOString(),
          userId: user?.userId || user?.ghlUserId,
        },
        user?.locationId || ''
      );
            
      // Update local state
      setAppointment({ 
        ...appointment, 
        title, 
        notes, 
        locationType,
        customLocation,
        contactId: selectedContactId,
        calendarId: selectedCalendarId,
        start: date.toISOString(),
        end: endDate.toISOString(),
      });
      
      // Update contact and calendar references
      const updatedContact = allContacts.find(c => c._id === selectedContactId);
      setContact(updatedContact || null);
      
      const updatedCalendar = calendars?.find(cal => 
        cal.id === selectedCalendarId || cal.calendarId === selectedCalendarId
      );
      setCalendar(updatedCalendar || null);
      
      setEditing(false);
      Alert.alert('Success', 'Appointment updated successfully');
    } catch (err: any) {
      console.error('Failed to update appointment:', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to update appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Appointment',
      'Are you sure you want to delete this appointment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await appointmentService.delete(appointmentId);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete appointment');
            }
          },
        },
      ]
    );
  };

  const handleCall = () => {
    if (contact?.phone) {
      Linking.openURL(`tel:${contact.phone}`);
    }
  };

  const handleEmail = () => {
    if (contact?.email) {
      Linking.openURL(`mailto:${contact.email}`);
    }
  };

  const handleDirections = () => {
    if (contact?.address) {
      const url = Platform.OS === 'ios'
        ? `maps:0,0?q=${encodeURIComponent(contact.address)}`
        : `geo:0,0?q=${encodeURIComponent(contact.address)}`;
      Linking.openURL(url);
    }
  };

  const handleContactSelect = (selectedContact: Contact) => {
    setSelectedContactId(selectedContact._id);
    setContact(selectedContact);
    setShowContactSearch(false);
    setContactSearch('');
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return [];
    return allContacts.filter(c =>
      (c.firstName + ' ' + c.lastName + ' ' + c.email + ' ' + (c.phone || ''))
        .toLowerCase()
        .includes(contactSearch.toLowerCase())
    );
  }, [allContacts, contactSearch]);

  const getLocationDisplay = () => {
    const type = locationType || appointment?.locationType || 'address';
    
    if (type === 'custom') {
      return customLocation || appointment?.customLocation || appointment?.address || 'Custom location';
    }
    if (type === 'address') {
      // Use appointment address or contact address
      return appointment?.address || contact?.address || 'Contact address';
    }
    if (type === 'phone') {
      // Show phone number for phone meetings
      return appointment?.contactPhone || contact?.phone || 'Phone call';
    }
    if (type === 'gmeet' || type === 'google') {
      return appointment?.address || 'Google Meet';
    }
    if (type === 'zoom') {
      return appointment?.address || 'Zoom Meeting';
    }
    if (type === 'ms_teams') {
      return appointment?.address || 'Microsoft Teams';
    }
    
    // If address field contains meeting info, use it
    if (appointment?.address) {
      return appointment.address;
    }
    
    return 'No location specified';
  };

  const getLocationIcon = () => {
    const type = locationType || appointment?.locationType || 'address';
    
    const iconMap: { [key: string]: string } = {
      'address': 'location-outline',
      'phone': 'call-outline',
      'gmeet': 'videocam-outline',
      'google': 'videocam-outline',
      'zoom': 'videocam-outline',
      'ms_teams': 'videocam-outline',
      'video': 'videocam-outline',
      'custom': 'navigate-outline',
    };
    
    return iconMap[type] || 'location-outline';
  };

  const handleLocationAction = () => {
    const type = locationType || appointment?.locationType || 'address';
    const locationText = getLocationDisplay();
    
    if (type === 'phone' && (appointment?.contactPhone || contact?.phone)) {
      // Make phone call
      Linking.openURL(`tel:${appointment?.contactPhone || contact?.phone}`);
    } else if (type === 'address' && locationText && locationText !== 'Contact address') {
      // Open in maps
      const url = Platform.OS === 'ios'
        ? `maps:0,0?q=${encodeURIComponent(locationText)}`
        : `geo:0,0?q=${encodeURIComponent(locationText)}`;
      Linking.openURL(url);
    } else if ((type === 'gmeet' || type === 'google' || type === 'zoom' || type === 'ms_teams') && appointment?.address) {
      // Open meeting link if it's a URL
      if (appointment.address.startsWith('http')) {
        Linking.openURL(appointment.address);
      }
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading appointment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.errorText}>Appointment not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const calendarColor = calendar?.eventColor || calendar?.color || COLORS.accent;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, editing && styles.headerEditing]}>
          <TouchableOpacity 
            onPress={() => editing ? setEditing(false) : navigation.goBack()}
            style={styles.headerButton}
          >
            <Ionicons 
              name={editing ? "close" : "arrow-back"} 
              size={24} 
              color={COLORS.textDark} 
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editing ? 'Edit Appointment' : ''}
          </Text>
          {editing ? (
            <TouchableOpacity 
              onPress={handleSave}
              style={[styles.headerButton, styles.saveHeaderButton]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Text style={styles.saveHeaderText}>Save</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={() => setEditing(true)}
                style={styles.headerButton}
              >
                <Ionicons name="pencil" size={20} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDelete}
                style={styles.headerButton}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Title Section */}
          <View style={styles.section}>
            {editing ? (
              <View>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter appointment title"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            ) : (
              <View style={styles.titleSection}>
                <View style={[styles.calendarIndicator, { backgroundColor: calendarColor }]} />
                <View style={styles.titleContent}>
                  <Text style={styles.appointmentTitle}>{appointment.title || 'Untitled Appointment'}</Text>
                  <Text style={styles.calendarName}>{calendar?.name || 'Calendar'}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Contact Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Contact</Text>
            {editing ? (
              <View>
                {contact && !showContactSearch ? (
                  <TouchableOpacity 
                    style={styles.contactEditCard}
                    onPress={() => setShowContactSearch(true)}
                  >
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactInitials}>
                        {contact.firstName?.[0]}{contact.lastName?.[0]}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>
                        {contact.firstName} {contact.lastName}
                      </Text>
                      <Text style={styles.contactEmail}>{contact.email}</Text>
                    </View>
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <TextInput
                      style={styles.input}
                      placeholder="Search contacts..."
                      placeholderTextColor={COLORS.textLight}
                      value={contactSearch}
                      onChangeText={setContactSearch}
                      onFocus={() => setShowContactSearch(true)}
                    />
                    {showContactSearch && filteredContacts.length > 0 && (
                      <FlatList
                        data={filteredContacts}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.contactOption}
                            onPress={() => handleContactSelect(item)}
                          >
                            <View style={styles.contactAvatar}>
                              <Text style={styles.contactInitials}>
                                {item.firstName?.[0]}{item.lastName?.[0]}
                              </Text>
                            </View>
                            <View style={styles.contactInfo}>
                              <Text style={styles.contactOptionName}>
                                {item.firstName} {item.lastName}
                              </Text>
                              <Text style={styles.contactOptionEmail}>
                                {item.email}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        style={styles.contactList}
                        keyboardShouldPersistTaps="handled"
                      />
                    )}
                  </View>
                )}
              </View>
            ) : (
              contact && (
                <TouchableOpacity 
                  style={styles.contactCard}
                  onPress={() => navigation.navigate('ContactDetailScreen', { contact })}
                >
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactInitials}>
                      {contact.firstName?.[0]}{contact.lastName?.[0]}
                    </Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>
                      {contact.firstName} {contact.lastName}
                    </Text>
                    <Text style={styles.contactEmail}>{contact.email}</Text>
                    {contact.phone && (
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Quick Actions (only in view mode) */}
          {!editing && contact && (
            <View style={styles.quickActions}>
              {contact.phone && (
                <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                  <Ionicons name="call" size={20} color={COLORS.accent} />
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
              )}
              {contact.email && (
                <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
                  <Ionicons name="mail" size={20} color={COLORS.accent} />
                  <Text style={styles.actionText}>Email</Text>
                </TouchableOpacity>
              )}
              {contact.address && locationType === 'address' && (
                <TouchableOpacity style={styles.actionButton} onPress={handleDirections}>
                  <Ionicons name="navigate" size={20} color={COLORS.accent} />
                  <Text style={styles.actionText}>Directions</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Calendar Selection (only in edit mode) */}
          {editing && (
            <View style={styles.section}>
              <Text style={styles.label}>Calendar</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCalendarDropdown(!showCalendarDropdown)}
              >
                <View style={styles.dropdownContent}>
                  <View style={[styles.calendarDot, { backgroundColor: calendarColor }]} />
                  <Text style={styles.dropdownText}>
                    {calendar?.name || 'Select Calendar'}
                  </Text>
                </View>
                <Ionicons 
                  name={showCalendarDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={COLORS.textGray} 
                />
              </TouchableOpacity>
              {showCalendarDropdown && (
                <View style={styles.dropdownList}>
                  {calendars?.map((item) => (
                    <TouchableOpacity
                      key={item.id || item.calendarId}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCalendarId(item.id || item.calendarId);
                        setCalendar(item);
                        setShowCalendarDropdown(false);
                      }}
                    >
                      <View style={[styles.calendarDot, { backgroundColor: item.color }]} />
                      <Text style={styles.dropdownItemText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Date & Time Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Date & Time</Text>
            {editing ? (
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={COLORS.accent} />
                <Text style={styles.dateTimeText}>
                  {formatDateTime(date.toISOString())}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.dateTimeCard}>
                <View style={styles.dateTimeIcon}>
                  <Ionicons name="time-outline" size={24} color={COLORS.accent} />
                </View>
                <View style={styles.dateTimeInfo}>
                  <Text style={styles.dateTimeMainText}>
                    {new Date(appointment.start).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.dateTimeSubText}>
                    {new Date(appointment.start).toLocaleTimeString([], { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}
                    {appointmentEndTime && ` - ${appointmentEndTime.toLocaleTimeString([], { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}`}
                  </Text>
                  <Text style={styles.durationText}>
                    {formatDuration(appointmentDuration)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Duration (only in edit mode) */}
          {editing && (
            <View style={styles.section}>
              <Text style={styles.label}>Duration</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowDurationDropdown(!showDurationDropdown)}
              >
                <Text style={styles.dropdownText}>
                  {duration === 'custom' 
                    ? `Custom: ${customDuration || '60'} min` 
                    : formatDuration(Number(duration))
                  }
                </Text>
                <Ionicons 
                  name={showDurationDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={COLORS.textGray} 
                />
              </TouchableOpacity>
              {showDurationDropdown && (
                <View style={styles.dropdownList}>
                  {DURATION_OPTIONS.map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setDuration(item.value);
                        setShowDurationDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {duration === 'custom' && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={customDuration}
                  onChangeText={setCustomDuration}
                  placeholder="Minutes"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                />
              )}
            </View>
          )}

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            {editing ? (
              <View>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                >
                  <View style={styles.dropdownContent}>
                    <Ionicons 
                      name={getLocationIcon()} 
                      size={20} 
                      color={COLORS.textGray} 
                    />
                    <Text style={styles.dropdownText}>
                      {LOCATION_OPTIONS.find(opt => opt.value === locationType)?.label || 'Select Location'}
                    </Text>
                  </View>
                  <Ionicons 
                    name={showLocationDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={COLORS.textGray} 
                  />
                </TouchableOpacity>
                {showLocationDropdown && (
                  <View style={styles.dropdownList}>
                    {LOCATION_OPTIONS.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setLocationType(item.value);
                          setShowLocationDropdown(false);
                        }}
                      >
                        <Ionicons name={item.icon} size={20} color={COLORS.textGray} />
                        <Text style={[styles.dropdownItemText, { marginLeft: 12 }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {locationType === 'custom' && (
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={customLocation}
                    onChangeText={setCustomLocation}
                    placeholder="Enter location"
                    placeholderTextColor={COLORS.textLight}
                  />
                )}
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.locationCard}
                onPress={handleLocationAction}
                disabled={!((locationType === 'phone' && (appointment?.contactPhone || contact?.phone)) || 
                          (locationType === 'address' && appointment?.address) ||
                          (appointment?.address?.startsWith('http')))}
              >
                <Ionicons 
                  name={getLocationIcon()} 
                  size={20} 
                  color={COLORS.textGray} 
                />
                <Text style={[
                  styles.locationText,
                  ((locationType === 'phone' && (appointment?.contactPhone || contact?.phone)) || 
                   (locationType === 'address' && appointment?.address) ||
                   (appointment?.address?.startsWith('http'))) && styles.locationTextClickable
                ]}>
                  {getLocationDisplay()}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes..."
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>
                  {appointment.notes || 'No notes added'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Date Time Picker Modal */}
        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="datetime"
          date={date}
          onConfirm={(selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
          onCancel={() => setShowDatePicker(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontFamily: FONT.medium,
    color: COLORS.textGray,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.medium,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONT.medium,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerEditing: {
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveHeaderButton: {
    paddingHorizontal: 16,
  },
  saveHeaderText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.accent,
  },
  
  // Content styles
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  label: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textGray,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Title section
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.light,
  },
  calendarIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 16,
  },
  titleContent: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: 20,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  calendarName: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  
  // Input styles
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  notesInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  
  // Contact styles
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.light,
  },
  contactEditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInitials: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONT.semiBold,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  contactEmail: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  contactPhone: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  changeText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  
  // Contact search
  contactList: {
    marginTop: 8,
    maxHeight: 200,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.light,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactOptionName: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  contactOptionEmail: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  
  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    gap: 8,
    ...SHADOW.light,
  },
  actionText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  
  // Date time styles
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOW.light,
  },
  dateTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.light,
  },
  dateTimeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  dateTimeInfo: {
    flex: 1,
  },
  dateTimeText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  dateTimeMainText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  dateTimeSubText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  durationText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    marginTop: 4,
  },
  
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    flex: 1,
  },
  dropdownList: {
    marginTop: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.medium,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownItemText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  calendarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  
  // Location styles
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOW.light,
  },
  locationText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    flex: 1,
  },
  locationTextClickable: {
    color: COLORS.accent,
    textDecorationLine: 'underline',
  },
  
  // Notes styles
  notesCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.light,
  },
  notesText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    lineHeight: 24,
  },
});