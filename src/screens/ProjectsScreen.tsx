// src/screens/ProjectsScreen.tsx
// Updated: 2025-01-19
// Shows only won projects (active jobs) with field-service focused filters

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
  Animated,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { projectService } from '../services/projectService';
import { contactService } from '../services/contactService';
import ProjectCard from '../components/ProjectCard';
import { Project, Contact } from '../../packages/types';
import { COLORS, FONT, SHADOW, RADIUS } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Updated filters for active projects only
const topFilters = [
  { id: 'all', label: 'All Active', icon: 'briefcase', color: COLORS.accent },
  { id: 'today', label: 'Today', icon: 'today', color: '#3498DB' },
  { id: 'scheduled', label: 'Scheduled', icon: 'calendar', color: '#9B59B6' },
  { id: 'in_progress', label: 'In Progress', icon: 'construct', color: '#F39C12' },
  { id: 'completed', label: 'Completed', icon: 'checkmark-circle', color: COLORS.success },
];

const sortOptions = [
  { id: 'nextAppointment', label: 'Next Appointment', icon: 'time' },
  { id: 'priority', label: 'Priority', icon: 'flag' },
  { id: 'recentlyUpdated', label: 'Recently Updated', icon: 'refresh' },
  { id: 'customerName', label: 'Customer Name', icon: 'person' },
  { id: 'location', label: 'Location', icon: 'location' },
  { id: 'value', label: 'Project Value', icon: 'cash' },
];

