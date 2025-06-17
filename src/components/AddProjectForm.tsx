// src/components/AddProjectForm.tsx
// Updated: 2025-01-06
// Fixed contacts filter error and added service integration

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { contactService } from '../services/contactService';
import { locationService } from '../services/locationService';
import { COLORS, FONT, RADIUS, SHADOW, INPUT } from '../styles/theme';
import type { Contact, Pipeline } from '../../packages/types/dist';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (projectData: any) => Promise<void>;
  contacts?: Contact[]; // Accept contacts as prop
  preSelectedContact?: Contact;
  isModal?: boolean;
}

export default function AddProjectForm({
  visible,
  onClose,
  onSubmit,
  contacts: propContacts, // Rename to avoid conflict
  preSelectedContact,
  isModal = false,
}: Props) {
  const { user } = useAuth();
  const locationId = user?.locationId;

  // Animation states for modal
  const [translateY] = useState(new Animated.Value(MODAL_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Form states
  const [contacts, setContacts] = useState<Contact[]>(propContacts || []);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactSearch, setShowContactSearch] = useState(false);
  
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [status, setStatus] = useState('open');
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedPipelineName, setSelectedPipelineName] = useState('');
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Handle add contact press
  const onAddContactPress = () => {
    // Navigate to add contact screen or show modal
    console.log('Add new contact pressed');
  };

  // Gesture event handlers for modal
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

  // Setup when modal opens
  useEffect(() => {
    if (visible && isModal) {
      // Reset form
      setContactSearch('');
      setTitle('');
      setNotes('');
      setScopeOfWork('');
      setShowContactSearch(false);
      setSubmitting(false);
      
      // Set defaults
      if (preSelectedContact) {
        setSelectedContact(preSelectedContact);
      } else {
        setSelectedContact(null);
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
      
      // Load data
      loadContacts();
      loadPipelines();
    }
    
    // For non-modal mode, just load data when visible
    if (visible && !isModal) {
      loadContacts();
      loadPipelines();
      
      // Set defaults
      if (preSelectedContact) {
        setSelectedContact(preSelectedContact);
      }
    }
  }, [visible, preSelectedContact, isModal]);

  // Update contacts when prop changes
  useEffect(() => {
    if (propContacts && propContacts.length > 0) {
      setContacts(propContacts);
    }
  }, [propContacts]);

  // Load contacts using service
  const loadContacts = async () => {
    // If contacts were passed as props, use them
    if (propContacts && propContacts.length > 0) {
      setContacts(propContacts);
      return;
    }
    
    // Otherwise load from API
    if (!locationId) return;
    try {
      const contactsData = await contactService.list(locationId, { limit: 100 });
      setContacts(Array.isArray(contactsData) ? contactsData : []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      setContacts([]);
    }
  };

  // Load pipelines using service
  const loadPipelines = async () => {
    if (!locationId) return;
    try {
      const pipelinesData = await locationService.getPipelines(locationId);
      const pipelines = Array.isArray(pipelinesData) ? pipelinesData : [];
      setPipelines(pipelines);
      
      // Auto-select first pipeline
      if (pipelines.length > 0) {
        setSelectedPipelineId(pipelines[0].id);
        setSelectedPipelineName(pipelines[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch pipelines:', err);
      setPipelines([]);
    }
  };

  // Filter contacts - FIXED with safety check
  useEffect(() => {
    // Ensure contacts is an array before filtering
    if (!Array.isArray(contacts)) {
      setFilteredContacts([]);
      return;
    }
    
    const q = contactSearch.toLowerCase();
    const matches = contacts.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
    setFilteredContacts(matches);
  }, [contactSearch, contacts]);

  // Handle contact selection
  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setContactSearch('');
    setShowContactSearch(false);
  };

  // Handle pipeline selection
  const handlePipelineChange = (pipeline: Pipeline) => {
    setSelectedPipelineId(pipeline.id);
    setSelectedPipelineName(pipeline.name);
    setShowPipelineDropdown(false);
  };

  // Form validation
  const isFormValid = () => {
    const contactToUse = preSelectedContact || selectedContact;
    return contactToUse && title.trim() && selectedPipelineId;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!isFormValid() || !user || !locationId) return;
    
    setSubmitting(true);
    const contactToUse = preSelectedContact || selectedContact;
    const fullTitle = `${contactToUse.firstName} ${contactToUse.lastName} – ${title}`;
    
    const projectData = {
      contactId: contactToUse._id,
      userId: user.userId,
      locationId,
      title: fullTitle,
      status,
      notes,
      pipelineId: selectedPipelineId,
      pipelineName: selectedPipelineName,
      scopeOfWork,
    };
    
    try {
      await onSubmit(projectData);
    } catch (error) {
      console.error('Error submitting project:', error);
    } finally {
      setSubmitting(false);
    }
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
        <Text style={styles.title}>Add Project</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Contact Selection */}
          {!preSelectedContact ? (
            !selectedContact ? (
              <View style={styles.section}>
                <Text style={styles.label}>
                  Contact <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    contactSearch.length > 0 ? styles.inputActive : null
                  ]}
                  placeholder="Search by name, phone, or email"
                  value={contactSearch}
                  onChangeText={(text) => {
                    setContactSearch(text);
                    setShowContactSearch(text.length > 1);
                  }}
                  placeholderTextColor={COLORS.textGray}
                />
                {showContactSearch && filteredContacts.length > 0 && (
                  <View style={styles.contactList}>
                    <FlatList
                      data={filteredContacts}
                      keyExtractor={(item) => item._id}
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
                {showContactSearch && filteredContacts.length === 0 && contactSearch.length > 1 && (
                  <TouchableOpacity style={styles.addNewContact} onPress={onAddContactPress}>
                    <Ionicons name="person-add-outline" size={20} color={COLORS.accent} />
                    <Text style={styles.addNewContactText}>Add New Contact</Text>
                  </TouchableOpacity>
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

          {/* Pipeline Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Pipeline <Text style={styles.required}>*</Text>
            </Text>
            {pipelines.length > 0 ? (
              <TouchableOpacity
                style={[
                  styles.dropdown,
                  selectedPipelineId ? styles.inputValid : null,
                  showPipelineDropdown ? styles.inputActive : null
                ]}
                onPress={() => setShowPipelineDropdown(!showPipelineDropdown)}
              >
                <View style={styles.dropdownRight}>
                  <Text style={styles.dropdownText}>
                    {selectedPipelineName || 'Select Pipeline'}
                  </Text>
                  <Ionicons 
                    name={showPipelineDropdown ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color={COLORS.textGray} 
                  />
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noPipelinesText}>
                No pipelines available. Please sync from GoHighLevel.
              </Text>
            )}
            
            {showPipelineDropdown && pipelines.length > 0 && (
              <View style={styles.dropdownList}>
                {pipelines.map((pipeline) => (
                  <TouchableOpacity
                    key={pipeline.id}
                    style={styles.dropdownOption}
                    onPress={() => handlePipelineChange(pipeline)}
                  >
                    <Text style={styles.dropdownOptionText}>{pipeline.name}</Text>
                    {selectedPipelineId === pipeline.id && (
                      <Ionicons name="checkmark" size={20} color={COLORS.accent} />
                    )}
                  </TouchableOpacity>
                ))}
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
                title.trim() ? styles.inputValid : null
              ]}
              placeholder="Project title (e.g., Kitchen Remodel)"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={COLORS.textGray}
            />
          </View>

          {/* Scope of Work */}
          <View style={styles.section}>
            <Text style={styles.label}>Scope of Work</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the work to be done..."
              value={scopeOfWork}
              onChangeText={setScopeOfWork}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textGray}
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Additional notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textGray}
            />
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={isModal ? handleClose : onClose}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.submitButton,
            (!isFormValid() || submitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Create Project</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  // For modal mode
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
  }

  // For non-modal mode
  return (
    <SafeAreaView style={styles.nonModalContainer}>
      {renderFormContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Modal styles
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
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    ...SHADOW.large,
  },
  modalContent: {
    flex: 1,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  
  // Non-modal container
  nonModalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  
  // Common styles
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  
  // Contact styles
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
    flexDirection: 'row',
    alignItems: 'center',
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
  addNewContact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.accentMuted,
    borderRadius: RADIUS.input,
    marginTop: 8,
  },
  addNewContactText: {
    marginLeft: 8,
    fontSize: FONT.input,
    color: COLORS.accent,
    fontWeight: '500',
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
  
  // Dropdown styles
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
    flex: 1,
    justifyContent: 'space-between',
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
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownOptionText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  noPipelinesText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  
  // Footer styles
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.input,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    marginLeft: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: FONT.button,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  submitButtonText: {
    fontSize: FONT.button,
    fontWeight: '600',
    color: COLORS.white,
  },
});