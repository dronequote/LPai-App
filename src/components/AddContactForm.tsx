import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;

interface AddressResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
  }) => void;
  isModal?: boolean; // New prop to control modal behavior
}

export default function AddContactForm({
  visible,
  onClose,
  onSubmit,
  isModal = false,
}: Props) {
  // Animation
  const [translateY] = useState(new Animated.Value(MODAL_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Address lookup state
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState<AddressResult[]>([]);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Form validation state
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Gesture handlers
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      
      if (translationY > 100 || velocityY > 500) {
        handleClose();
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const handleClose = () => {
    if (isModal) {
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
    } else {
      onClose();
    }
  };

  // Setup when modal opens (only for modal mode)
  useEffect(() => {
    if (visible && isModal) {
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setNotes('');
      setAddressSearch('');
      setAddressResults([]);
      setShowAddressSearch(false);
      setErrors({});
      setSubmitting(false);
      
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
    
    // For non-modal mode, just reset form when visible
    if (visible && !isModal) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setNotes('');
      setAddressSearch('');
      setAddressResults([]);
      setShowAddressSearch(false);
      setErrors({});
    }
  }, [visible, isModal]);

  // Address lookup with Google Places API (mock implementation)
  const searchAddresses = async (query: string) => {
    if (query.length < 3) {
      setAddressResults([]);
      return;
    }

    setLoadingAddresses(true);
    
    try {
      // Mock address results - replace with actual Google Places API call
      // const response = await fetch(
      //   `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`
      // );
      // const data = await response.json();
      
      // Mock data for demonstration
      const mockResults: AddressResult[] = [
        {
          place_id: '1',
          formatted_address: `${query} Main St, Anytown, ST 12345`,
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          address_components: []
        },
        {
          place_id: '2', 
          formatted_address: `${query} Oak Ave, Another City, ST 54321`,
          geometry: { location: { lat: 40.7580, lng: -73.9855 } },
          address_components: []
        },
        {
          place_id: '3',
          formatted_address: `${query} Elm Dr, Sample Town, ST 98765`,
          geometry: { location: { lat: 40.6892, lng: -74.0445 } },
          address_components: []
        }
      ];
      
      setAddressResults(mockResults);
    } catch (error) {
      console.error('Address search error:', error);
      setAddressResults([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Debounced address search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (addressSearch.length >= 3) {
        searchAddresses(addressSearch);
      } else {
        setAddressResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [addressSearch]);

  // Handle address selection
  const handleAddressSelect = (selectedAddress: AddressResult) => {
    setAddress(selectedAddress.formatted_address);
    setAddressSearch('');
    setAddressResults([]);
    setShowAddressSearch(false);
    
    // Clear address error if it was set
    if (errors.address) {
      setErrors(prev => ({ ...prev, address: '' }));
    }
  };

  // Form validation
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\d\s\-\(\)\+]+$/.test(phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSubmitting(true);
    
    const contactData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
    };
    
    try {
      await onSubmit(contactData);
    } catch (error) {
      console.error('Error submitting contact:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = () => {
    return firstName.trim() && lastName.trim() && email.trim() && phone.trim();
  };

  if (!visible) return null;

  // Render form content
  const renderFormContent = () => (
    <>
      {/* Handle Bar (only for modal mode) */}
      {isModal && (
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Add Contact</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Name Fields */}
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.label}>
                First Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  firstName.length > 0 ? styles.inputValid : null,
                  errors.firstName ? styles.inputError : null
                ]}
                value={firstName}
                onChangeText={(text) => {
                  setFirstName(text);
                  if (errors.firstName) {
                    setErrors(prev => ({ ...prev, firstName: '' }));
                  }
                }}
                placeholder="First name"
                placeholderTextColor={COLORS.textGray}
                autoCapitalize="words"
              />
              {firstName.length > 0 && !errors.firstName && (
                <View style={styles.inputValidation}>
                  <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                </View>
              )}
              {errors.firstName && (
                <Text style={styles.errorText}>{errors.firstName}</Text>
              )}
            </View>
            
            <View style={styles.nameField}>
              <Text style={styles.label}>
                Last Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  lastName.length > 0 ? styles.inputValid : null,
                  errors.lastName ? styles.inputError : null
                ]}
                value={lastName}
                onChangeText={(text) => {
                  setLastName(text);
                  if (errors.lastName) {
                    setErrors(prev => ({ ...prev, lastName: '' }));
                  }
                }}
                placeholder="Last name"
                placeholderTextColor={COLORS.textGray}
                autoCapitalize="words"
              />
              {lastName.length > 0 && !errors.lastName && (
                <View style={styles.inputValidation}>
                  <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                </View>
              )}
              {errors.lastName && (
                <Text style={styles.errorText}>{errors.lastName}</Text>
              )}
            </View>
          </View>

          {/* Email */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Email <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                email.length > 0 ? styles.inputValid : null,
                errors.email ? styles.inputError : null
              ]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) {
                  setErrors(prev => ({ ...prev, email: '' }));
                }
              }}
              placeholder="email@example.com"
              placeholderTextColor={COLORS.textGray}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {email.length > 0 && !errors.email && (
              <View style={styles.inputValidation}>
                <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
              </View>
            )}
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Phone */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Phone <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                phone.length > 0 ? styles.inputValid : null,
                errors.phone ? styles.inputError : null
              ]}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errors.phone) {
                  setErrors(prev => ({ ...prev, phone: '' }));
                }
              }}
              placeholder="(555) 123-4567"
              placeholderTextColor={COLORS.textGray}
              keyboardType="phone-pad"
            />
            {phone.length > 0 && !errors.phone && (
              <View style={styles.inputValidation}>
                <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
              </View>
            )}
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
          </View>

          {/* Address with Lookup */}
          <View style={styles.section}>
            <Text style={styles.label}>Address</Text>
            {!address ? (
              <View>
                <TextInput
                  style={[
                    styles.input,
                    addressSearch.length > 0 ? styles.inputActive : null
                  ]}
                  placeholder="Search for address..."
                  value={addressSearch}
                  onChangeText={(text) => {
                    setAddressSearch(text);
                    setShowAddressSearch(text.length >= 3);
                  }}
                  placeholderTextColor={COLORS.textGray}
                />
                {showAddressSearch && addressResults.length > 0 && (
                  <View style={styles.addressList}>
                    <FlatList
                      data={addressResults}
                      keyExtractor={(item) => item.place_id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.addressOption}
                          onPress={() => handleAddressSelect(item)}
                        >
                          <Ionicons name="location-outline" size={20} color={COLORS.accent} />
                          <Text style={styles.addressOptionText} numberOfLines={2}>
                            {item.formatted_address}
                          </Text>
                        </TouchableOpacity>
                      )}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                    />
                  </View>
                )}
                {showAddressSearch && loadingAddresses && (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Searching addresses...</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.manualAddressButton}
                  onPress={() => {
                    setShowAddressSearch(false);
                    setAddressSearch('Manual entry');
                    setAddress('');
                  }}
                >
                  <Ionicons name="pencil-outline" size={16} color={COLORS.accent} />
                  <Text style={styles.manualAddressText}>Enter address manually</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  style={styles.selectedAddress}
                  onPress={() => {
                    setAddress('');
                    setAddressSearch('');
                    setShowAddressSearch(false);
                  }}
                >
                  <View style={styles.addressInfo}>
                    <View style={styles.addressHeader}>
                      <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                      <Text style={styles.selectedAddressText} numberOfLines={2}>
                        {address}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Manual address input when needed */}
            {addressSearch === 'Manual entry' && !address && (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={address}
                onChangeText={setAddress}
                placeholder="123 Main St, City, State 12345"
                placeholderTextColor={COLORS.textGray}
                autoCapitalize="words"
              />
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Optional notes about this contact..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textGray}
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
            !isFormValid() ? styles.saveButtonDisabled : styles.saveButtonEnabled
          ]} 
          onPress={handleSubmit}
          disabled={!isFormValid() || submitting}
        >
          <Text style={[
            styles.saveButtonText,
            !isFormValid() ? styles.saveButtonTextDisabled : styles.saveButtonTextEnabled
          ]}>
            {submitting ? 'Creating...' : 'Create Contact'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Return modal version or content only version
  if (isModal) {
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
              {renderFormContent()}
            </SafeAreaView>
          </Animated.View>
        </PanGestureHandler>
      </Modal>
    );
  } else {
    // Return just the content for use in existing modals
    return (
      <View style={styles.contentOnly}>
        {renderFormContent()}
      </View>
    );
  }
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
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  nameField: {
    flex: 1,
    marginRight: 8,
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
  inputError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
  },
  inputValidation: {
    position: 'absolute',
    right: 12,
    top: 40,
  },
  errorText: {
    fontSize: FONT.meta,
    color: '#E74C3C',
    marginTop: 4,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    fontSize: FONT.input,
    color: COLORS.textDark,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Address lookup styles
  addressList: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    maxHeight: 200,
    ...SHADOW.card,
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addressOptionText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    flex: 1,
    marginLeft: 12,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    fontStyle: 'italic',
  },
  manualAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accentMuted,
    borderRadius: RADIUS.input,
    marginTop: 8,
  },
  manualAddressText: {
    marginLeft: 8,
    fontSize: FONT.input,
    color: COLORS.accent,
    fontWeight: '500',
  },
  selectedAddress: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#27AE60',
  },
  addressInfo: {
    flex: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectedAddressText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  changeText: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },

  // Action bar styles
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

  // Content-only mode (for use in existing modals)
  contentOnly: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});