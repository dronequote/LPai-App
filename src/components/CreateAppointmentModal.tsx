import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext'; // << USE CONTEXT
import { COLORS, INPUT, RADIUS, FONT } from '../styles/theme';
import type { Contact } from '../../packages/types/dist';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const LOCATION_TYPES = ['address', 'phone', 'googlemeet', 'zoom', 'custom'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  contacts: Contact[];
  selectedDate?: string | Date;
}

export default function CreateAppointmentModal({
  visible, onClose, onSubmit, contacts, selectedDate,
}: Props) {
  const { user } = useAuth();
  const { calendars } = useCalendar(); // << GRAB CALENDARS FROM CONTEXT

  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [calendarError, setCalendarError] = useState('');
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [locationType, setLocationType] = useState('address');
  const [customLocation, setCustomLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<Date>(selectedDate ? new Date(selectedDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState<number>(60);

  // Set up calendars and defaults when modal opens
  useEffect(() => {
    if (visible) {
      if (Array.isArray(calendars) && calendars.length > 0) {
        setSelectedCalendarId(calendars[0].id || calendars[0].calendarId || '');
        setCalendarError('');
      } else {
        setSelectedCalendarId('');
        setCalendarError('No calendars found for this location.');
      }
    }
  }, [visible, calendars]);

  const filteredContacts = contacts?.filter(c =>
    (c.firstName + ' ' + c.lastName + ' ' + c.email + ' ' + (c.phone || ''))
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setSearch('');
  };

  if (calendarError) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <Text style={styles.header}>Error</Text>
            <Text>{calendarError}</Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: COLORS.accent, marginTop: 12 }]}
              onPress={onClose}
            >
              <Text style={{ color: '#fff' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.header}>Create Appointment</Text>

          {/* Contact Search/Select */}
          {!selectedContact ? (
            <View style={styles.inputSection}>
              <TextInput
                style={styles.input}
                placeholder="Search contact (name, email, phone)"
                value={search}
                onChangeText={setSearch}
                autoFocus
                placeholderTextColor={COLORS.textGray}
              />
              {search.length > 1 && (
                <FlatList
                  data={filteredContacts}
                  keyExtractor={item => item._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.contactOption}
                      onPress={() => handleContactSelect(item)}
                    >
                      <Text>{item.firstName} {item.lastName} ({item.email})</Text>
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: 120 }}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectedContact}
              onPress={() => setSelectedContact(null)}
            >
              <Text style={{ color: COLORS.accent, fontWeight: '600' }}>
                {selectedContact.firstName} {selectedContact.lastName} ({selectedContact.email})
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textGray }}>Tap to change contact</Text>
            </TouchableOpacity>
          )}

          {/* Calendar Dropdown (from context, no prop) */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Calendar:</Text>
            <FlatList
              data={calendars}
              keyExtractor={item => item.id || item.calendarId}
              horizontal
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pill,
                    selectedCalendarId === (item.id || item.calendarId) && styles.pillSelected,
                  ]}
                  onPress={() => setSelectedCalendarId(item.id || item.calendarId)}
                >
                  <Text style={{
                    color: selectedCalendarId === (item.id || item.calendarId)
                      ? COLORS.card
                      : COLORS.accent,
                    fontWeight: selectedCalendarId === (item.id || item.calendarId) ? '700' : '500'
                  }}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Title */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Title:</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={COLORS.textGray}
            />
          </View>

          {/* Date/Time Picker */}
          <Text style={styles.label}>Date:</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.inputSection}
          >
            <Text style={{ color: COLORS.textDark }}>
              {date.toDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          <DateTimePickerModal
            isVisible={showDatePicker}
            mode="datetime"
            date={date}
            onConfirm={selectedDate => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
            }}
            onCancel={() => setShowDatePicker(false)}
          />

          {/* Duration Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Duration:</Text>
            <FlatList
              horizontal
              data={DURATION_OPTIONS}
              keyExtractor={item => item.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pill,
                    duration === item && styles.pillSelected,
                  ]}
                  onPress={() => setDuration(item)}
                >
                  <Text style={{
                    color: duration === item ? COLORS.card : COLORS.accent,
                    fontWeight: duration === item ? '700' : '500'
                  }}>
                    {item} min
                  </Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>

          {/* Location Dropdown */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Location Type:</Text>
            <FlatList
              horizontal
              data={LOCATION_TYPES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pill,
                    locationType === item && styles.pillSelected,
                  ]}
                  onPress={() => setLocationType(item)}
                >
                  <Text style={{
                    color: locationType === item ? COLORS.card : COLORS.accent,
                    fontWeight: locationType === item ? '700' : '500'
                  }}>
                    {item === 'address'
                      ? selectedContact?.address || 'Contact Address'
                      : item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
            {locationType === 'custom' && (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="Enter custom location"
                value={customLocation}
                onChangeText={setCustomLocation}
                placeholderTextColor={COLORS.textGray}
              />
            )}
          </View>

          {/* Notes */}
          <View style={styles.inputSection}>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={COLORS.textGray}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.row}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={{ color: COLORS.accent }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: COLORS.accent }]}
              onPress={() => {
                if (!selectedContact || !selectedCalendarId) {
                  Alert.alert('Error', 'Please select a contact and calendar.');
                  return;
                }
                if (!user || !user._id || !user.locationId) {
                  Alert.alert('Auth Error', 'Missing user ID or location ID. Please re-login.');
                  return;
                }
                if (!title) {
                  Alert.alert('Error', 'Title is required.');
                  return;
                }
                const start = date;
                const end = new Date(start.getTime() + duration * 60000);
                const payload = {
                  contactId: selectedContact._id,
                  calendarId: selectedCalendarId,
                  title,
                  start: start.toISOString(),
                  end: end.toISOString(),
                  locationType,
                  customLocation,
                  notes,
                  duration,
                  userId: user._id,
                  locationId: user.locationId,
                };
                onSubmit(payload);
              }}
            >
              <Text style={{ color: '#fff' }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- Central styles using THEME ---
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '95%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.modal,
    padding: 22,
  },
  header: {
    fontSize: FONT.header,
    fontWeight: '700',
    marginBottom: 18,
    color: COLORS.textDark,
  },
  inputSection: {
    marginBottom: INPUT.marginBottom,
    minHeight: INPUT.minHeight + 6,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: INPUT.borderRadius,
    backgroundColor: COLORS.inputBg,
    padding: INPUT.padding,
    fontSize: INPUT.fontSize,
    minHeight: INPUT.minHeight,
    color: COLORS.textDark,
  },
  label: {
    fontSize: FONT.label,
    color: COLORS.accent,
    marginBottom: 2,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  button: {
    borderRadius: RADIUS.button,
    padding: 14,
    minWidth: 100,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  contactOption: {
    padding: 10,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  selectedContact: {
    padding: 10,
    borderRadius: INPUT.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.accent,
    marginBottom: 10,
    backgroundColor: COLORS.accentMuted,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accentMuted,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: COLORS.accent,
  },
});
