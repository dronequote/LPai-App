// src/screens/ContactDetailScreen.tsx
// Updated Date: 06/27/2025
// Added sexy user dropdown and conditional logging
// FIXED: Now handles both { contact } and { contactId } navigation params

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
  Keyboard,
  Dimensions,
  Animated,
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
import { noteService } from '../services/noteService';
import { userService } from '../services/userService';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import CompactAppointmentCard from '../components/CompactAppointmentCard';
import ProjectCard from '../components/ProjectCard';
import ConversationsList from '../components/ConversationsList';
import { COLORS, FONT, SHADOW, RADIUS } from '../styles/theme';
import type { Contact, Project, Appointment } from '../../packages/types/dist';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

type ContactDetailRouteParams = {
  contact?: Contact;
  contactId?: string;
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
  
  // Handle both contact object and contactId params
  const params = route.params as ContactDetailRouteParams;
  const hasContactObject = params?.contact;
  const contactIdParam = params?.contactId;
  
  // Get initial contact data and ID
  const initialContactFromRoute = hasContactObject ? params.contact : null;
  const contactIdToUse = hasContactObject ? params.contact._id : contactIdParam;
  
  // State for contact data
  const [contactData, setContactData] = useState(initialContactFromRoute);
  
  // Fetch contact if we only have ID
  const { 
    data: fetchedContact, 
    isLoading: fetchingContact, 
    refetch: refetchContact 
  } = useContact(
    !hasContactObject && contactIdToUse ? contactIdToUse : null,
    !hasContactObject
  );
  
  // Use either the passed contact or the fetched one
  const contact = contactData || fetchedContact;
  
  // Update contactData when fetched
  useEffect(() => {
    if (fetchedContact && !contactData) {
      setContactData(fetchedContact);
    }
  }, [fetchedContact]);
  
  // Show loading only if we're fetching
  if (!contact && fetchingContact) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading contact...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Show error if no contact found
  if (!contact) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.textGray} />
          <Text style={styles.errorText}>Contact not found</Text>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [refreshingNotes, setRefreshingNotes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // Animation for dropdown
  const dropdownAnimation = useState(new Animated.Value(0))[0];
  
  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  
  // Form fields - initialize with contact data
  const [formData, setFormData] = useState({
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    secondaryPhone: contact.secondaryPhone || '',
    address: contact.address || '',
    city: contact.city || '',
    state: contact.state || '',
    postalCode: contact.postalCode || '',
    country: contact.country || '',
    companyName: contact.companyName || '',
    website: contact.website || '',
    notes: contact.notes || '',
    tags: contact.tags || [],
    source: contact.source || '',
    assignedUserId: contact.assignedUserId || '',
  });
  
  // Update form data when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        secondaryPhone: contact.secondaryPhone || '',
        address: contact.address || '',
        city: contact.city || '',
        state: contact.state || '',
        postalCode: contact.postalCode || '',
        country: contact.country || '',
        companyName: contact.companyName || '',
        website: contact.website || '',
        notes: contact.notes || '',
        tags: contact.tags || [],
        source: contact.source || '',
        assignedUserId: contact.assignedUserId || '',
      });
    }
  }, [contact]);
  
  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);
  
  // React Query hooks - Updated to use contactObjectId
  const { data: projectsRaw = [], isLoading: projectsLoading, refetch: refetchProjects } = useProjects(user?.locationId || '', {
    contactObjectId: contact._id,  // This should filter by contact
    limit: 100,  // Add limit to ensure we get all projects for this contact
  });
  const { data: appointmentsRaw = [], isLoading: appointmentsLoading, refetch: refetchAppointments } = useAppointments(user?.locationId || '', {
    contactObjectId: contact._id,  // Changed from contactId
    start: appointmentStartDate,
    limit: 10,
  });
  
  // Fetch users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      if (__DEV__) {
        console.log('[ContactDetail] Fetching users for location:', user?.locationId);
      }
      
      if (user?.locationId && user?.role === 'admin') {
        try {
          // Clear cache first to ensure fresh data
          await userService.clearCache();
          
          const usersList = await userService.list(user.locationId);
          
          if (__DEV__) {
            console.log('[ContactDetail] Fetched users:', usersList?.length || 0);
          }
          
          setUsers(usersList || []);
        } catch (error) {
          if (__DEV__) {
            console.error('[ContactDetail] Error fetching users:', error);
          }
        }
      }
    };
    
    fetchUsers();
  }, [user?.locationId, user?.role]);
  
  // Ensure projects have required fields with defaults and filter by contact
  const projects = useMemo(() => {
    if (!Array.isArray(projectsRaw)) {
      if (__DEV__) {
        console.warn('[ContactDetailScreen] Projects data is not an array:', projectsRaw);
      }
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
      if (__DEV__) {
        console.warn('[ContactDetailScreen] Appointments data is not an array:', appointmentsRaw);
      }
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
  
  // Load notes from GHL API
  const loadNotes = async (forceRefresh = false) => {
    if (!contact?._id || !user?.locationId) return;
    
    setNotesLoading(true);
    try {
      // If force refresh, clear cache first
      if (forceRefresh) {
        await noteService.clearCache(`/api/contacts/${contact._id}/notes`);
      }
      
      const fetchedNotes = await noteService.getContactNotes(
        contact._id,
        user.locationId
      );
      
      if (fetchedNotes && fetchedNotes.length > 0) {
        setNotes(fetchedNotes);
      } else {
        // Fallback to existing notes if no API notes
        const existingNotes = contact.notes ? [{
          id: '1',
          text: contact.notes,
          body: contact.notes,
          createdAt: contact.updatedAt || contact.createdAt,
          createdBy: 'System'
        }] : [];
        setNotes(existingNotes);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[ContactDetail] Error loading notes:', error);
      }
      // Fallback to existing notes on error
      const existingNotes = contact.notes ? [{
        id: '1',
        text: contact.notes,
        body: contact.notes,
        createdAt: contact.updatedAt || contact.createdAt,
        createdBy: 'System'
      }] : [];
      setNotes(existingNotes);
    } finally {
      setNotesLoading(false);
    }
  };
  
  // Load notes when tab changes to notes
  useEffect(() => {
    if (activeTab === 'notes' && contact._id) {
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
  // Add note using GHL API
  const handleAddNote = async () => {
    if (!newNote.trim() || !user?.locationId) return;
    
    setAddingNote(true);
    try {
      const createdNote = await noteService.createNote(
        contact._id,
        user.locationId,
        {
          text: newNote.trim(),
          userId: user.ghlUserId || user._id,
        }
      );
      
      if (createdNote) {
        setNewNote('');
        await loadNotes(true); // Force refresh after creating note
        Alert.alert('Success', 'Note added successfully');
      } else {
        throw new Error('Failed to create note');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[ContactDetail] Error adding note:', error);
      }
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
  
  // Pull to refresh with cache clearing
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Clear caches before refetching
      await contactService.clearCache();
      await projectService.clearCache();
      await appointmentService.clearCache();
      
      // Refetch data
      await Promise.all([
        refetchContact(),
        refetchProjects(),
        refetchAppointments(),
        activeTab === 'notes' ? loadNotes(true) : Promise.resolve(),
      ]);
    } catch (error) {
      if (__DEV__) {
        console.error('[ContactDetail] Error refreshing:', error);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refetchContact, refetchProjects, refetchAppointments, activeTab]);
  
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
      
      if (__DEV__) {
        console.log('[ContactDetailScreen] Created project:', newProject);
      }
      
      // Reset modal
      setShowAddProject(false);
      setProjectName('');
      
      // Navigate to project detail
      navigation.navigate('ProjectDetailScreen', { project: newProject });
      
    } catch (error) {
      if (__DEV__) {
        console.error('[ContactDetailScreen] Failed to create project:', error);
      }
      Alert.alert('Error', 'Failed to create project. Please try again.');
    } finally {
      setCreatingProject(false);
    }
  };
  
  // Toggle dropdown animation
  const toggleUserDropdown = () => {
    if (showUserDropdown) {
      // Close
      Animated.timing(dropdownAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowUserDropdown(false));
    } else {
      // Open
      setShowUserDropdown(true);
      Animated.timing(dropdownAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
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
  
  // Render user dropdown modal
  const renderUserDropdown = () => (
    <Modal
      visible={showUserDropdown}
      transparent={true}
      animationType="fade"
      onRequestClose={() => toggleUserDropdown()}
    >
      <TouchableOpacity 
        style={styles.dropdownOverlay} 
        activeOpacity={1} 
        onPress={() => toggleUserDropdown()}
      >
        <Animated.View 
          style={[
            styles.dropdownContainer,
            {
              opacity: dropdownAnimation,
              transform: [{
                translateY: dropdownAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0]
                })
              }]
            }
          ]}
        >
          <View style={styles.dropdownContent}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Assign Contact To</Text>
              <Text style={styles.dropdownSubtitle}>{users.length} team members</Text>
            </View>
            
            <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
              {/* Unassigned option */}
              <TouchableOpacity
                style={[
                  styles.dropdownItem,
                  !formData.assignedUserId && styles.dropdownItemSelected
                ]}
                onPress={() => {
                  setFormData({ ...formData, assignedUserId: '' });
                  toggleUserDropdown();
                }}
              >
                <View style={styles.dropdownItemLeft}>
                  <View style={styles.userAvatar}>
                    <Ionicons name="person-outline" size={20} color={COLORS.textGray} />
                  </View>
                  <View>
                    <Text style={styles.dropdownItemName}>Unassigned</Text>
                    <Text style={styles.dropdownItemEmail}>No one is assigned</Text>
                  </View>
                </View>
                {!formData.assignedUserId && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
                )}
              </TouchableOpacity>
              
              {/* User list */}
              {users.map((user) => (
                <TouchableOpacity
                  key={user._id}
                  style={[
                    styles.dropdownItem,
                    formData.assignedUserId === user._id && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, assignedUserId: user._id });
                    toggleUserDropdown();
                  }}
                >
                  <View style={styles.dropdownItemLeft}>
                    <View style={[styles.userAvatar, user.role === 'admin' && styles.userAvatarAdmin]}>
                      <Text style={styles.userAvatarText}>
                        {(user.name || user.email || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.dropdownItemName}>{user.name || user.email}</Text>
                      <View style={styles.dropdownItemMeta}>
                        <Text style={styles.dropdownItemEmail}>{user.email}</Text>
                        {user.role && (
                          <View style={[styles.roleBadge, user.role === 'admin' && styles.roleBadgeAdmin]}>
                            <Text style={styles.roleBadgeText}>{user.role}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  {formData.assignedUserId === user._id && (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
  
  // Render overview tab
  const renderOverviewTab = () => (
    <ScrollView 
      style={styles.tabContent} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.accent]}
          tintColor={COLORS.accent}
        />
      }
    >
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
              if (__DEV__) {
                console.warn('[ContactDetailScreen] Invalid project data:', project);
              }
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
            onPress={() => navigation.navigate('ProjectsScreen', { contactObjectId: contact._id })}
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
  
  // Render details tab with keyboard handling
  const renderDetailsTab = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={180}
    >
      <ScrollView 
        style={styles.tabContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          
          {/* Assigned User - Only editable by admins */}
          {user?.role === 'admin' && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Assigned To</Text>
              {editing ? (
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => toggleUserDropdown()}
                >
                  <View style={styles.dropdownButtonContent}>
                    {formData.assignedUserId ? (
                      <View style={styles.selectedUser}>
                        <View style={styles.selectedUserAvatar}>
                          <Text style={styles.selectedUserAvatarText}>
                            {(users.find(u => u._id === formData.assignedUserId)?.name || 
                              users.find(u => u._id === formData.assignedUserId)?.email || 
                              '?')[0].toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.dropdownButtonText}>
                          {users.find(u => u._id === formData.assignedUserId)?.name || 
                           users.find(u => u._id === formData.assignedUserId)?.email || 
                           'Select User'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.selectedUser}>
                        <View style={[styles.selectedUserAvatar, styles.unassignedAvatar]}>
                          <Ionicons name="person-outline" size={16} color={COLORS.textGray} />
                        </View>
                        <Text style={styles.dropdownButtonText}>Unassigned</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-down" size={20} color={COLORS.textGray} />
                  </View>
                </TouchableOpacity>
              ) : (
                <Text style={styles.fieldValue}>
                  {contact.assignedUserId 
                    ? users.find(u => u._id === contact.assignedUserId)?.name || 
                      users.find(u => u._id === contact.assignedUserId)?.email || 
                      'Unknown User'
                    : 'Unassigned'}
                </Text>
              )}
            </View>
          )}
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
    </KeyboardAvoidingView>
  );
  
  // Render conversations tab
  const renderConversationsTab = () => (
    <ConversationsList
      contactObjectId={contact._id}
      contactPhone={contact.phone}
      contactEmail={contact.email}
      locationId={user?.locationId || ''}
      userId={user?._id || ''}
      userName={user?.name}
      user={user}
      onNavigateToProject={handleNavigateToProject}
      onNavigateToAppointment={handleNavigateToAppointment}
      onNavigateToSettings={() => {
        navigation.navigate('SettingsScreen', { initialTab: 'communication' });
      }}
      style={styles.conversationsContainer}
    />
  );
  
  // Render notes tab with proper keyboard handling
  const renderNotesTab = () => (
    <KeyboardAvoidingView
      style={styles.notesContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={180}
    >
      <ScrollView 
        style={styles.notesList} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshingNotes}
            onRefresh={async () => {
              setRefreshingNotes(true);
              await loadNotes(true);
              setRefreshingNotes(false);
            }}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
      >
        {notesLoading && !refreshingNotes ? (
          <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 50 }} />
        ) : notes.length === 0 ? (
          <Text style={styles.noNotes}>No notes yet. Add your first note below.</Text>
        ) : (
          notes.map((note, index) => (
            <View key={note.id || index} style={styles.noteItem}>
              <Text style={styles.noteText}>{note.body || note.text || contact.notes}</Text>
              <Text style={styles.noteMetadata}>
                {note.createdBy || 'System'} • {new Date(note.createdAt || contact.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      
      <View style={[styles.addNoteContainer, keyboardVisible && styles.addNoteContainerKeyboard]}>
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
    </KeyboardAvoidingView>
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
          keyboardVerticalOffset={0}
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading contact...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderTabs()}
      {renderTabContent()}
      
      {/* Hide bottom navigation when keyboard is visible */}
      {keyboardVisible && <View style={styles.keyboardSpacer} />}
      
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
      
      {/* User Dropdown Modal */}
      {renderUserDropdown()}
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
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOW.light,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 16 : 24,
    zIndex: 1,
    padding: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 40,
  },
  avatar: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: isTablet ? 30 : 25,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: isTablet ? 22 : 18,
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
    top: Platform.OS === 'ios' ? 16 : 24,
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
  addNoteContainerKeyboard: {
    marginBottom: 0,
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
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
  
  // Keyboard spacer
  keyboardSpacer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: COLORS.white,
  },
  
  // Sexy dropdown styles
  dropdownButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
    ...SHADOW.small,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 8,
  },
  selectedUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedUserAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedUserAvatarText: {
    fontSize: 12,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
  },
  unassignedAvatar: {
    backgroundColor: COLORS.lightGray,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: 420,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  dropdownContent: {
    backgroundColor: '#FFFFFF',
  },
  dropdownHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: COLORS.accent,
    borderBottomWidth: 0,
  },
  dropdownTitle: {
    fontSize: 22,
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dropdownSubtitle: {
    fontSize: 15,
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  dropdownScroll: {
    maxHeight: 320,
    backgroundColor: '#FFFFFF',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemSelected: {
    backgroundColor: '#E8F4FB',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatarAdmin: {
    backgroundColor: COLORS.accent,
    borderColor: '#FFFFFF',
  },
  userAvatarText: {
    fontSize: 18,
    fontFamily: FONT.bold,
    color: '#FFFFFF',
  },
  dropdownItemName: {
    fontSize: 17,
    fontFamily: FONT.semiBold,
    color: '#1A1A1A',
    marginBottom: 3,
  },
  dropdownItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownItemEmail: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: '#666666',
    flex: 1,
  },
  roleBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  roleBadgeAdmin: {
    backgroundColor: '#E8F4FB',
    borderColor: '#B8E0F5',
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: FONT.bold,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: FONT.body,
    color: COLORS.textGray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: FONT.sectionTitle,
    color: COLORS.textGray,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: FONT.input,
    fontWeight: '600',
  },
});