// src/screens/ProjectDetailScreen.tsx
// Updated: 2025-01-19
// Field-service optimized project management with ContactDetailScreen UI pattern

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Animated,
  FlatList,
  Image,
  Dimensions,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { contactService } from '../services/contactService';
import { appointmentService } from '../services/appointmentService';
import { quoteService } from '../services/quoteService';
import ContactCard from '../components/ContactCard';
import QuoteCard from '../components/QuoteCard';
import AppointmentCard from '../components/AppointmentCard';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import ConversationsList from '../components/ConversationsList';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import { 
  Project, 
  Contact, 
  Quote, 
  Appointment, 
  Milestone,
  ProjectPhoto,
  ProjectDocument,
  ProjectTimelineEntry 
} from '../../packages/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ProjectDetailScreenRouteProp = RouteProp<{
  ProjectDetailScreen: { projectId: string; project?: Project };
}, 'ProjectDetailScreen'>;

type TabType = 'overview' | 'work' | 'photos' | 'documents' | 'messages';

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'clipboard' },
  { id: 'work', label: 'Work', icon: 'construct' },
  { id: 'photos', label: 'Photos', icon: 'camera' },
  { id: 'documents', label: 'Docs', icon: 'document-text' },
  { id: 'messages', label: 'Messages', icon: 'chatbubbles' },
];

const statusOptions = [
  { value: 'scheduled', label: 'Scheduled', color: '#9B59B6' },
  { value: 'in_progress', label: 'In Progress', color: '#3498DB' },
  { value: 'on_hold', label: 'On Hold', color: '#F39C12' },
  { value: 'completed', label: 'Completed', color: COLORS.success },
];

