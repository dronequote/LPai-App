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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { COLORS, INPUT, RADIUS, FONT, SHADOW } from '../styles/theme';
import type { Contact } from '../../packages/types/dist';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  contacts: Contact[];
  selectedDate?: string | Date;
  preSelectedContact?: Contact;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 'Custom'];

const LOCATION_OPTIONS = [
  { label: 'Contact Address', value: 'address' },
  { label: 'Phone Call', value: 'phone' },
  { label: 'Google Meet', value: 'gmeet' },
  { label: 'Custom Location', value: 'custom' },
];

export default function CreateAppointmentModal({
  visible, onClose, onSubmit, contacts, selectedDate, preSelectedContact,
}: Props) {
  const { user } = useAuth();
  const { calendars } = useCalendar();

  // Animation and gesture handling
  const [translateY] = useState(new Animated.Value(MODAL_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Gesture event handler
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      
      if (translationY > 100 || velocityY > 500) {
        // Dismiss modal
        handleClose();
      } else {
        // Snap back
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Form state
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [locationType, setLocationType] = useState('address');
  const [customLocation, setCustomLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<Date>(selectedDate ? new Date(selectedDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState('');

  // Dropdown states
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showContactSearch, setShowContactSearch] = useState(false);

  // Setup when modal opens/closes
  useEffect(() => {
    if (visible) {
      // Reset form
      setSearch('');
      setTitle('');
      setNotes('');
      setCustomLocation('');
      setCustomDuration('');
      setShowContactSearch(false);
      
      // Set defaults
      if (preSelectedContact) {
        setSelectedContact(preSelectedContact);
      } else {
        setSelectedContact(null);
      }
      
      if (calendars && calendars.length > 0) {
        setSelectedCalendarId(calendars[0].id || calendars[0].calendarId || '');
      }
      
      // Reset animation values
      translateY.setValue(MODAL_HEIGHT);
      overlayOpacity.setValue(0);
      
      // Animate in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, calendars, preSelectedContact]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const filteredContacts = contacts?.filter(c =>
    (c.firstName + ' ' + c.lastName + ' ' + c.email + ' ' + (c.phone || ''))
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setSearch('');
    setShowContactSearch(false);
  };

  const selectedCalendar = calendars?.find(cal => 
    cal.id === selectedCalendarId || cal.calendarId === selectedCalendarId
  );

  const handleSubmit = () => {
    const contactToUse = preSelectedContact || selectedContact;
    if (!contactToUse || !selectedCalendarId || !title) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    if (!user || !user._id || !user.locationId) {
      Alert.alert('Auth Error', 'Missing user information. Please try again.');
      return;
    }

    const start = date;
    const finalDuration = duration === 'Custom' ? parseInt(customDuration) || 60 : duration;
    const end = new Date(start.getTime() + finalDuration * 60000);
    
    const payload = {
      contactId: contactToUse._id,
      calendarId: selectedCalendarId,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      locationType,
      customLocation,
      notes,
      duration: finalDuration,
      userId: user._id,
      locationId: user.locationId,
    };
    
    onSubmit(payload);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Modal Content */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <SafeAreaView style={styles.modalContent}>
            {/* Handle Bar */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Appointment</Text>
            </View>

            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Contact Search/Select */}
                {!preSelectedContact ? (
                  !selectedContact ? (
                    <View style={styles.section}>
                      <Text style={styles.label}>
                        Contact <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          search.length > 0 && !selectedContact ? styles.inputActive : null
                        ]}
                        placeholder="Search contact (name, email, phone)"
                        value={search}
                        onChangeText={(text) => {
                          setSearch(text);
                          setShowContactSearch(text.length > 1);
                        }}
                        placeholderTextColor={COLORS.textGray}
                      />
                      {showContactSearch && search.length > 1 && (
                        <View style={styles.contactList}>
                          <FlatList
                            data={filteredContacts}
                            keyExtractor={item => item._id}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={styles.contactOption}
                                onPress={() => handleContactSelect(item)}
                              >
                                <View style={styles.contactOptionContent}>
                                  <Text style={styles.contactOptionName}>
                                    {item.firstName} {item.lastName}
                                  </Text>
                                  <Text style={styles.contactOptionEmail}>
                                    {item.email}
                                  </Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                              </TouchableOpacity>
                            )}
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                          />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.section}>
                      <Text style={styles.label}>Contact</Text>
                      <TouchableOpacity
                        style={styles.selectedContact}
                        onPress={() => {
                          setSelectedContact(null);
                          setShowContactSearch(false);
                        }}
                      >
                        <View style={styles.contactInfo}>
                          <View style={styles.contactHeader}>
                            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                            <Text style={styles.selectedContactName}>
                              {selectedContact.firstName} {selectedContact.lastName}
                            </Text>
                          </View>
                          <Text style={styles.selectedContactEmail}>
                            {selectedContact.email}
                          </Text>
                        </View>
                        <Text style={styles.changeText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <View style={styles.section}>
                    <Text style={styles.label}>Contact</Text>
                    <View style={styles.preSelectedContact}>
                      <View style={styles.contactHeader}>
                        <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                        <Text style={styles.selectedContactName}>
                          {preSelectedContact.firstName} {preSelectedContact.lastName}
                        </Text>
                      </View>
                      <Text style={styles.selectedContactEmail}>
                        {preSelectedContact.email}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Calendar */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    Calendar <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdown,
                      selectedCalendarId ? styles.inputValid : null
                    ]}
                    onPress={() => setShowCalendarDropdown(!showCalendarDropdown)}
                  >
                    <Text style={[
                      styles.dropdownText,
                      !selectedCalendarId && styles.placeholderText
                    ]}>
                      {selectedCalendar?.name || 'Select Calendar'}
                    </Text>
                    <View style={styles.dropdownRight}>
                      {selectedCalendarId && (
                        <Ionicons name="checkmark-circle" size={16} color="#27AE60" style={{ marginRight: 8 }} />
                      )}
                      <Ionicons 
                        name={showCalendarDropdown ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={COLORS.textGray} 
                      />
                    </View>
                  </TouchableOpacity>
                  {showCalendarDropdown && (
                    <View style={styles.dropdownList}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {calendars?.map((item) => (
                          <TouchableOpacity
                            key={item.id || item.calendarId}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setSelectedCalendarId(item.id || item.calendarId);
                              setShowCalendarDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{item.name}</Text>
                            {(item.id === selectedCalendarId || item.calendarId === selectedCalendarId) && (
                              <Ionicons name="checkmark" size={16} color={COLORS.accent} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Title */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    Title <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      title.length > 0 ? styles.inputValid : null
                    ]}
                    placeholder="Appointment title"
                    value={title}
                    onChangeText={setTitle}
                    placeholderTextColor={COLORS.textGray}
                  />
                  {title.length > 0 && (
                    <View style={styles.inputValidation}>
                      <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                    </View>
                  )}
                </View>

                {/* Date & Time */}
                <View style={styles.section}>
                  <Text style={styles.label}>Date & Time *</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateTimeText}>
                      {date.toDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Duration */}
                <View style={styles.section}>
                  <Text style={styles.label}>Duration</Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => setShowDurationDropdown(!showDurationDropdown)}
                  >
                    <Text style={styles.dropdownText}>
                      {duration === 'Custom' ? `${customDuration || '60'} min` : `${duration} min`}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={COLORS.textGray} />
                  </TouchableOpacity>
                  {showDurationDropdown && (
                    <View style={styles.dropdownList}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {DURATION_OPTIONS.map((item) => (
                          <TouchableOpacity
                            key={item}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setDuration(item);
                              setShowDurationDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>
                              {item === 'Custom' ? 'Custom' : `${item} min`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {duration === 'Custom' && (
                    <TextInput
                      style={[styles.input, { marginTop: 8 }]}
                      value={customDuration}
                      onChangeText={setCustomDuration}
                      placeholder="Enter duration in minutes"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.textGray}
                    />
                  )}
                </View>

                {/* Location */}
                <View style={styles.section}>
                  <Text style={styles.label}>Location</Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                  >
                    <Text style={styles.dropdownText}>
                      {LOCATION_OPTIONS.find(opt => opt.value === locationType)?.label || 'Select Location Type'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={COLORS.textGray} />
                  </TouchableOpacity>
                  {showLocationDropdown && (
                    <View style={styles.dropdownList}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {LOCATION_OPTIONS.map((item) => (
                          <TouchableOpacity
                            key={item.value}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setLocationType(item.value);
                              setShowLocationDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{item.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
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
                <View style={styles.section}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Notes (optional)"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    placeholderTextColor={COLORS.textGray}
                    textAlignVertical="top"
                  />
                </View>

                {/* Bottom spacing for action bar */}
                <View style={{ height: 100 }} />
              </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Action Bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.saveButton,
                  (!selectedContact && !preSelectedContact) || !selectedCalendarId || !title 
                    ? styles.saveButtonDisabled 
                    : styles.saveButtonEnabled
                ]} 
                onPress={handleSubmit}
                disabled={(!selectedContact && !preSelectedContact) || !selectedCalendarId || !title}
              >
                <Text style={[
                  styles.saveButtonText,
                  (!selectedContact && !preSelectedContact) || !selectedCalendarId || !title 
                    ? styles.saveButtonTextDisabled 
                    : styles.saveButtonTextEnabled
                ]}>
                  Create Appointment
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

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
        </Animated.View>
      </PanGestureHandler>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalContent: {
    flex: 1,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textLight,
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
    marginTop: 4,
  },
  label: {
    fontSize: FONT.label,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  required: {
    color: '#E74C3C',
    fontSize: FONT.label,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    fontSize: FONT.input,
    color: COLORS.textDark,
    minHeight: 48,
    position: 'relative',
  },
  inputActive: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  inputValid: {
    borderColor: '#27AE60',
    borderWidth: 2,
  },
  inputValidation: {
    position: 'absolute',
    right: 12,
    top: 40,
  },
  placeholderText: {
    color: COLORS.textGray,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
    minHeight: 48,
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    flex: 1,
  },
  dropdownList: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    maxHeight: 200,
    ...SHADOW.card,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    flex: 1,
  },
  dateTimeText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  contactList: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    maxHeight: 200,
    ...SHADOW.card,
  },
  contactOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactOptionContent: {
    flex: 1,
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
  selectedContact: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#27AE60',
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedContactName: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginLeft: 8,
  },
  selectedContactEmail: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 28,
  },
  changeText: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },
  preSelectedContact: {
    backgroundColor: COLORS.accentMuted,
    borderRadius: RADIUS.input,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },

  // --- ACTION BAR STYLES ---
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.card,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textGray,
  },
  saveButton: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonEnabled: {
    backgroundColor: COLORS.accent,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  saveButtonText: {
    fontSize: FONT.input,
    fontWeight: '600',
  },
  saveButtonTextEnabled: {
    color: '#fff',
  },
  saveButtonTextDisabled: {
    color: COLORS.textLight,
  },
});