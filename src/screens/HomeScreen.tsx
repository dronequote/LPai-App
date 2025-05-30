import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  RefreshControl,
  FlatList,
  Modal,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import JobCard from '../components/JobCard';
import NavButton from '../components/NavButton';
import CompactAppointmentCard from '../components/CompactAppointmentCard';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import AddProjectForm from '../components/AddProjectForm';
import AddContactForm from '../components/AddContactForm';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import api from '../lib/api';

// --- THEME ---
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

// --- TYPES ---
import type { Appointment, Contact, Calendar, Project, User } from '../../packages/types/dist';
import type { StackNavigationProp } from '@react-navigation/stack';

type Props = {
  navigation: StackNavigationProp<any, any>;
};

// --- SEARCH RESULT TYPE ---
interface SearchResult {
  id: string;
  type: 'Contact' | 'Project' | 'Appointment' | 'Quote';
  title: string;
  subtitle: string;
  icon: string;
  data: any; // Original data object
}

// --- QUICK STATS TYPE ---
interface QuickStat {
  id: string;
  title: string;
  count: number;
  icon: string;
  color: string;
  onPress: () => void;
}

// --- QUICK ACTION BUTTONS ---
const actions = [
  { label: 'Calendar', icon: 'calendar-outline', screen: 'Calendar' },
  { label: 'Contacts', icon: 'person-circle-outline', screen: 'Contacts' },
  { label: 'Projects', icon: 'folder-open-outline', screen: 'Projects' },
  { label: 'Quote Builder', icon: 'construct-outline', screen: 'QuoteBuilder' },
  { label: 'Conversations', icon: 'chatbox-ellipses-outline', screen: 'Conversations' },
  { label: 'MockDashboard', icon: 'checkmark-done-circle-outline', screen: 'MockDashboard' },
];

// --- QUICK ADD OPTIONS ---
const quickAddOptions = [
  { id: 'contact', label: 'Add Contact', icon: 'person-add-outline', type: 'modal' },
  { id: 'appointment', label: 'Schedule Appointment', icon: 'calendar-outline', type: 'modal' },
  { id: 'project', label: 'Add Project', icon: 'folder-open-outline', type: 'modal' },
  { id: 'quote', label: 'Create Quote', icon: 'document-text-outline', type: 'modal' },
];

