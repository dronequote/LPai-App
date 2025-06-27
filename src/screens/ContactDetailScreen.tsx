// src/screens/ContactDetailScreen.tsx
// Updated Date: 12/19/2024
// Added simple project creation modal matching QuoteBuilderScreen style

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { useContact, useUpdateContact, useDeleteContact } from '../hooks/useContacts';
import { useProjects } from '../hooks/useProjects';
import { useAppointments } from '../hooks/useAppointments';
import { projectService } from '../services/projectService';
import { appointmentService } from '../services/appointmentService';
import { contactService } from '../services/contactService';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import CompactAppointmentCard from '../components/CompactAppointmentCard';
import ProjectCard from '../components/ProjectCard';
import ConversationsList from '../components/ConversationsList';
import { COLORS, FONT, SHADOW, RADIUS } from '../styles/theme';
import type { Contact, Project, Appointment } from '../../packages/types/dist';


type ContactDetailRouteParams = {
  contact: Contact;
};

type TabType = 'overview' | 'details' | 'conversations' | 'notes';

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'person' },
  { id: 'details', label: 'Details', icon: 'information-circle' },
  { id: 'conversations', label: 'Conversations', icon: 'chatbubbles' },
  { id: 'notes', label: 'Notes', icon: 'document-text' },
];