export default function ProjectsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [topFilter, setTopFilter] = useState('all');
  const [sortBy, setSortBy] = useState('nextAppointment');
  const [showSortOptions, setShowSortOptions] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Pagination
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 20,
    hasMore: true,
    total: 0,
  });
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchBarOpacity = useRef(new Animated.Value(1)).current;
  const sortOptionsHeight = useRef(new Animated.Value(0)).current;
  
  // Create contact map for quick lookup
  const contactMap = useMemo(() => {
    const map: Record<string, Contact> = {};
    contacts.forEach(contact => {
      map[contact._id] = contact;
    });
    return map;
  }, [contacts]);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);
  
  // Toggle sort options
  const toggleSortOptions = () => {
    const toValue = showSortOptions ? 0 : sortOptions.length * 50;
    Animated.timing(sortOptionsHeight, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setShowSortOptions(!showSortOptions);
  };
  
  // Fetch projects (only won status)
  const fetchProjects = useCallback(async (reset = false) => {
    if (!user?.locationId) return;
    
    try {
      const offset = reset ? 0 : pagination.offset;
      
      // Get all projects for now - we'll filter on the frontend
      const response = await projectService.list(user.locationId);
      
      // Filter for won projects only
      const wonProjects = response.filter((p: Project) => p.status === 'won');
      
      // Apply additional filtering based on UI filter
      let filteredProjects = wonProjects;
      
      if (topFilter === 'all') {
        // "All Active" should exclude completed projects
        filteredProjects = wonProjects.filter(p => p.projectStatus !== 'completed');
      } else {
        switch (topFilter) {
          case 'scheduled':
            filteredProjects = wonProjects.filter(p => p.projectStatus === 'scheduled');
            break;
          case 'in_progress':
            filteredProjects = wonProjects.filter(p => p.projectStatus === 'in_progress');
            break;
          case 'completed':
            filteredProjects = wonProjects.filter(p => p.projectStatus === 'completed');
            break;
          case 'today':
            // For now, show all projects marked as in progress
            filteredProjects = wonProjects.filter(p => p.projectStatus === 'in_progress');
            break;
        }
      }
      
      // Apply search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        filteredProjects = filteredProjects.filter((p: Project) => 
          p.title?.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply sorting
      filteredProjects.sort((a: Project, b: Project) => {
        switch (sortBy) {
          case 'customerName':
            return (a.title || '').localeCompare(b.title || '');
          case 'value':
            return (b.monetaryValue || 0) - (a.monetaryValue || 0);
          case 'recentlyUpdated':
            return new Date(b.updatedAt || b.createdAt).getTime() - 
                   new Date(a.updatedAt || a.createdAt).getTime();
          default:
            return 0;
        }
      });
      
      if (reset) {
        setProjects(filteredProjects);
      } else {
        setProjects(prev => [...prev, ...filteredProjects]);
      }
      
      setPagination(prev => ({
        ...prev,
        offset: offset + filteredProjects.length,
        hasMore: false, // For now, disable pagination
      }));
      
    } catch (error) {
      console.error('Error fetching projects:', error);
      Alert.alert('Error', 'Failed to load projects');
    }
  }, [user?.locationId, debouncedSearch, topFilter, sortBy]);
  
  // Fetch contacts
  const fetchContacts = async () => {
    if (!user?.locationId) return;
    
    try {
      const contactsData = await contactService.list(user.locationId, { limit: 100 });
      setContacts(contactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };
  
  // Initial load
  useEffect(() => {
    if (user?.locationId) {
      loadData();
    }
  }, [user?.locationId]);
  
  // Reload when filters change
  useEffect(() => {
    if (user?.locationId && !loading) {
      handleRefresh();
    }
  }, [debouncedSearch, topFilter, sortBy]);
  
  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProjects(true),
      fetchContacts(),
    ]);
    setLoading(false);
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    setPagination(prev => ({ ...prev, offset: 0, hasMore: true }));
    await fetchProjects(true);
    setRefreshing(false);
  };
  
  const handleLoadMore = async () => {
    if (!pagination.hasMore || loadingMore || refreshing) return;
    
    setLoadingMore(true);
    await fetchProjects(false);
    setLoadingMore(false);
  };
  
  const handleProjectPress = (project: Project) => {
    navigation.navigate('ProjectDetailScreen', { 
      projectId: project._id,
      project,
    });
  };
  
  // Calculate stats for active projects
  const stats = useMemo(() => {
    const today = projects.filter(p => p.projectStatus === 'in_progress').length;
    const scheduled = projects.filter(p => p.projectStatus === 'scheduled').length;
    const inProgress = projects.filter(p => p.projectStatus === 'in_progress').length;
    const completed = projects.filter(p => p.projectStatus === 'completed').length;
    
    return { today, scheduled, inProgress, completed };
  }, [projects]);
  
  // Get urgent projects (need attention)
  const urgentProjects = useMemo(() => {
    return projects.filter(p => {
      // For now, just return empty array
      return false;
    });
  }, [projects]);
  
  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Urgent Projects Alert */}
      {urgentProjects.length > 0 && (
        <TouchableOpacity style={styles.urgentAlert}>
          <Ionicons name="warning" size={20} color={COLORS.error} />
          <Text style={styles.urgentText}>
            {urgentProjects.length} project{urgentProjects.length > 1 ? 's' : ''} need attention
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.error} />
        </TouchableOpacity>
      )}
      
      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <TouchableOpacity 
          style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}
          onPress={() => setTopFilter('today')}
        >
          <Ionicons name="today" size={24} color="#2196F3" />
          <Text style={styles.statNumber}>{stats.today}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.statCard, { backgroundColor: '#F3E5F5' }]}
          onPress={() => setTopFilter('scheduled')}
        >
          <Ionicons name="calendar" size={24} color="#9C27B0" />
          <Text style={styles.statNumber}>{stats.scheduled}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}
          onPress={() => setTopFilter('in_progress')}
        >
          <Ionicons name="construct" size={24} color="#FF9800" />
          <Text style={styles.statNumber}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}
          onPress={() => setTopFilter('completed')}
        >
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderProject = ({ item }: { item: Project }) => {
    const contact = contactMap[item.contactId];
    
    // Ensure the project has the contactName field that ProjectCard expects
    const projectWithContact = {
      ...item,
      contactName: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : 'Unknown Customer'
    };
    
    return (
      <ProjectCard
        project={projectWithContact}
        onPress={() => handleProjectPress(item)}
      />
    );
  };
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="construct-outline" size={64} color={COLORS.textLight} />
      <Text style={styles.emptyText}>
        {search ? 'No active projects found' : 'No active projects'}
      </Text>
      <Text style={styles.emptySubtext}>
        Win some quotes to see projects here
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => navigation.navigate('OpportunitiesScreen')}
      >
        <Text style={styles.emptyButtonText}>View Opportunities</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.accent} />
      </View>
    );
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Active Projects</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => navigation.navigate('OpportunitiesScreen')}
        >
          <Ionicons name="funnel-outline" size={20} color={COLORS.accent} />
          <Text style={styles.filterButtonText}>Opportunities</Text>
        </TouchableOpacity>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search active projects..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={COLORS.textGray}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Top Filters */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={topFilters}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterPill,
                topFilter === item.id && styles.filterPillActive,
                { borderColor: item.color }
              ]}
              onPress={() => setTopFilter(item.id)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={16} 
                color={topFilter === item.id ? COLORS.white : item.color} 
                style={styles.filterIcon}
              />
              <Text style={[
                styles.filterPillText,
                topFilter === item.id && styles.filterPillTextActive,
                { color: topFilter === item.id ? COLORS.white : item.color }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
        
        {/* Sort Button */}
        <TouchableOpacity style={styles.sortButton} onPress={toggleSortOptions}>
          <Ionicons name="swap-vertical" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
      
      {/* Sort Options */}
      <Animated.View style={[styles.sortOptions, { height: sortOptionsHeight }]}>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.sortOption,
              sortBy === option.id && styles.sortOptionActive
            ]}
            onPress={() => {
              setSortBy(option.id);
              toggleSortOptions();
            }}
          >
            <Ionicons 
              name={option.icon as any} 
              size={18} 
              color={sortBy === option.id ? COLORS.accent : COLORS.textGray} 
            />
            <Text style={[
              styles.sortOptionText,
              sortBy === option.id && styles.sortOptionTextActive
            ]}>
              {option.label}
            </Text>
            {sortBy === option.id && (
              <Ionicons name="checkmark" size={18} color={COLORS.accent} style={styles.sortCheck} />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
      
      <FlatList
        data={projects}
        renderItem={renderProject}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        contentContainerStyle={projects.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: FONT.bold,
    color: COLORS.textDark,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.lightAccent,
  },
  filterButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.accent,
    marginLeft: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
  },
  filterList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterIcon: {
    marginRight: 4,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortOptions: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sortOptionActive: {
    backgroundColor: COLORS.lightAccent,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 12,
  },
  sortOptionTextActive: {
    color: COLORS.accent,
    fontFamily: FONT.medium,
  },
  sortCheck: {
    marginLeft: 8,
  },
  
  // Header section
  headerSection: {
    paddingTop: 16,
  },
  urgentAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  urgentText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.error,
    marginLeft: 8,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: RADIUS.medium,
    ...SHADOW.small,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: FONT.bold,
    color: COLORS.textDark,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 4,
  },

  
  // Empty state
  emptyList: {
    flexGrow: 1,
  },
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
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
  },
  emptyButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.white,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});