export default function HomeScreen({ navigation }: Props) {
  // --- STATE ---
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]); // Will be typed properly when quotes are built
  
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // --- QUICK ADD STATE ---
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddAnimation] = useState(new Animated.Value(0));
  
  // --- MODAL STATES ---
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  // --- QUOTE FORM STATE ---
  const [selectedProjectForQuote, setSelectedProjectForQuote] = useState(null);

  const { user } = useAuth() as { user: User | null };
  const { calendarMap } = useCalendar();

  // --- FETCH FUNCTIONS ---
  const loadAppointments = useCallback(async () => {
    if (!user?.locationId) return;
    setLoadingAppointments(true);
    try {
      const res = await api.get('/api/appointments', {
        params: { locationId: user.locationId },
      });
      const appointmentData = res.data as Appointment[] || [];
      setAllAppointments(appointmentData);
      
      const now = new Date();
      const upcoming = appointmentData
        .filter(a => new Date(a.start || a.time) > now)
        .sort((a, b) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime());
      
      setAppointments(upcoming.slice(0, 6)); // Cache 6 for scrolling
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      setAppointments([]);
      setAllAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }, [user?.locationId]);

  const loadContacts = useCallback(async () => {
    if (!user?.locationId) return;
    setLoadingContacts(true);
    try {
      const res = await api.get('/api/contacts', {
        params: { locationId: user.locationId },
      });
      setContacts(res.data as Contact[] || []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [user?.locationId]);

  const loadProjects = useCallback(async () => {
    if (!user?.locationId) return;
    setLoadingProjects(true);
    try {
      const res = await api.get('/api/projects', {
        params: { locationId: user.locationId },
      });
      const projectData = res.data as Project[] || [];
      setAllProjects(projectData);
      
      const activeStatuses = ['Open', 'In Progress', 'Scheduled', 'Quoted'];
      const jobs = projectData
        .filter(p => activeStatuses.includes(p.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setProjects(jobs.slice(0, 6)); // Cache 6 for scrolling
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
      setAllProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [user?.locationId]);

  // --- LOAD DATA ---
  useEffect(() => {
    loadAppointments();
    loadContacts();
    loadProjects();
  }, [loadAppointments, loadContacts, loadProjects]);

  // --- REFRESH HANDLER ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadAppointments(),
      loadContacts(),
      loadProjects()
    ]);
    setRefreshing(false);
  }, [loadAppointments, loadContacts, loadProjects]);

  // --- SEARCH LOGIC ---
  const performSearch = useCallback((query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Fuzzy search function
    const fuzzyMatch = (text: string, query: string): boolean => {
      const textLower = text.toLowerCase();
      return textLower.includes(query) || 
             query.split('').every(char => textLower.includes(char));
    };

    // Search contacts
    contacts.forEach(contact => {
      const searchableText = `${contact.firstName} ${contact.lastName} ${contact.email} ${contact.phone || ''}`;
      if (fuzzyMatch(searchableText, lowerQuery)) {
        results.push({
          id: contact._id,
          type: 'Contact',
          title: `${contact.firstName} ${contact.lastName}`,
          subtitle: contact.email,
          icon: 'person-outline',
          data: contact
        });
      }
    });

    // Search projects
    allProjects.forEach(project => {
      if (fuzzyMatch(project.title, lowerQuery)) {
        results.push({
          id: project._id,
          type: 'Project',
          title: project.title,
          subtitle: project.status,
          icon: 'folder-outline',
          data: project
        });
      }
    });

    // Search appointments
    allAppointments.forEach(appointment => {
      const contact = contacts.find(c => c._id === appointment.contactId);
      const searchableText = `${appointment.title} ${contact?.firstName || ''} ${contact?.lastName || ''}`;
      if (fuzzyMatch(searchableText, lowerQuery)) {
        results.push({
          id: appointment._id,
          type: 'Appointment',
          title: appointment.title,
          subtitle: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact',
          icon: 'calendar-outline',
          data: appointment
        });
      }
    });

    // Search quotes (when implemented)
    quotes.forEach(quote => {
      if (fuzzyMatch(quote.title || '', lowerQuery)) {
        results.push({
          id: quote._id,
          type: 'Quote',
          title: quote.title,
          subtitle: quote.status || 'Draft',
          icon: 'document-text-outline',
          data: quote
        });
      }
    });

    // Sort by relevance (exact matches first, then fuzzy)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(lowerQuery);
      const bExact = b.title.toLowerCase().includes(lowerQuery);
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      return 0;
    });

    setSearchResults(results.slice(0, 20)); // Limit to 20 results
    setShowSearchResults(true);
  }, [contacts, allProjects, allAppointments, quotes]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // --- QUICK STATS ---
  const quickStats: QuickStat[] = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const todayAppointments = allAppointments.filter(a => {
      const apptDate = new Date(a.start || a.time);
      return apptDate >= todayStart && apptDate < todayEnd;
    }).length;

    const activeProjects = allProjects.filter(p => 
      ['Open', 'In Progress', 'Scheduled', 'Quoted'].includes(p.status)
    ).length;

    const recentContacts = contacts.filter(c => {
      const created = new Date(c.createdAt || 0);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return created > weekAgo;
    }).length;

    const urgentTasks = allAppointments.filter(a => {
      const apptDate = new Date(a.start || a.time);
      const tomorrow = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
      return apptDate >= todayStart && apptDate < tomorrow;
    }).length + allProjects.filter(p => p.status === 'Overdue').length;

    return [
      {
        id: 'appointments',
        title: "Today's Appointments",
        count: todayAppointments,
        icon: 'calendar-outline',
        color: COLORS.accent,
        onPress: () => navigation.navigate('Calendar')
      },
      {
        id: 'projects',
        title: 'Active Projects',
        count: activeProjects,
        icon: 'folder-outline',
        color: '#27AE60',
        onPress: () => navigation.navigate('Projects')
      },
      {
        id: 'contacts',
        title: 'New Contacts',
        count: recentContacts,
        icon: 'person-add-outline',
        color: '#9B59B6',
        onPress: () => navigation.navigate('Contacts')
      },
      {
        id: 'urgent',
        title: 'Urgent Tasks',
        count: urgentTasks,
        icon: 'alert-circle-outline',
        color: urgentTasks > 0 ? '#E74C3C' : COLORS.textGray,
        onPress: () => navigation.navigate('Calendar')
      }
    ];
  }, [allAppointments, allProjects, contacts, navigation]);

  // --- CONTACT LOOKUP MAP ---
  const contactsMap: Record<string, Contact> = useMemo(() => 
    Object.fromEntries(contacts.map(c => [c._id, c])), [contacts]
  );

  // --- QUICK ADD ANIMATION ---
  const toggleQuickAdd = () => {
    if (showQuickAdd) {
      Animated.timing(quickAddAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowQuickAdd(false));
    } else {
      setShowQuickAdd(true);
      Animated.timing(quickAddAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  // --- QUICK ADD HANDLERS ---
  const handleQuickAddPress = (optionId: string) => {
    toggleQuickAdd();
    
    setTimeout(() => {
      switch (optionId) {
        case 'contact':
          setShowContactModal(true);
          break;
        case 'appointment':
          setShowAppointmentModal(true);
          break;
        case 'project':
          setShowProjectModal(true);
          break;
        case 'quote':
          setShowQuoteModal(true);
          break;
      }
    }, 300);
  };

  // --- CREATE CONTACT ---
  const handleCreateContact = async (contactData: any) => {
    try {
      const response = await api.post('/api/contacts', {
        ...contactData,
        locationId: user?.locationId,
      });
      
      if (response.data.success) {
        setShowContactModal(false);
        
        // Refresh contacts
        await loadContacts();
        
        // Navigate to new contact
        const newContact = { 
          _id: response.data.contactId, 
          ...contactData,
          locationId: user?.locationId 
        };
        navigation.navigate('ContactDetailScreen', { contact: newContact });
      }
    } catch (error) {
      console.error('Failed to create contact:', error);
      Alert.alert('Error', 'Failed to create contact. Please try again.');
    }
  };

  // --- CREATE APPOINTMENT ---
  const handleCreateAppointment = async (appointmentData: any) => {
    try {
      const response = await api.post('/api/appointments', {
        ...appointmentData,
        userId: user?._id,
        locationId: user?.locationId,
      });
      
      setShowAppointmentModal(false);
      await loadAppointments();
      
      // Navigate to new appointment
      navigation.navigate('AppointmentDetail', { 
        appointmentId: response.data.appointment._id 
      });
    } catch (error) {
      console.error('Failed to create appointment:', error);
      Alert.alert('Error', 'Failed to create appointment. Please try again.');
    }
  };

  // --- CREATE PROJECT ---
  const handleCreateProject = async (projectData: any) => {
    try {
      const response = await api.post('/api/projects', {
        ...projectData,
        locationId: user?.locationId,
      });
      
      setShowProjectModal(false);
      await loadProjects();
      
      // Navigate to new project
      const newProject = { 
        _id: response.data.projectId, 
        ...projectData 
      };
      navigation.navigate('ProjectDetailScreen', { project: newProject });
    } catch (error) {
      console.error('Failed to create project:', error);
      Alert.alert('Error', 'Failed to create project. Please try again.');
    }
  };

  // --- SELECT PROJECT FOR QUOTE ---
  const handleSelectProjectForQuote = (project: any) => {
    setSelectedProjectForQuote(project);
    setShowQuoteModal(false);
    // Navigate to quote creation screen with selected project
    navigation.navigate('QuoteBuilder', { project });
  };

  // --- HANDLE SEARCH RESULT PRESS ---
  const handleSearchResultPress = (result: SearchResult) => {
    setShowSearchResults(false);
    setSearchQuery('');
    
    switch (result.type) {
      case 'Contact':
        navigation.navigate('ContactDetailScreen', { contact: result.data });
        break;
      case 'Project':
        navigation.navigate('ProjectDetailScreen', { project: result.data });
        break;
      case 'Appointment':
        navigation.navigate('AppointmentDetail', { appointmentId: result.data._id });
        break;
      case 'Quote':
        // navigation.navigate('QuoteDetail', { quoteId: result.data._id });
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        name={user?.name || 'User'}
        navigation={navigation}
        onPressNotification={() => {}}
      />

      {/* --- SEARCH BAR --- */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textGray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts, projects, appointments..."
            placeholderTextColor={COLORS.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              setShowSearchResults(false);
            }}>
              <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- SEARCH RESULTS --- */}
      {showSearchResults && (
        <View style={styles.searchResultsContainer}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleSearchResultPress(item)}
              >
                <Ionicons name={item.icon} size={20} color={COLORS.accent} style={styles.searchResultIcon} />
                <View style={styles.searchResultContent}>
                  <Text style={styles.searchResultTitle}>{item.title}</Text>
                  <Text style={styles.searchResultSubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={styles.searchResultType}>{item.type}</Text>
              </TouchableOpacity>
            )}
            style={styles.searchResultsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* --- MAIN CONTENT --- */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        style={{ flex: 1 }}
      >
        {/* --- QUICK STATS --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Overview</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.quickStatsContainer}
          >
            {quickStats.map((stat) => (
              <TouchableOpacity
                key={stat.id}
                style={[styles.quickStatCard, { borderLeftColor: stat.color }]}
                onPress={stat.onPress}
              >
                <View style={styles.quickStatContent}>
                  <Ionicons name={stat.icon} size={24} color={stat.color} />
                  <Text style={styles.quickStatCount}>{stat.count}</Text>
                </View>
                <Text style={styles.quickStatTitle}>{stat.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* --- UPCOMING APPOINTMENTS --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          {loadingAppointments || loadingContacts ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : appointments.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming appointments.</Text>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalList}
            >
              {appointments.map((item, index) => (
                <View key={item._id || item.id} style={index === 0 ? {} : { marginLeft: 12 }}>
                  <CompactAppointmentCard
                    appointment={item}
                    contact={contactsMap[item.contactId]}
                    calendar={calendarMap[item.calendarId]}
                    onPress={() =>
                      navigation.navigate('AppointmentDetail', {
                        appointmentId: item._id || item.id,
                      })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* --- JOBS IN PROGRESS --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs In Progress</Text>
          {loadingProjects ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : projects.length === 0 ? (
            <Text style={styles.emptyText}>No jobs in progress.</Text>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalList}
            >
              {projects.map((item, index) => (
                <View key={item._id || item.id} style={index === 0 ? {} : { marginLeft: 12 }}>
                  <JobCard
                    title={item.title}
                    subtitle={item.contactName || item.contactId}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* --- QUICK ACTION BUTTONS --- */}
        <View style={styles.grid}>
          {actions.map((action, index) => (
            <NavButton
              key={index}
              label={action.label}
              iconName={action.icon}
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>

        {/* Bottom padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* --- FLOATING ACTION BUTTON --- */}
      <View style={styles.fabContainer}>
        {/* Dark Overlay */}
        {showQuickAdd && (
          <Animated.View
            style={[
              styles.fabOverlay,
              {
                opacity: quickAddAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
        )}
        
        {showQuickAdd && (
          <Animated.View
            style={[
              styles.quickAddContainer,
              {
                opacity: quickAddAnimation,
                transform: [
                  {
                    translateY: quickAddAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [60, 0],
                    }),
                  },
                  {
                    scale: quickAddAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {quickAddOptions.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.quickAddOption,
                  { marginBottom: index === quickAddOptions.length - 1 ? 16 : 12 }
                ]}
                onPress={() => handleQuickAddPress(option.id)}
              >
                <View style={styles.quickAddOptionContent}>
                  <View style={styles.quickAddOptionIcon}>
                    <Ionicons name={option.icon} size={22} color={COLORS.accent} />
                  </View>
                  <Text style={styles.quickAddOptionText}>{option.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
        
        <TouchableOpacity style={styles.fab} onPress={toggleQuickAdd}>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: quickAddAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                },
              ],
            }}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* --- ADD CONTACT MODAL --- */}
      <AddContactForm
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSubmit={handleCreateContact}
        isModal={true}
      />

      {/* --- CREATE APPOINTMENT MODAL --- */}
      <CreateAppointmentModal
        visible={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        onSubmit={handleCreateAppointment}
        contacts={contacts}
        selectedDate={new Date()}
      />

      {/* --- ADD PROJECT MODAL --- */}
      <AddProjectForm
        visible={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onSubmit={handleCreateProject}
        onAddContactPress={() => {
          setShowProjectModal(false);
          setTimeout(() => setShowContactModal(true), 300);
        }}
        isModal={true} // Use as standalone modal
      />

      {/* --- CREATE QUOTE MODAL --- */}
      <Modal
        visible={showQuoteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowQuoteModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQuoteModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Quote</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.formLabel}>Select Project</Text>
            <Text style={styles.formDescription}>
              Choose a project to create a quote for:
            </Text>
            
            {allProjects.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyStateText}>No projects found</Text>
                <Text style={styles.emptyStateSubtext}>Create a project first to generate quotes</Text>
              </View>
            ) : (
              allProjects.map((project) => (
                <TouchableOpacity
                  key={project._id}
                  style={styles.projectOption}
                  onPress={() => handleSelectProjectForQuote(project)}
                >
                  <View style={styles.projectOptionContent}>
                    <Text style={styles.projectOptionTitle}>{project.title}</Text>
                    <Text style={styles.projectOptionStatus}>{project.status}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* --- SEARCH OVERLAY --- */}
      {showSearchResults && (
        <TouchableOpacity
          style={styles.searchOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowSearchResults(false);
            setSearchQuery('');
          }}
        />
      )}
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...SHADOW.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 120, // Adjust based on header + search bar height
    left: 20,
    right: 20,
    zIndex: 1000,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    maxHeight: 300,
    ...SHADOW.card,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchResultIcon: {
    marginRight: 12,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  searchResultSubtitle: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 2,
  },
  searchResultType: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  quickStatsContainer: {
    flexDirection: 'row',
  },
  quickStatCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    borderLeftWidth: 4,
    ...SHADOW.card,
  },
  quickStatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quickStatCount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  quickStatTitle: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    fontWeight: '500',
  },
  horizontalList: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'center',
  },
  fabOverlay: {
    position: 'absolute',
    top: -500,
    left: -Dimensions.get('window').width,
    width: Dimensions.get('window').width * 2,
    height: Dimensions.get('window').height,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  quickAddContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  quickAddOption: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    minWidth: 200,
    ...SHADOW.fab,
  },
  quickAddOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quickAddOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  quickAddOptionText: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.fab,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.fab,
    zIndex: 3,
  },
  
  // --- MODAL STYLES ---
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  modalCancel: {
    fontSize: FONT.input,
    color: COLORS.accent,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  
  // --- FORM STYLES ---
  formLabel: {
    fontSize: FONT.label,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  formDescription: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 16,
    lineHeight: 20,
  },
  
  // --- PROJECT SELECTION STYLES ---
  projectOption: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.card,
  },
  projectOptionContent: {
    flex: 1,
  },
  projectOptionTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  projectOptionStatus: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  
  // --- EMPTY STATE STYLES ---
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textGray,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});