// src/screens/ProjectDetailScreen.tsx
// Updated: 2025-06-16

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
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
// 📷🗂️ PHOTO & DOCUMENT IMPORTS - Uncomment when ready to use
// import * as ImagePicker from 'expo-image-picker';
// import * as DocumentPicker from 'expo-document-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import CompactAppointmentCard from '../components/CompactAppointmentCard';
import ProjectCard from '../components/ProjectCard';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import type { Project, Contact, Appointment } from '../../packages/types/dist';

type ProjectDetailRouteParams = {
  project: Project;
};

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}

interface ProjectPhoto {
  id: string;
  uri: string;
  caption?: string;
  timestamp: string;
}

interface ProjectDocument {
  id: string;
  name: string;
  uri: string;
  type: string;
  size: number;
  uploadDate: string;
}

const STATUS_OPTIONS = ['Open', 'Quoted', 'Scheduled', 'In Progress', 'Job Complete', 'Cancelled'];

export default function ProjectDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { calendarMap } = useCalendar();
  
  // FIX: Add null check for route params
  const params = route.params as ProjectDetailRouteParams;
  const initialProject = params?.project;

  // Add null check before rendering
  if (!initialProject || !initialProject._id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.textGray} />
          <Text style={styles.loadingText}>No project data available</Text>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={{ marginTop: 20 }}
          >
            <Text style={{ color: COLORS.accent, fontSize: FONT.input }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const [project, setProject] = useState<Project>(initialProject);
  const [contact, setContact] = useState<Contact | null>(null);
  const [otherProjects, setOtherProjects] = useState<Project[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Modal states
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [products, setProducts] = useState('');
  
  // Project management data
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [newMilestone, setNewMilestone] = useState('');

  // Fetch project details and related data
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        
        // 🔥 NEW: Fetch enhanced project data from API
        const enhancedProjectRes = await api.get(
          `/api/projects/${project._id}?locationId=${user?.locationId}`
        );
        
        const enhancedProject = enhancedProjectRes.data;
        
        // Set form fields from enhanced project
        setTitle(enhancedProject.title || '');
        setStatus(enhancedProject.status || '');
        setNotes(enhancedProject.notes || '');
        setScopeOfWork(enhancedProject.scopeOfWork || '');
        setProducts(enhancedProject.products || '');
        
        // Set enhanced data from API response
        setOtherProjects(enhancedProject.otherProjects || []);
        setAppointments(enhancedProject.upcomingAppointments || []);
        setMilestones(enhancedProject.milestones || []);
        setPhotos(enhancedProject.photos || []);
        setDocuments(enhancedProject.documents || []);
        
        // Handle contact - use full contact if available, otherwise create a minimal contact object
        if (enhancedProject.contact) {
          setContact(enhancedProject.contact);
        } else if (enhancedProject.contactId) {
          // Create a minimal contact object from project data
          const minimalContact: Contact = {
            _id: enhancedProject.contactId,
            firstName: enhancedProject.contactName?.split(' ')[0] || '',
            lastName: enhancedProject.contactName?.split(' ').slice(1).join(' ') || '',
            email: enhancedProject.contactEmail || '',
            phone: enhancedProject.contactPhone || '',
            locationId: user?.locationId || '',
          };
          setContact(minimalContact);
          
          // Try to fetch the full contact details
          try {
            const contactRes = await api.get(`/api/contacts/${enhancedProject.contactId}`, {
              params: { locationId: user?.locationId },
            });
            if (contactRes.data) {
              setContact(contactRes.data);
            }
          } catch (contactError) {
            console.log('Could not fetch full contact details, using project contact info');
          }
        }

        // Fetch all contacts for appointment modal
        try {
          const contactsRes = await api.get('/api/contacts', {
            params: { locationId: user?.locationId },
          });
          setAllContacts(contactsRes.data || []);
        } catch (contactError) {
          console.error('Failed to fetch contacts:', contactError);
          setAllContacts([]); // Set empty array on error
        }

      } catch (err) {
        console.error('Failed to fetch project data:', err);
        Alert.alert('Error', 'Failed to load project details');
      } finally {
        setLoading(false);
      }
    };

    if (project._id && user?.locationId) {
      fetchProjectData();
    }
  }, [project._id, user?.locationId]);

  const handleSave = async () => {
    if (!title) {
      Alert.alert('Error', 'Project title is required');
      return;
    }

    try {
      setSaving(true);
      
      // Update project with all fields
      const updatedProject = await api.patch(`/api/projects/${project._id}`, {
        title,
        status,
        notes,
        scopeOfWork,
        products,
        milestones,
        locationId: user?.locationId,
      });

      setProject(updatedProject.data);
      setEditing(false);
      Alert.alert('Success', 'Project updated successfully');
    } catch (err) {
      console.error('Failed to update project:', err);
      Alert.alert('Error', 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const handleContactPress = () => {
    if (contact) {
      navigation.navigate('ContactDetailScreen', { contact });
    }
  };

  const handleCreateAppointment = async (appointmentData: any) => {
    try {
      await api.post('/api/appointments', {
        ...appointmentData,
        contactId: contact?._id || project.contactId, // Use contact._id or fallback to project.contactId
        userId: user?._id,
        locationId: user?.locationId,
      });
      
      setShowCreateAppointment(false);
      
      // Refresh appointments
      const appointmentsRes = await api.get('/api/appointments', {
        params: { locationId: user?.locationId },
      });
      
      const projectAppointments = appointmentsRes.data?.filter(
        (apt: Appointment) => apt.contactId === contact?._id
      ) || [];
      
      setAppointments(projectAppointments);
    } catch (err) {
      console.error('Failed to create appointment:', err);
      Alert.alert('Error', 'Failed to create appointment');
    }
  };

  // 📷 PHOTO PICKER FUNCTION - Uncomment when ready to use
  const handlePickPhoto = () => {
    Alert.alert('Photo Feature', 'Photo upload will be available once expo-image-picker is set up!');
    
    /*
    const options = {
      title: 'Add Project Photo',
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };

    ImagePicker.launchImageLibraryAsync(options, (response) => {
      if (response.didCancel || response.error) {
        return;
      }

      const newPhoto: ProjectPhoto = {
        id: Date.now().toString(),
        uri: response.uri,
        timestamp: new Date().toISOString(),
      };
      setPhotos([...photos, newPhoto]);
    });
    */
  };

  // 🗂️ DOCUMENT PICKER FUNCTION - Uncomment when ready to use
  const handlePickDocument = async () => {
    Alert.alert('Document Feature', 'Document upload will be available once expo-document-picker is set up!');
    
    /*
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const newDoc: ProjectDocument = {
          id: Date.now().toString(),
          name: result.assets[0].name,
          uri: result.assets[0].uri,
          type: result.assets[0].mimeType || 'unknown',
          size: result.assets[0].size || 0,
          uploadDate: new Date().toISOString(),
        };
        setDocuments([...documents, newDoc]);
        Alert.alert('Success', 'Document uploaded successfully!');
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Error', 'Failed to upload document');
    }
    */
  };

  const handleMarkComplete = () => {
    Alert.alert(
      'Mark Project Complete',
      'Are you ready to mark this project as complete? This will:\n\n• Trigger completion checklist\n• Generate final invoice\n• Send completion notification',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark Complete', 
          style: 'default',
          onPress: () => {
            setStatus('Job Complete');
            setShowCompletionModal(true);
            Alert.alert('🎉 Project Completed!', 'Final invoice will be generated and sent to customer.');
          }
        }
      ]
    );
  };

  const handleCallContact = () => {
    if (contact?.phone) {
      Alert.alert(
        'Call Customer',
        `Call ${contact.firstName} ${contact.lastName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call', onPress: () => Linking.openURL(`tel:${contact.phone}`) }
        ]
      );
    }
  };

  const handleEmailContact = () => {
    if (contact?.email) {
      Linking.openURL(`mailto:${contact.email}?subject=Project Update: ${project.title}`);
    }
  };

  const handleTextContact = () => {
    if (contact?.phone) {
      Linking.openURL(`sms:${contact.phone}&body=Hi ${contact.firstName}, regarding your project: ${project.title}`);
    }
  };

  const addMilestone = () => {
    if (newMilestone.trim()) {
      const milestone: Milestone = {
        id: Date.now().toString(),
        title: newMilestone.trim(),
        completed: false,
      };
      setMilestones([...milestones, milestone]);
      setNewMilestone('');
    }
  };

  const toggleMilestone = (id: string) => {
    setMilestones(milestones.map(m => 
      m.id === id ? { ...m, completed: !m.completed } : m
    ));
  };

  const deleteMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  const deletePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  const deleteDocument = (id: string) => {
    setDocuments(documents.filter(d => d.id !== id));
  };

  const completedMilestones = milestones.filter(m => m.completed).length;
  const progressPercentage = milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading project details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Project Details</Text>
          <TouchableOpacity 
            onPress={() => setEditing(!editing)}
            style={styles.editButton}
          >
            <Ionicons 
              name={editing ? "checkmark" : "pencil"} 
              size={20} 
              color={editing ? "#27AE60" : COLORS.accent} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Project Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Information</Text>

            {/* Title */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Project Name</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Project title"
                />
              ) : (
                <Text style={styles.value}>{project.title}</Text>
              )}
            </View>

            {/* Customer */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Customer</Text>
              {contact ? (
                <TouchableOpacity onPress={handleContactPress} style={styles.customerCard}>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>
                      {contact.firstName} {contact.lastName}
                    </Text>
                    <Text style={styles.customerEmail}>{contact.email}</Text>
                    {contact.phone && (
                      <Text style={styles.customerPhone}>{contact.phone}</Text>
                    )}
                    {contact.address && (
                      <Text style={styles.customerAddress}>{contact.address}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
                </TouchableOpacity>
              ) : (
                <Text style={styles.value}>No customer linked</Text>
              )}
            </View>

            {/* Status */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Status</Text>
              {editing ? (
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity 
                    style={styles.dropdown}
                    onPress={() => setShowStatusDropdown(!showStatusDropdown)}
                  >
                    <Text style={styles.dropdownText}>{status}</Text>
                    <Ionicons name="chevron-down" size={20} color={COLORS.textGray} />
                  </TouchableOpacity>
                  
                  {showStatusDropdown && (
                    <View style={styles.dropdownOptions}>
                      <ScrollView style={styles.optionsScrollView}>
                        {STATUS_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={styles.dropdownOption}
                            onPress={() => {
                              setStatus(option);
                              setShowStatusDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownOptionText}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ) : (
                <Text 
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(project.status) }
                  ]}
                >
                  {project.status}
                </Text>
              )}
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Notes</Text>
              {editing ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Project notes..."
                  multiline
                />
              ) : (
                <Text style={styles.value}>{project.notes || 'No notes'}</Text>
              )}
            </View>

            {/* Scope of Work */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Scope of Work</Text>
              {editing ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={scopeOfWork}
                  onChangeText={setScopeOfWork}
                  placeholder="Describe the work to be done..."
                  multiline
                />
              ) : (
                <Text style={styles.value}>{project.scopeOfWork || 'Not specified'}</Text>
              )}
            </View>

            {/* Products */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Products</Text>
              {editing ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={products}
                  onChangeText={setProducts}
                  placeholder="List products/materials..."
                  multiline
                />
              ) : (
                <Text style={styles.value}>{project.products || 'Not specified'}</Text>
              )}
            </View>

            {/* Save Button */}
            {editing && (
              <TouchableOpacity 
                style={[styles.saveButton, saving && { opacity: 0.7 }]}
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

            {/* Dates */}
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </Text>
              {project.signedDate && (
                <Text style={styles.dateText}>
                  Signed: {new Date(project.signedDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>

          {/* Quick Actions */}
          {!editing && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionGrid}>
                <TouchableOpacity style={styles.actionButton} onPress={handleCallContact}>
                  <Ionicons name="call" size={24} color={COLORS.accent} />
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton} onPress={handleEmailContact}>
                  <Ionicons name="mail" size={24} color={COLORS.accent} />
                  <Text style={styles.actionText}>Email</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton} onPress={handleTextContact}>
                  <Ionicons name="chatbox" size={24} color={COLORS.accent} />
                  <Text style={styles.actionText}>Text</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton} onPress={() => setShowCreateAppointment(true)}>
                  <Ionicons name="calendar" size={24} color="#3498DB" />
                  <Text style={[styles.actionText, { color: '#3498DB' }]}>Schedule</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('QuoteBuilder', { project })}>
                  <Ionicons name="document-text" size={24} color="#9B59B6" />
                  <Text style={[styles.actionText, { color: '#9B59B6' }]}>Quote</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Invoice', 'Invoice generation coming soon!')}>
                  <Ionicons name="receipt" size={24} color="#F39C12" />
                  <Text style={[styles.actionText, { color: '#F39C12' }]}>Invoice</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Project Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Progress</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>
                  {completedMilestones} of {milestones.length} milestones completed
                </Text>
                <Text style={styles.progressPercentage}>{Math.round(progressPercentage)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${progressPercentage}%` }]} 
                />
              </View>
            </View>
          </View>

          {/* Milestones */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Milestones</Text>
            {milestones.map((milestone) => (
              <View key={milestone.id} style={styles.milestoneItem}>
                <TouchableOpacity
                  style={styles.milestoneCheckbox}
                  onPress={() => toggleMilestone(milestone.id)}
                >
                  <Ionicons
                    name={milestone.completed ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={milestone.completed ? "#27AE60" : COLORS.textGray}
                  />
                </TouchableOpacity>
                <Text style={[
                  styles.milestoneText,
                  milestone.completed && styles.milestoneCompleted
                ]}>
                  {milestone.title}
                </Text>
                {editing && (
                  <TouchableOpacity
                    onPress={() => deleteMilestone(milestone.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            {editing && (
              <View style={styles.addMilestoneRow}>
                <TextInput
                  style={styles.milestoneInput}
                  value={newMilestone}
                  onChangeText={setNewMilestone}
                  placeholder="Add a milestone..."
                  onSubmitEditing={addMilestone}
                />
                <TouchableOpacity
                  style={styles.addMilestoneButton}
                  onPress={addMilestone}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            
            {milestones.length === 0 && !editing && (
              <Text style={styles.emptyText}>No milestones added yet</Text>
            )}
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <TouchableOpacity style={styles.addButton} onPress={handlePickPhoto}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add Photo</Text>
              </TouchableOpacity>
            </View>
            {photos.length === 0 ? (
              <Text style={styles.emptyText}>No photos yet. Tap "Add Photo" to get started!</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {photos.map((photo) => (
                  <View key={photo.id} style={styles.photoContainer}>
                    <Image source={{ uri: photo.uri }} style={styles.projectPhoto} />
                    <TouchableOpacity 
                      style={styles.photoDeleteButton}
                      onPress={() => deletePhoto(photo.id)}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.photoDate}>
                      {new Date(photo.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Documents */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Documents</Text>
              <TouchableOpacity style={styles.addButton} onPress={handlePickDocument}>
                <Ionicons name="document" size={16} color="#fff" />
                <Text style={styles.addButtonText}>Add Doc</Text>
              </TouchableOpacity>
            </View>
            {documents.length === 0 ? (
              <Text style={styles.emptyText}>No documents uploaded</Text>
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={styles.documentItem}>
                  <Ionicons name="document-text" size={32} color={COLORS.accent} />
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>{doc.name}</Text>
                    <Text style={styles.documentMeta}>
                      {(doc.size / 1024).toFixed(1)} KB • {new Date(doc.uploadDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteDocument(doc.id)}
                    style={styles.documentDeleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Appointments */}
          {appointments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Appointments</Text>
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => setShowCreateAppointment(true)}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addButtonText}>Schedule</Text>
                </TouchableOpacity>
              </View>
              {appointments.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming appointments</Text>
              ) : (
                appointments.map((appointment) => (
                  <CompactAppointmentCard
                    key={appointment._id}
                    appointment={appointment}
                    contact={contact}
                    calendar={calendarMap[appointment.calendarId]}
                    onPress={() => navigation.navigate('AppointmentDetail', { 
                      appointmentId: appointment._id 
                    })}
                  />
                ))
              )}
            </View>
          )}

          {/* Other Projects - FIX: Update ProjectCard usage */}
          {contact && otherProjects.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Other Projects for {contact.firstName}</Text>
              {otherProjects.map((proj) => (
                <ProjectCard
                  key={proj._id}
                  project={proj}
                  onPress={() => navigation.navigate('ProjectDetailScreen', { project: proj })}
                />
              ))}
            </View>
          )}

          {/* Complete Project Button */}
          {project.status !== 'Job Complete' && project.status !== 'Cancelled' && !editing && (
            <View style={styles.section}>
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: '#27AE60' }]}
                onPress={handleMarkComplete}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={[styles.saveButtonText, { marginLeft: 8 }]}>
                  Mark Project Complete
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom padding */}
          <View style={{ height: 50 }} />
        </ScrollView>

        {/* Create Appointment Modal */}
        <CreateAppointmentModal
          visible={showCreateAppointment}
          onClose={() => setShowCreateAppointment(false)}
          onSubmit={handleCreateAppointment}
          contacts={allContacts || []} // Add fallback empty array
          preSelectedContact={contact}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Open': return COLORS.primary;
    case 'Quoted': return '#3498DB';
    case 'Scheduled': return '#9B59B6';
    case 'In Progress': return '#27AE60';
    case 'Job Complete': return '#2ECC71';
    case 'Cancelled': return '#E74C3C';
    default: return COLORS.textGray;
  }
};

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
    marginTop: 12,
    fontSize: FONT.input,
    color: COLORS.textGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  editButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusBadge: {
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    fontWeight: '600',
    fontSize: FONT.meta,
    alignSelf: 'flex-start',
  },
  customerCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.card,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 2,
  },
  customerAddress: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1001,
    ...SHADOW.card,
  },
  optionsScrollView: {
    maxHeight: 200,
  },
  dropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownOptionText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
  dateContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dateText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    alignItems: 'center',
    width: '30%',
    marginBottom: 12,
    ...SHADOW.card,
  },
  actionText: {
    fontSize: FONT.meta,
    fontWeight: '500',
    color: COLORS.accent,
    marginTop: 8,
  },
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    ...SHADOW.card,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  progressPercentage: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.accent,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.accentMuted,
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    marginBottom: 8,
    ...SHADOW.card,
  },
  milestoneCheckbox: {
    marginRight: 12,
  },
  milestoneText: {
    flex: 1,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  milestoneCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textGray,
  },
  deleteButton: {
    padding: 8,
  },
  addMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  milestoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    fontSize: FONT.input,
    color: COLORS.textDark,
    marginRight: 12,
  },
  addMilestoneButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: FONT.meta,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  photoScroll: {
    marginTop: 8,
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  projectPhoto: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.card,
  },
  photoDeleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  photoDate: {
    fontSize: FONT.meta - 2,
    color: COLORS.textGray,
    textAlign: 'center',
    marginTop: 4,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 8,
    ...SHADOW.card,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: FONT.input,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  documentMeta: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 2,
  },
  documentDeleteButton: {
    padding: 8,
  },
});