export default function ContactDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { calendarMap } = useCalendar();
  
  const { contact: initialContact } = route.params as ContactDetailRouteParams;
  
  // Calculate appointment start date once to prevent infinite loop
  const appointmentStartDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0); // Set to start of today
    return date.toISOString();
  }, []);
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [editing, setEditing] = useState(false);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  
  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    firstName: initialContact.firstName || '',
    lastName: initialContact.lastName || '',
    email: initialContact.email || '',
    phone: initialContact.phone || '',
    secondaryPhone: initialContact.secondaryPhone || '',
    address: initialContact.address || '',
    city: initialContact.city || '',
    state: initialContact.state || '',
    postalCode: initialContact.postalCode || '',
    country: initialContact.country || '',
    companyName: initialContact.companyName || '',
    website: initialContact.website || '',
    notes: initialContact.notes || '',
    tags: initialContact.tags || [],
    source: initialContact.source || '',
  });
  
  // React Query hooks - Updated to use contactObjectId
  const { data: contact = initialContact, isLoading: contactLoading, refetch: refetchContact } = useContact(
    initialContact._id,
    initialContact // Pass initial data to prevent loading state
  );
  const { data: projectsRaw = [], isLoading: projectsLoading, refetch: refetchProjects } = useProjects(user?.locationId || '', {
    contactObjectId: contact._id,  // This should filter by contact
    limit: 100,  // Add limit to ensure we get all projects for this contact
  });
  const { data: appointmentsRaw = [], isLoading: appointmentsLoading } = useAppointments(user?.locationId || '', {
    contactObjectId: contact._id,  // Changed from contactId
    start: appointmentStartDate,
    limit: 10,
  });
  
  // Ensure projects have required fields with defaults and filter by contact
  const projects = useMemo(() => {
    if (!Array.isArray(projectsRaw)) {
      console.warn('[ContactDetailScreen] Projects data is not an array:', projectsRaw);
      return [];
    }
    
    // Double-check filtering by contact ID in case API doesn't filter properly
    return projectsRaw
      .filter(project => {
        if (!project || typeof project !== 'object' || !project._id) return false;
        // Ensure project belongs to this contact
        return project.contactId === contact._id || project.contactObjectId === contact._id;
      })
      .map((project: Project) => ({
        ...project,
        status: project.status || 'open',
        title: project.title || 'Untitled Project',
        _id: project._id,
      }));
  }, [projectsRaw, contact._id]);
  
  // Ensure appointments have required fields
  const appointments = useMemo(() => {
    if (!Array.isArray(appointmentsRaw)) {
      console.warn('[ContactDetailScreen] Appointments data is not an array:', appointmentsRaw);
      return [];
    }
    
    return appointmentsRaw.filter((apt: Appointment) => apt && typeof apt === 'object' && apt._id);
  }, [appointmentsRaw]);
  
  const updateContactMutation = useUpdateContact();
  const deleteContactMutation = useDeleteContact();
  
  // Get initials for avatar
  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase() || '?';
  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'No Name';
  
  // Upcoming appointments
  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter(apt => {
        const aptDate = new Date(apt.start || apt.time || apt.appointmentDate);
        return aptDate > new Date() && apt.status !== 'cancelled';
      })
      .sort((a, b) => {
        const aDate = new Date(a.start || a.time || a.appointmentDate);
        const bDate = new Date(b.start || b.time || b.appointmentDate);
        return aDate.getTime() - bDate.getTime();
      })
      .slice(0, 5);
  }, [appointments]);
  
  // Load notes
  const loadNotes = async () => {
    // For now, just parse notes from contact.notes
    // In the future, this could be a separate notes API
    const existingNotes = contact.notes ? [{
      id: '1',
      text: contact.notes,
      createdAt: contact.updatedAt || contact.createdAt,
      createdBy: 'System'
    }] : [];
    setNotes(existingNotes);
  };
  
  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'notes') {
      loadNotes();
    }
  }, [activeTab, contact._id]);
  
  // Handle save
  const handleSave = async () => {
    try {
      await updateContactMutation.mutateAsync({
        id: contact._id,
        data: formData,
      });
      setEditing(false);
      Alert.alert('Success', 'Contact updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update contact');
    }
  };
  
  // Handle delete
  const handleDelete = () => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContactMutation.mutateAsync(contact._id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete contact');
            }
          },
        },
      ]
    );
  };
  
  // Add note
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setAddingNote(true);
    try {
      // For now, append to existing notes
      const updatedNotes = contact.notes 
        ? `${contact.notes}\n\n[${new Date().toLocaleString()}] ${user?.name || 'User'}: ${newNote}`
        : `[${new Date().toLocaleString()}] ${user?.name || 'User'}: ${newNote}`;
      
      await updateContactMutation.mutateAsync({
        id: contact._id,
        data: { notes: updatedNotes },
      });
      
      setNewNote('');
      loadNotes();
      Alert.alert('Success', 'Note added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };
  
  // Quick actions
  const handleCall = (phoneNumber: string) => {
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };
  
  const handleText = (phoneNumber: string) => {
    const smsUrl = `sms:${phoneNumber}`;
    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('Error', 'Unable to send text message');
    });
  };
  
  const handleEmail = (emailAddress: string) => {
    const emailUrl = `mailto:${emailAddress}`;
    Linking.openURL(emailUrl).catch(() => {
      Alert.alert('Error', 'Unable to send email');
    });
  };
  
  // Pull to refresh
  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchContact(),
      refetchProjects(),
    ]);
  }, [refetchContact, refetchProjects]);
  
  // Navigation handlers for conversations
  const handleNavigateToProject = (projectId: string) => {
    navigation.navigate('ProjectDetailScreen', { projectId });
  };
  
  const handleNavigateToAppointment = (appointmentId: string) => {
    navigation.navigate('AppointmentDetail', { appointmentId });
  };
  
  // Handle create project
  const handleCreateProject = async () => {
    if (!projectName.trim() || !user?.locationId) return;
    
    setCreatingProject(true);
    try {
      const newProject = await projectService.create({
        title: projectName.trim(),
        contactId: contact._id,
        locationId: user.locationId,
        status: 'open',
        monetaryValue: 0,
      });
      
      console.log('[ContactDetailScreen] Created project:', newProject);
      
      // Reset modal
      setShowAddProject(false);
      setProjectName('');
      
      // Navigate to project detail
      navigation.navigate('ProjectDetailScreen', { project: newProject });
      
    } catch (error) {
      console.error('[ContactDetailScreen] Failed to create project:', error);
      Alert.alert('Error', 'Failed to create project. Please try again.');
    } finally {
      setCreatingProject(false);
    }
  };
  
  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.contactName}>{fullName}</Text>
          {contact.companyName && (
            <Text style={styles.companyName}>{contact.companyName}</Text>
          )}
          <View style={styles.tagsContainer}>
            {contact.source && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{contact.source}</Text>
              </View>
            )}
            {contact.tags?.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={() => setEditing(!editing)} style={styles.headerButton}>
          <Ionicons name={editing ? "close" : "pencil"} size={20} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          onPress={() => setActiveTab(tab.id)}
        >
          <Ionicons 
            name={tab.icon as any} 
            size={20} 
            color={activeTab === tab.id ? COLORS.accent : COLORS.textLight} 
          />
          <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  
  // Render overview tab
  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleCall(contact.phone)}
          >
            <Ionicons name="call" size={24} color={COLORS.accent} />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleText(contact.phone)}
          >
            <Ionicons name="chatbubble" size={24} color={COLORS.accent} />
            <Text style={styles.actionText}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleEmail(contact.email)}
          >
            <Ionicons name="mail" size={24} color={COLORS.accent} />
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => setActiveTab('conversations')}
          >
            <Ionicons name="chatbubbles" size={24} color={COLORS.accent} />
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Contact Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textGray} />
            <Text style={styles.infoText}>{contact.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={COLORS.textGray} />
            <Text style={styles.infoText}>{contact.phone}</Text>
          </View>
          {contact.secondaryPhone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={COLORS.textGray} />
              <Text style={styles.infoText}>{contact.secondaryPhone} (Secondary)</Text>
            </View>
          )}
          {contact.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={COLORS.textGray} />
              <Text style={styles.infoText}>
                {contact.address}
                {contact.city && `, ${contact.city}`}
                {contact.state && `, ${contact.state}`}
                {contact.postalCode && ` ${contact.postalCode}`}
              </Text>
            </View>
          )}
          {contact.website && (
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={20} color={COLORS.textGray} />
              <TouchableOpacity onPress={() => Linking.openURL(contact.website!)}>
                <Text style={[styles.infoText, styles.link]}>{contact.website}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      
      {/* Projects */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Projects ({projects.length})</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => {
              setProjectName('');
              setShowAddProject(true);
            }}
          >
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        </View>
        {projectsLoading ? (
          <ActivityIndicator color={COLORS.accent} />
        ) : projects.length === 0 ? (
          <Text style={styles.emptyText}>No projects yet</Text>
        ) : (
          projects.slice(0, 3).map((project) => {
            // Extra validation before rendering
            if (!project || !project._id) {
              console.warn('[ContactDetailScreen] Invalid project data:', project);
              return null;
            }
            
            return (
              <ProjectCard
                key={project._id}
                project={project}
                onPress={() => navigation.navigate('ProjectDetailScreen', { project })}
              />
            );
          })
        )}
        {projects.length > 3 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('ProjectsScreen', { contactObjectId: contact._id })}  // Changed from contactId
          >
            <Text style={styles.viewAllText}>View all projects</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.accent} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Appointments */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateAppointment(true)}>
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        </View>
        {appointmentsLoading ? (
          <ActivityIndicator color={COLORS.accent} />
        ) : upcomingAppointments.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming appointments</Text>
        ) : (
          upcomingAppointments.map((appointment) => (
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
    </ScrollView>
  );
  
  // Render details tab
  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        {/* First Name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>First Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              placeholder="First name"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.firstName || '-'}</Text>
          )}
        </View>
        
        {/* Last Name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Last Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              placeholder="Last name"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.lastName || '-'}</Text>
          )}
        </View>
        
        {/* Company */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Company</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.companyName}
              onChangeText={(text) => setFormData({ ...formData, companyName: text })}
              placeholder="Company name"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.companyName || '-'}</Text>
          )}
        </View>
        
        {/* Website */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Website</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.website}
              onChangeText={(text) => setFormData({ ...formData, website: text })}
              placeholder="Website URL"
              autoCapitalize="none"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.website || '-'}</Text>
          )}
        </View>
        
        {/* Source */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Source</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.source}
              onChangeText={(text) => setFormData({ ...formData, source: text })}
              placeholder="Lead source"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.source || '-'}</Text>
          )}
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Details</Text>
        
        {/* Email */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Email</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.email || '-'}</Text>
          )}
        </View>
        
        {/* Phone */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Phone</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.phone || '-'}</Text>
          )}
        </View>
        
        {/* Secondary Phone */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Secondary Phone</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.secondaryPhone}
              onChangeText={(text) => setFormData({ ...formData, secondaryPhone: text })}
              placeholder="Secondary phone"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.secondaryPhone || '-'}</Text>
          )}
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Address</Text>
        
        {/* Street Address */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Street Address</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              placeholder="Street address"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.address || '-'}</Text>
          )}
        </View>
        
        {/* City */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>City</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
              placeholder="City"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.city || '-'}</Text>
          )}
        </View>
        
        {/* State */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>State</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.state}
              onChangeText={(text) => setFormData({ ...formData, state: text })}
              placeholder="State"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.state || '-'}</Text>
          )}
        </View>
        
        {/* Postal Code */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Postal Code</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.postalCode}
              onChangeText={(text) => setFormData({ ...formData, postalCode: text })}
              placeholder="Postal code"
              keyboardType="numeric"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.postalCode || '-'}</Text>
          )}
        </View>
        
        {/* Country */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Country</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={formData.country}
              onChangeText={(text) => setFormData({ ...formData, country: text })}
              placeholder="Country"
            />
          ) : (
            <Text style={styles.fieldValue}>{contact.country || '-'}</Text>
          )}
        </View>
      </View>
      
      {editing && (
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={updateContactMutation.isPending}
        >
          {updateContactMutation.isPending ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
  
  // Render conversations tab
  const renderConversationsTab = () => (
    <ConversationsList
      contactObjectId={contact._id}  // Changed from contactId
      contactPhone={contact.phone}
      contactEmail={contact.email}
      locationId={user?.locationId || ''}
      userId={user?._id || ''}
      userName={user?.name}
      user={user} // Add this - passes the full user object with preferences
      onNavigateToProject={handleNavigateToProject}
      onNavigateToAppointment={handleNavigateToAppointment}
      onNavigateToSettings={() => {
        navigation.navigate('SettingsScreen', { initialTab: 'communication' });
      }} // Add this - navigates to Settings (Communication tab)
      style={styles.conversationsContainer}
    />
  );
  
  // Render notes tab
  const renderNotesTab = () => (
    <View style={styles.notesContainer}>
      <ScrollView style={styles.notesList} showsVerticalScrollIndicator={false}>
        {notes.length === 0 ? (
          <Text style={styles.noNotes}>No notes yet. Add your first note below.</Text>
        ) : (
          notes.map((note, index) => (
            <View key={note.id || index} style={styles.noteItem}>
              <Text style={styles.noteText}>{note.text || contact.notes}</Text>
              <Text style={styles.noteMetadata}>
                {note.createdBy || 'System'} • {new Date(note.createdAt || contact.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      
      <View style={styles.addNoteContainer}>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note..."
          value={newNote}
          onChangeText={setNewNote}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholderTextColor={COLORS.textLight}
        />
        <TouchableOpacity
          style={[styles.addNoteButton, (!newNote.trim() || addingNote) && styles.addNoteButtonDisabled]}
          onPress={handleAddNote}
          disabled={!newNote.trim() || addingNote}
        >
          {addingNote ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="add" size={20} color={COLORS.white} />
              <Text style={styles.addNoteButtonText}>Add Note</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Render project creation modal (bottom sheet style)
  const renderProjectModal = () => (
    <Modal
      visible={showAddProject}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setShowAddProject(false);
        setProjectName('');
      }}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={() => {
          setShowAddProject(false);
          setProjectName('');
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.bottomSheetContainer}
        >
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />
            
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Create New Project</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setShowAddProject(false);
                  setProjectName('');
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.textGray} />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <View style={styles.bottomSheetContent}>
              <TextInput
                style={styles.projectInput}
                placeholder="Enter project name (e.g., Kitchen Remodel)"
                placeholderTextColor={COLORS.textGray}
                value={projectName}
                onChangeText={setProjectName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateProject}
              />
              
              <TouchableOpacity
                style={[
                  styles.createProjectButton,
                  !projectName.trim() && styles.createProjectButtonDisabled
                ]}
                onPress={handleCreateProject}
                disabled={!projectName.trim() || creatingProject}
              >
                {creatingProject ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.createProjectButtonText}>Create Project</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
  
  // Render current tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'details':
        return renderDetailsTab();
      case 'conversations':
        return renderConversationsTab();
      case 'notes':
        return renderNotesTab();
      default:
        return null;
    }
  };
  
  if (contactLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading contact...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderTabs()}
      {renderTabContent()}
      
      {/* Modals */}
      <CreateAppointmentModal
        visible={showCreateAppointment}
        onClose={() => setShowCreateAppointment(false)}
        onSubmit={async (data) => {
          try {
            await appointmentService.create(data);
            setShowCreateAppointment(false);
            Alert.alert('Success', 'Appointment created');
          } catch (error) {
            Alert.alert('Error', 'Failed to create appointment');
          }
        }}
        contacts={[contact]}
        preSelectedContact={contact}
      />
      
      {/* Project Creation Modal */}
      {renderProjectModal()}
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
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOW.light,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 16,
    zIndex: 1,
    padding: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 40,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },
  headerInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 20,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: COLORS.lightAccent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginTop: 4,
  },
  tagText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.accent,
  },
  headerActions: {
    position: 'absolute',
    right: 20,
    top: 16,
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    marginLeft: 6,
  },
  tabTextActive: {
    fontFamily: FONT.semiBold,
    color: COLORS.accent,
  },
  tabContent: {
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.white,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: FONT.medium,
    marginLeft: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 70,
  },
  actionText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.accent,
    marginTop: 6,
  },
  infoCard: {
    marginTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoText: {
    fontSize: 15,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 12,
    flex: 1,
  },
  link: {
    color: COLORS.accent,
    textDecorationLine: 'underline',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: 20,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.accent,
    marginRight: 4,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textGray,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 20,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONT.semiBold,
  },
  
  // Conversations container style
  conversationsContainer: {
    flex: 1,
  },
  
  // Notes styles
  notesContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  notesList: {
    flex: 1,
    padding: 16,
  },
  noNotes: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontFamily: FONT.regular,
    fontSize: 16,
    marginTop: 50,
  },
  noteItem: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...SHADOW.light,
  },
  noteText: {
    fontSize: 15,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginBottom: 8,
    lineHeight: 22,
  },
  noteMetadata: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  addNoteContainer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    minHeight: 80,
    marginBottom: 12,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addNoteButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  addNoteButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONT.semiBold,
    marginLeft: 6,
  },
  
  // Bottom sheet modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Account for iPhone safe area
    ...SHADOW.large,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
  },
  projectInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  createProjectButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    marginBottom: 8,
    ...SHADOW.medium,
  },
  createProjectButtonDisabled: {
    backgroundColor: COLORS.textGray,
    ...SHADOW.none,
  },
  createProjectButtonText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
  },
  
  // Keep these for contact avatar in the main screen
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.accent,
  },
  contactDetails: {
    flex: 1,
  },
  contactDetailText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
});