export default function ProjectDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<ProjectDetailScreenRouteProp>();
  const { user } = useAuth();
  const { projectId } = route.params;
  
  // State
  const [project, setProject] = useState<Project | null>(route.params.project || null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(!route.params.project);
  const [refreshing, setRefreshing] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Load project data
  const loadProjectData = useCallback(async () => {
    if (!projectId || !user?.locationId) return;
    
    try {
      const [projectData, appointmentsData] = await Promise.all([
        projectService.getDetails(projectId, { includeTimeline: true }),
        appointmentService.list(user.locationId, { projectId, limit: 50 }),
      ]);
      
      setProject(projectData);
      setAppointments(appointmentsData);
      setFormData({
        title: projectData.title || '',
        description: projectData.description || '',
      });
      
      // Load contact if available
      if (projectData.contactId) {
        try {
          const contactData = await contactService.get(projectData.contactId);
          setContact(contactData);
        } catch (contactError) {
          console.error('Error loading contact:', contactError);
        }
      }
      
      // Load the winning quote if available
      if (projectData.quoteId) {
        try {
          const quoteData = await quoteService.getById(projectData.quoteId);
          setQuote(quoteData);
        } catch (quoteError) {
          console.error('Error loading quote:', quoteError);
        }
      }
      
      // Initialize checklist from quote or project
      const defaultChecklist = [
        { id: '1', task: 'Arrive on site', completed: false },
        { id: '2', task: 'Review scope with customer', completed: false },
        { id: '3', task: 'Take before photos', completed: false },
        { id: '4', task: 'Complete work', completed: false },
        { id: '5', task: 'Clean up work area', completed: false },
        { id: '6', task: 'Take after photos', completed: false },
        { id: '7', task: 'Customer walkthrough', completed: false },
        { id: '8', task: 'Collect payment/signature', completed: false },
      ];
      setChecklist(projectData.checklist || defaultChecklist);
      setMaterials(projectData.materials || []);
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Error loading project:', error);
      Alert.alert('Error', 'Failed to load project details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, user?.locationId]);
  
  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);
  
  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadProjectData();
  };
  
  // Save project edits
  const handleSave = async () => {
    try {
      await projectService.update(project!._id, formData);
      setProject(prev => ({ ...prev!, ...formData }));
      setEditing(false);
      Alert.alert('Success', 'Project updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update project');
    }
  };
  
  // Quick actions for field workers
  const handleNavigate = () => {
    if (contact?.address) {
      const address = encodeURIComponent(contact.address);
      const url = Platform.OS === 'ios' 
        ? `maps:0,0?q=${address}`
        : `geo:0,0?q=${address}`;
      Linking.openURL(url);
    } else {
      Alert.alert('No Address', 'No address found for this project');
    }
  };
  
  const handleCall = () => {
    if (contact?.phone) {
      Linking.openURL(`tel:${contact.phone}`);
    }
  };
  
  const handleText = () => {
    if (contact?.phone) {
      Linking.openURL(`sms:${contact.phone}`);
    }
  };
  
  const handleEmail = () => {
    if (contact?.email) {
      Linking.openURL(`mailto:${contact.email}`);
    }
  };
  
  // Photo management
  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to add photos');
      return;
    }
    
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    let location = null;
    if (locationStatus === 'granted') {
      location = await Location.getCurrentPositionAsync({});
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    
    if (!result.canceled && result.assets[0]) {
      Alert.alert(
        'Photo Type',
        'What type of photo is this?',
        [
          {
            text: 'Before',
            onPress: () => uploadPhoto(result.assets[0].uri, 'before', location),
          },
          {
            text: 'During',
            onPress: () => uploadPhoto(result.assets[0].uri, 'during', location),
          },
          {
            text: 'After',
            onPress: () => uploadPhoto(result.assets[0].uri, 'after', location),
          },
          {
            text: 'Issue/Problem',
            onPress: () => uploadPhoto(result.assets[0].uri, 'issue', location),
          },
        ]
      );
    }
  };
  
  const uploadPhoto = async (uri: string, type: string, location: any) => {
    try {
      const photo = await projectService.uploadPhoto(project!._id, {
        uri,
        caption: type,
        location: location ? {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        } : undefined,
      });
      
      setProject(prev => ({
        ...prev!,
        photos: [...(prev?.photos || []), { ...photo, type }],
      }));
      
      Alert.alert('Success', `${type} photo added successfully`);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photo');
    }
  };
  
  // Checklist management
  const handleToggleChecklistItem = async (itemId: string) => {
    const updatedChecklist = checklist.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updatedChecklist);
    
    try {
      await projectService.update(project!._id, { checklist: updatedChecklist });
    } catch (error) {
      console.error('Failed to update checklist:', error);
    }
  };
  
  // Material management
  const handleAddMaterial = () => {
    Alert.prompt(
      'Add Material',
      'Enter material name and quantity',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (input) => {
            if (input) {
              const newMaterial = {
                id: Date.now().toString(),
                name: input,
                quantity: 1,
                addedAt: new Date().toISOString(),
              };
              const updatedMaterials = [...materials, newMaterial];
              setMaterials(updatedMaterials);
              
              try {
                await projectService.update(project!._id, { materials: updatedMaterials });
              } catch (error) {
                console.error('Failed to add material:', error);
              }
            }
          },
        },
      ],
      'plain-text'
    );
  };
  
  // Get project progress
  const getProjectProgress = () => {
    const completedTasks = checklist.filter(item => item.completed).length;
    return (completedTasks / checklist.length) * 100;
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    return statusOptions.find(s => s.value === status)?.color || COLORS.textGray;
  };
  
  // Get status label
  const getStatusLabel = (status: string) => {
    return statusOptions.find(s => s.value === status)?.label || 'Unknown';
  };
  
  // Calculate time to appointment
  const getTimeToAppointment = () => {
    const nextAppointment = appointments
      .filter(apt => new Date(apt.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    
    if (!nextAppointment) return null;
    
    const now = new Date();
    const aptTime = new Date(nextAppointment.startTime);
    const diffMs = aptTime.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    }
  };
  
  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <View style={[styles.projectIcon, { backgroundColor: getStatusColor(project?.status || '') + '20' }]}>
          <Ionicons name="construct" size={28} color={getStatusColor(project?.status || '')} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.projectTitle} numberOfLines={1}>{project?.title || 'Untitled Project'}</Text>
          <TouchableOpacity 
            style={styles.statusBadge}
            onPress={() => setShowStatusPicker(true)}
          >
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(project?.status || '') }]} />
            <Text style={styles.statusText}>{getStatusLabel(project?.status || '')}</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={() => setEditing(!editing)} style={styles.headerButton}>
          <Ionicons name={editing ? "close" : "pencil"} size={20} color={COLORS.accent} />
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
    <ScrollView 
      style={styles.tabContent} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleNavigate}>
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="navigate" size={24} color="#2196F3" />
            </View>
            <Text style={styles.actionText}>Navigate</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="call" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleText}>
            <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="chatbubble" size={24} color="#9C27B0" />
            </View>
            <Text style={styles.actionText}>Text</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="mail" size={24} color="#FF9800" />
            </View>
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Time to Appointment Alert */}
      {getTimeToAppointment() && (
        <View style={styles.alertCard}>
          <Ionicons name="time-outline" size={24} color={COLORS.accent} />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Next appointment in {getTimeToAppointment()}</Text>
            <Text style={styles.alertSubtitle}>
              {appointments[0]?.title || 'Site visit'}
            </Text>
          </View>
        </View>
      )}
      
      {/* Project Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project Information</Text>
        <View style={styles.infoCard}>
          {editing ? (
            <>
              <TextInput
                style={[styles.input, styles.titleInput]}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Project title"
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Project description"
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {quote && (
                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.textGray} />
                  <Text style={styles.infoText}>${quote.totalAmount?.toLocaleString()}</Text>
                </View>
              )}
              {contact && (
                <>
                  <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={20} color={COLORS.textGray} />
                    <Text style={styles.infoText}>{contact.firstName} {contact.lastName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={20} color={COLORS.textGray} />
                    <Text style={styles.infoText}>{contact.address || 'No address'}</Text>
                  </View>
                </>
              )}
              {project?.description && (
                <View style={styles.descriptionContainer}>
                  <Text style={styles.descriptionText}>{project.description}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
      
      {/* Progress Overview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <Text style={styles.progressText}>{Math.round(getProjectProgress())}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getProjectProgress()}%` }]} />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{checklist.filter(item => item.completed).length}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{project?.photos?.length || 0}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{materials.length}</Text>
            <Text style={styles.statLabel}>Materials</Text>
          </View>
        </View>
      </View>
      
      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          {project?.timeline?.slice(0, 3).map((event, index) => (
            <View key={event.id} style={styles.activityItem}>
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>{event.description}</Text>
                <Text style={styles.activityTime}>
                  {new Date(event.timestamp).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )) || (
            <Text style={styles.emptyText}>No recent activity</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
  
  // Render work tab (checklist & materials)
  const renderWorkTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Checklist */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Checklist</Text>
        {checklist.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.checklistItem}
            onPress={() => handleToggleChecklistItem(item.id)}
          >
            <Ionicons 
              name={item.completed ? "checkbox" : "square-outline"} 
              size={24} 
              color={item.completed ? COLORS.success : COLORS.textGray} 
            />
            <Text style={[
              styles.checklistText,
              item.completed && styles.checklistCompleted
            ]}>
              {item.task}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Materials */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Materials Used</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddMaterial}>
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {materials.length === 0 ? (
          <Text style={styles.emptyText}>No materials tracked yet</Text>
        ) : (
          materials.map((material) => (
            <View key={material.id} style={styles.materialItem}>
              <Ionicons name="cube-outline" size={20} color={COLORS.textGray} />
              <View style={styles.materialInfo}>
                <Text style={styles.materialName}>{material.name}</Text>
                <Text style={styles.materialQuantity}>Qty: {material.quantity}</Text>
              </View>
              <TouchableOpacity>
                <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textGray} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
  
  // Render photos tab
  const renderPhotosTab = () => {
    const photosByType = {
      before: project?.photos?.filter(p => p.type === 'before') || [],
      during: project?.photos?.filter(p => p.type === 'during') || [],
      after: project?.photos?.filter(p => p.type === 'after') || [],
      issue: project?.photos?.filter(p => p.type === 'issue') || [],
    };
    
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhoto}>
          <Ionicons name="camera" size={32} color={COLORS.white} />
          <Text style={styles.addPhotoText}>Take Photo</Text>
        </TouchableOpacity>
        
        {Object.entries(photosByType).map(([type, photos]) => (
          photos.length > 0 && (
            <View key={type} style={styles.photoSection}>
              <Text style={styles.photoSectionTitle}>
                {type.charAt(0).toUpperCase() + type.slice(1)} Photos ({photos.length})
              </Text>
              <FlatList
                horizontal
                data={photos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.photoThumb}>
                    <Image source={{ uri: item.uri }} style={styles.photoImage} />
                    {item.location && (
                      <View style={styles.photoLocation}>
                        <Ionicons name="location" size={12} color={COLORS.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )
        ))}
        
        {project?.photos?.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No photos yet</Text>
            <Text style={styles.emptySubtext}>Take before, during, and after photos</Text>
          </View>
        )}
      </ScrollView>
    );
  };
  
  // Render documents tab
  const renderDocumentsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity 
        style={styles.addDocButton} 
        onPress={() => Alert.alert('Coming Soon', 'Document upload will be available soon')}
      >
        <Ionicons name="document-attach" size={24} color={COLORS.white} />
        <Text style={styles.addDocText}>Add Document</Text>
      </TouchableOpacity>
      
      {project?.documents && project.documents.length > 0 ? (
        <FlatList
          data={project.documents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.documentItem}>
              <View style={styles.documentIcon}>
                <Ionicons name="document-text" size={24} color={COLORS.accent} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.documentSize}>
                  {(item.size / 1024).toFixed(1)} KB • {new Date(item.uploadDate).toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="download-outline" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No documents yet</Text>
          <Text style={styles.emptySubtext}>Upload quotes, invoices, and other files</Text>
        </View>
      )}
    </View>
  );
  
  // Render messages tab
  const renderMessagesTab = () => (
    <View style={styles.messagesContainer}>
      {contact ? (
        <ConversationsList
          contactObjectId={contact._id}
          contactPhone={contact.phone}
          contactEmail={contact.email}
          locationId={user?.locationId || ''}
          userId={user?._id || ''}
          userName={user?.name}
          user={user}
          onNavigateToProject={() => {}}
          onNavigateToAppointment={(appointmentId) => {
            navigation.navigate('AppointmentDetail', { appointmentId });
          }}
          onNavigateToSettings={() => {
            navigation.navigate('SettingsScreen', { initialTab: 'communication' });
          }}
          style={styles.conversationsList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No messages yet</Text>
        </View>
      )}
    </View>
  );
  
  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'work':
        return renderWorkTab();
      case 'photos':
        return renderPhotosTab();
      case 'documents':
        return renderDocumentsTab();
      case 'messages':
        return renderMessagesTab();
      default:
        return null;
    }
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading project...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderTabs()}
      <KeyboardAvoidingView 
        style={styles.flex} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderTabContent()}
      </KeyboardAvoidingView>
      
      {/* Status Picker Modal */}
      {showStatusPicker && (
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusPicker(false)}
        >
          <View style={styles.statusPicker}>
            <Text style={styles.pickerTitle}>Change Status</Text>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.statusOption}
                onPress={async () => {
                  setShowStatusPicker(false);
                  try {
                    await projectService.update(project!._id, { status: option.value });
                    setProject(prev => ({ ...prev!, status: option.value }));
                  } catch (error) {
                    Alert.alert('Error', 'Failed to update status');
                  }
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: option.color }]} />
                <Text style={styles.statusOptionText}>{option.label}</Text>
                {project?.status === option.value && (
                  <Ionicons name="checkmark" size={20} color={COLORS.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
      
      {/* Create Appointment Modal */}
      <CreateAppointmentModal
        visible={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        onSubmit={async (appointmentData) => {
          try {
            await appointmentService.create({
              ...appointmentData,
              projectId: project!._id,
              contactId: project!.contactId,
              userId: user!._id || user!.ghlUserId,
            });
            setShowAppointmentModal(false);
            handleRefresh();
          } catch (error) {
            Alert.alert('Error', 'Failed to create appointment');
          }
        }}
        projectId={project!._id}
        contactId={project!.contactId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginRight: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 12,
  },
  
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
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
  
  // Section styles
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
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
  
  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  
  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightAccent,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: RADIUS.medium,
    ...SHADOW.small,
  },
  alertContent: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  alertSubtitle: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  
  // Info card
  infoCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    marginTop: 12,
    ...SHADOW.small,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 12,
    flex: 1,
  },
  descriptionContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    lineHeight: 20,
  },
  
  // Form inputs
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: RADIUS.medium,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
  },
  
  // Progress
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.success,
  },
  progressText: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: COLORS.textGray,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: FONT.bold,
    color: COLORS.accent,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 4,
  },
  
  // Activity
  activityList: {
    marginTop: 12,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginTop: 4,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  activityTime: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  
  // Checklist
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checklistText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 12,
  },
  checklistCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textGray,
  },
  
  // Materials
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.white,
    marginLeft: 4,
  },
  materialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  materialInfo: {
    flex: 1,
    marginLeft: 12,
  },
  materialName: {
    fontSize: 15,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  materialQuantity: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  
  // Photos
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    margin: 20,
    paddingVertical: 16,
    borderRadius: RADIUS.medium,
    ...SHADOW.medium,
  },
  addPhotoText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
    marginLeft: 8,
  },
  photoSection: {
    marginBottom: 24,
  },
  photoSectionTitle: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginLeft: 20,
    marginBottom: 12,
  },
  photoThumb: {
    width: 120,
    height: 120,
    marginLeft: 16,
    borderRadius: RADIUS.medium,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoLocation: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  
  // Documents
  addDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    margin: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.medium,
    ...SHADOW.small,
  },
  addDocText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
    marginLeft: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: RADIUS.medium,
    ...SHADOW.small,
  },
  documentIcon: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.lightAccent,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  documentSize: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
  },
  conversationsList: {
    flex: 1,
  },
  
  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    marginTop: 4,
  },
  
  // Status picker
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPicker: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.large,
    padding: 20,
    width: '80%',
    maxWidth: 300,
    ...SHADOW.large,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 12,
  },
});