import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Contact, Pipeline } from '../../packages/types/dist';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onAddContactPress: () => void;
  preSelectedContact?: Contact;
  isModal?: boolean; // New prop to control modal behavior
}

export default function AddProjectForm({
  visible,
  onClose,
  onSubmit,
  onAddContactPress,
  preSelectedContact,
  isModal = false, // Default to false for backward compatibility
}: Props) {
  const { user } = useAuth();
  const locationId = user?.locationId;

  // Animation
  const [translateY] = useState(new Animated.Value(MODAL_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Form state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactSearch, setShowContactSearch] = useState(false);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedPipelineName, setSelectedPipelineName] = useState('');
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Open');
  const [notes, setNotes] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // Setup when modal opens (only for modal mode)
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

  // Load contacts
  const loadContacts = async () => {
    if (!locationId) return;
    try {
      const res = await api.get('/api/contacts', {
        params: { locationId },
      });
      setContacts(res.data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  };

  // Load pipelines
  const loadPipelines = async () => {
    if (!locationId) return;
    try {
      const locRes = await api.get('/api/locations/byLocation', {
        params: { locationId },
      });
      const mongoPipes = locRes.data?.pipelines || [];
      setPipelines(mongoPipes);
      
      // Auto-select first pipeline
      if (mongoPipes.length) {
        setSelectedPipelineId(mongoPipes[0].id);
        setSelectedPipelineName(mongoPipes[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch pipelines:', err);
      setPipelines([]);
    }
  };

  // Filter contacts
  useEffect(() => {
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
                  selectedPipelineId ? styles.inputValid : null
                ]}
                onPress={() => setShowPipelineDropdown(!showPipelineDropdown)}
              >
                <Text style={[
                  styles.dropdownText,
                  !selectedPipelineId && styles.placeholderText
                ]}>
                  {selectedPipelineName || 'Select Pipeline'}
                </Text>
                <View style={styles.dropdownRight}>
                  {selectedPipelineId && (
                    <Ionicons name="checkmark-circle" size={16} color="#27AE60" style={{ marginRight: 8 }} />
                  )}
                  <Ionicons 
                    name={showPipelineDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={COLORS.textGray} 
                  />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.noPipelinesContainer}>
                <Text style={styles.noPipelinesText}>No pipelines found</Text>
              </View>
            )}
            {showPipelineDropdown && pipelines.length > 0 && (
              <View style={styles.dropdownList}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {pipelines.map((pipeline) => (
                    <TouchableOpacity
                      key={pipeline.id}
                      style={styles.dropdownItem}
                      onPress={() => handlePipelineChange(pipeline)}
                    >
                      <Text style={styles.dropdownItemText}>{pipeline.name}</Text>
                      {pipeline.id === selectedPipelineId && (
                        <Ionicons name="checkmark" size={16} color={COLORS.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Project Title */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Project Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                title.length > 0 ? styles.inputValid : null
              ]}
              placeholder="Kitchen remodel, bathroom renovation, etc."
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

          {/* Scope of Work */}
          <View style={styles.section}>
            <Text style={styles.label}>Scope of Work</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the scope of work"
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
              style={styles.textArea}
              placeholder="Optional notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
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
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
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
            {submitting ? 'Creating...' : 'Create Project'}
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
        onRequestClose={onClose}
      >
        {/* Overlay */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
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
  placeholderText: {
    color: COLORS.textGray,
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
  noPipelinesContainer: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  noPipelinesText: {
    fontSize: FONT.input,
    color: COLORS.textLight,
    fontStyle: 'italic',
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