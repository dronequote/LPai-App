// Updated: 2025-06-17
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { appointmentService } from '../services/appointmentService';
import { contactService } from '../services/contactService';
import { COLORS, FONT, RADIUS, SHADOW, DROPDOWN, Z_INDEX } from '../styles/theme';
import type { Appointment, Contact, Calendar } from '../../packages/types/dist';

type AppointmentDetailRouteParams = {
  appointmentId: string;
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 'Custom'];

const LOCATION_OPTIONS = [
  { label: 'Contact Address', value: 'address' },
  { label: 'Phone Call', value: 'phone' },
  { label: 'Google Meet', value: 'gmeet' },
  { label: 'Custom Location', value: 'custom' },
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
  const [location, setLocation] = useState('');
  const [locationType, setLocationType] = useState('address');
  const [customLocation, setCustomLocation] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Contact search
  const [contactSearch, setContactSearch] = useState('');
  const [showContactSearch, setShowContactSearch] = useState(false);

  // Fetch appointment details and contacts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch appointment
        const appointmentData = await appointmentService.getById(appointmentId, user?.locationId || '');
        setAppointment(appointmentData);
        
        // Set form fields
        setTitle(appointmentData.title || '');
        setNotes(appointmentData.notes || '');
        setLocation(appointmentData.location || '');
        setLocationType(appointmentData.locationType || 'address');
        setCustomLocation(appointmentData.customLocation || '');
        setSelectedCalendarId(appointmentData.calendarId || '');
        setSelectedContactId(appointmentData.contactId || '');
        setDate(new Date(appointmentData.start));
        
        // Calculate duration
        if (appointmentData.start && appointmentData.end) {
          const startTime = new Date(appointmentData.start);
          const endTime = new Date(appointmentData.end);
          const durationMs = endTime.getTime() - startTime.getTime();
          setDuration(Math.round(durationMs / (1000 * 60))); // Convert to minutes
        }

        // Fetch contact if contactId exists
        if (appointmentData.contactId) {
          try {
            const contactData = await contactService.getById(appointmentData.contactId, user?.locationId || '');
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
      const finalDuration = duration === 'Custom' ? parseInt(customDuration) || 60 : duration;
      const endDate = new Date(date.getTime() + finalDuration * 60000);
      
      await appointmentService.update(appointment._id, user?.locationId || '', {
        title,
        notes,
        locationType,
        customLocation,
        contactId: selectedContactId,
        calendarId: selectedCalendarId,
        start: date.toISOString(),
        end: endDate.toISOString(),
      });
      
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
    } catch (err) {
      console.error('Failed to update appointment:', err);
      Alert.alert('Error', 'Failed to update appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleContactPress = () => {
    if (contact && !editing) {
      navigation.navigate('ContactDetailScreen', { contact });
    }
  };

  const handleContactSelect = (selectedContact: Contact) => {
    setSelectedContactId(selectedContact._id);
    setContact(selectedContact);
    setShowContactSearch(false);
    setContactSearch('');
  };

  const filteredContacts = allContacts.filter(c =>
    (c.firstName + ' ' + c.lastName + ' ' + c.email + ' ' + (c.phone || ''))
      .toLowerCase()
      .includes(contactSearch.toLowerCase())
  );

  const getLocationDisplay = () => {
    if (!locationType && !appointment.locationType) return 'No location specified';
    const type = locationType || appointment.locationType;
    if (type === 'custom') return customLocation || appointment.customLocation || 'Custom location';
    if (type === 'address') return contact?.address || 'Contact address';
    if (type === 'phone') return contact?.phone || 'Phone call';
    if (type === 'gmeet') return 'Google Meet';
    return 'No location specified';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Appointment not found</Text>
      </SafeAreaView>
    );
  }

  const { date: displayDate, time: displayTime } = formatDateTime(appointment.start);
  const calColor = calendar?.eventColor || calendar?.color || COLORS.accent;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Appointment Details</Text>
          <TouchableOpacity 
            onPress={() => setEditing(!editing)}
            style={styles.editButton}
          >
            <Ionicons 
              name={editing ? "close" : "pencil"} 
              size={20} 
              color={COLORS.accent} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Title</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Appointment title"
              />
            ) : (
              <Text style={styles.value}>{appointment.title}</Text>
            )}
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.label}>Contact</Text>
            {editing ? (
              <View>
                {contact && !showContactSearch ? (
                  <TouchableOpacity 
                    style={styles.selectedContactCard}
                    onPress={() => setShowContactSearch(true)}
                  >
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>
                        {contact.firstName} {contact.lastName}
                      </Text>
                      <Text style={styles.contactEmail}>{contact.email}</Text>
                    </View>
                    <Text style={styles.changeText}>Tap to change</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <TextInput
                      style={styles.input}
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChangeText={setContactSearch}
                      autoFocus
                    />
                    {contactSearch.length > 1 && (
                      <FlatList
                        data={filteredContacts}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.contactOption}
                            onPress={() => handleContactSelect(item)}
                          >
                            <Text style={styles.contactOptionName}>
                              {item.firstName} {item.lastName}
                            </Text>
                            <Text style={styles.contactOptionEmail}>
                              {item.email}
                            </Text>
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
                <TouchableOpacity onPress={handleContactPress} style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>
                      {contact.firstName} {contact.lastName}
                    </Text>
                    <Text style={styles.contactEmail}>{contact.email}</Text>
                    {contact.phone && (
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Calendar */}
          <View style={styles.section}>
            <Text style={styles.label}>Calendar</Text>
            {editing ? (
              <View style={[DROPDOWN.container, DROPDOWN.getZIndex(1)]}>
                <TouchableOpacity
                  style={DROPDOWN.button}
                  onPress={() => setShowCalendarDropdown(!showCalendarDropdown)}
                >
                  <Text style={DROPDOWN.buttonText}>
                    {calendar?.name || 'Select Calendar'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textGray} />
                </TouchableOpacity>
                {showCalendarDropdown && (
                  <ScrollView 
                    style={[DROPDOWN.overlay, DROPDOWN.getZIndex(1)]}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                  >
                    {calendars?.map((item) => (
                      <TouchableOpacity
                        key={item.id || item.calendarId}
                        style={DROPDOWN.item}
                        onPress={() => {
                          setSelectedCalendarId(item.id || item.calendarId);
                          setCalendar(item);
                          setShowCalendarDropdown(false);
                        }}
                      >
                        <Text style={DROPDOWN.itemText}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              calendar && (
                <View style={[styles.calendarCard, { borderLeftColor: calColor }]}>
                  <Ionicons 
                    name={calendar.icon || 'calendar-outline'} 
                    size={20} 
                    color={calColor} 
                  />
                  <Text style={styles.calendarName}>{calendar.name}</Text>
                </View>
              )
            )}
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.label}>Date & Time</Text>
            {editing ? (
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateTimePickerText}>
                  {date.toDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.dateTimeCard}>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="calendar-outline" size={16} color={COLORS.textGray} />
                  <Text style={styles.dateTimeText}>{displayDate}</Text>
                </View>
                <View style={styles.dateTimeRow}>
                  <Ionicons name="time-outline" size={16} color={COLORS.textGray} />
                  <Text style={styles.dateTimeText}>{displayTime}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Duration (only when editing) */}
          {editing && (
            <View style={styles.section}>
              <Text style={styles.label}>Duration</Text>
              <View style={[DROPDOWN.container, DROPDOWN.getZIndex(4)]}>
                <TouchableOpacity
                  style={DROPDOWN.button}
                  onPress={() => setShowDurationDropdown(!showDurationDropdown)}
                >
                  <Text style={DROPDOWN.buttonText}>
                    {duration === 'Custom' ? `${customDuration || '60'} min` : `${duration} min`}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textGray} />
                </TouchableOpacity>
                {showDurationDropdown && (
                  <ScrollView 
                    style={[DROPDOWN.overlay, DROPDOWN.getZIndex(4)]}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                  >
                    {DURATION_OPTIONS.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={DROPDOWN.item}
                        onPress={() => {
                          setDuration(item);
                          setShowDurationDropdown(false);
                        }}
                      >
                        <Text style={DROPDOWN.itemText}>
                          {item === 'Custom' ? 'Custom' : `${item} min`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              {/* Custom duration input */}
              {duration === 'Custom' && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={customDuration}
                  onChangeText={setCustomDuration}
                  placeholder="Enter duration in minutes"
                  keyboardType="numeric"
                />
              )}
            </View>
          )}

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            {editing ? (
              <View>
                <View style={[DROPDOWN.container, DROPDOWN.getZIndex(2)]}>
                  <TouchableOpacity
                    style={DROPDOWN.button}
                    onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                  >
                    <Text style={DROPDOWN.buttonText}>
                      {LOCATION_OPTIONS.find(opt => opt.value === locationType)?.label || 'Select Location Type'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={COLORS.textGray} />
                  </TouchableOpacity>
                  {showLocationDropdown && (
                    <ScrollView 
                      style={[DROPDOWN.overlay, DROPDOWN.getZIndex(2)]}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      {LOCATION_OPTIONS.map((item) => (
                        <TouchableOpacity
                          key={item.value}
                          style={DROPDOWN.item}
                          onPress={() => {
                            setLocationType(item.value);
                            setShowLocationDropdown(false);
                          }}
                        >
                          <Text style={DROPDOWN.itemText}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
                {/* Custom location input */}
                {locationType === 'custom' && (
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={customLocation}
                    onChangeText={setCustomLocation}
                    placeholder="Enter custom location"
                  />
                )}
              </View>
            ) : (
              <Text style={styles.value}>{getLocationDisplay()}</Text>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes..."
                multiline
                numberOfLines={4}
              />
            ) : (
              <Text style={styles.value}>{appointment.notes || 'No notes'}</Text>
            )}
          </View>

          {/* Save button when editing */}
          {editing && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    ...SHADOW.card,
  },
  headerTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: FONT.label,
    fontWeight: '600',
    color: COLORS.textGray,
    marginBottom: 8,
  },
  value: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  contactCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.card,
  },
  selectedContactCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  changeText: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },
  contactOption: {
    padding: 12,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  contactOptionName: {
    fontSize: FONT.input,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  contactOptionEmail: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  contactList: {
    maxHeight: 200,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    ...SHADOW.card,
  },
  calendarName: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    marginLeft: 12,
    fontWeight: '500',
  },
  dateTimeCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    ...SHADOW.card,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTimeText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    marginLeft: 12,
  },
  dateTimePickerText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
    elevation: 1000, // Android elevation
  },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    flex: 1,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 200,
    zIndex: 1001,
    elevation: 1001, // Android elevation
    ...SHADOW.card,
  },
  dropdownItem: {
    padding: 12,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
  errorText: {
    fontSize: FONT.input,
    color: COLORS.textRed,
    textAlign: 'center',
    marginTop: 50,
  },
});