// src/screens/ProjectsScreen.tsx
// Updated: 2025-06-17

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/StackNavigator';
import ProjectCard from '../components/ProjectCard';
import FilterModal from '../components/FilterModal';
import AddProjectForm from '../components/AddProjectForm';
import { projectService } from '../services/projectService';
import { Project, Pipeline } from '../../packages/types';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

type ProjectsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Projects'>;

// Status filter options
const STATUS_FILTERS = ['All', 'open', 'won', 'lost', 'abandoned'];

// Sort options
const SORT_OPTIONS = [
  { label: 'Newest First', value: 'createdAt', order: 'desc' },
  { label: 'Oldest First', value: 'createdAt', order: 'asc' },
  { label: 'Name (A-Z)', value: 'title', order: 'asc' },
  { label: 'Name (Z-A)', value: 'title', order: 'desc' },
  { label: 'Status', value: 'status', order: 'asc' },
];

export default function ProjectsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<ProjectsScreenNavigationProp>();
  
  // Data states - Initialize as empty arrays
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  
  // UI states
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSyncingPipelines, setIsSyncingPipelines] = useState(false);
  
  // Pagination
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 20,
    hasMore: true,
    total: 0,
  });

  // Fetch projects with filters
  const fetchProjects = useCallback(async (isRefresh = false) => {
    if (!user?.locationId) return;

    try {
      const offset = isRefresh ? 0 : pagination.offset;
      
      const options: any = {
        limit: pagination.limit,
        offset: offset,
        sortBy: sortBy.value,
        sortOrder: sortBy.order,
      };
      
      // Add filters
      if (statusFilter !== 'All') {
        options.status = statusFilter;
      }
      if (pipelineFilter) {
        options.pipelineId = pipelineFilter;
      }
      if (search) {
        options.search = search;
      }

      if (__DEV__) {
        console.log('[ProjectsScreen] Fetching projects with options:', options);
      }

      // Use the new API - no locationId parameter needed
      const result = await projectService.list(options);
      
      // Ensure result is an array
      const projectsArray = Array.isArray(result) ? result : [];
      
      if (__DEV__) {
        console.log('[ProjectsScreen] Fetched projects:', projectsArray.length);
      }
      
      if (isRefresh) {
        setProjects(projectsArray);
      } else {
        setProjects(prev => [...prev, ...projectsArray]);
      }
      
      // Update pagination
      setPagination(prev => ({
        ...prev,
        offset: offset + projectsArray.length,
        hasMore: projectsArray.length === pagination.limit,
      }));
      
    } catch (error) {
      if (__DEV__) {
        console.error('[ProjectsScreen] Error fetching projects:', error);
      }
      Alert.alert('Error', 'Failed to load projects. Please try again.');
      // Ensure projects is always an array even on error
      if (isRefresh) {
        setProjects([]);
      }
    }
  }, [user?.locationId, statusFilter, pipelineFilter, search, sortBy, pagination.limit, pagination.offset]);

  // Initial load
  useEffect(() => {
    if (user?.locationId) {
      loadInitialData();
    }
  }, [user?.locationId]);

  // Reload when filters change
  useEffect(() => {
    if (user?.locationId && !loading) {
      handleRefresh();
    }
  }, [statusFilter, pipelineFilter, sortBy]);

  // Debounced search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (user?.locationId && !loading) {
        handleRefresh();
      }
    }, 300);
    
    return () => clearTimeout(delaySearch);
  }, [search]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load pipelines from location settings if available
      // TODO: Implement location service to get pipelines
      
      // Load projects
      await fetchProjects(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPagination(prev => ({ ...prev, offset: 0, hasMore: true }));
    await fetchProjects(true);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!pagination.hasMore || loadingMore) return;
    
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

  const handleAddProject = async (projectData: any) => {
    try {
      // BaseService adds locationId automatically
      await projectService.create({
        ...projectData,
        userId: user!._id || user!.userId,
      });
      
      setIsAddModalVisible(false);
      handleRefresh();
      Alert.alert('Success', 'Project created successfully!');
    } catch (error) {
      if (__DEV__) {
        console.error('[ProjectsScreen] Error creating project:', error);
      }
      Alert.alert('Error', 'Failed to create project. Please try again.');
    }
  };

  const handleUpdateProject = async (projectId: string, updates: any) => {
    try {
      // BaseService handles locationId automatically
      await projectService.update(projectId, updates);
      handleRefresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to update project');
    }
  };

  const syncPipelines = async () => {
    // TODO: Implement pipeline sync when location service is available
    Alert.alert('Info', 'Pipeline sync will be available soon');
  };

  // Filter projects based on search - with proper array checks
  const filteredProjects = useMemo(() => {
    // Ensure projects is always an array
    const projectsArray = Array.isArray(projects) ? projects : [];
    
    if (!search || !search.trim()) {
      return projectsArray;
    }
    
    const searchLower = search.toLowerCase();
    return projectsArray.filter(project => {
      if (!project) return false;
      
      return (
        (project.title && project.title.toLowerCase().includes(searchLower)) ||
        (project.contactName && project.contactName.toLowerCase().includes(searchLower)) ||
        (project.notes && project.notes.toLowerCase().includes(searchLower))
      );
    });
  }, [projects, search]);

  // Get project stats - with proper array checks
  const projectStats = useMemo(() => {
    // Ensure filteredProjects is always an array
    const projectsArray = Array.isArray(filteredProjects) ? filteredProjects : [];
    
    return {
      total: projectsArray.length,
      open: projectsArray.filter(p => p && p.status === 'open').length,
      won: projectsArray.filter(p => p && p.status === 'won').length,
      lost: projectsArray.filter(p => p && p.status === 'lost').length,
      abandoned: projectsArray.filter(p => p && p.status === 'abandoned').length,
    };
  }, [filteredProjects]);

  const renderHeader = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textGray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textGray}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Stats Bar */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{projectStats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.primary || COLORS.accent }]}>{projectStats.open}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#27AE60' }]}>{projectStats.won}</Text>
          <Text style={styles.statLabel}>Won</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#E74C3C' }]}>{projectStats.lost}</Text>
          <Text style={styles.statLabel}>Lost</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterChips}
        contentContainerStyle={styles.filterChipsContent}
      >
        {/* Status Filters */}
        {STATUS_FILTERS.map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              statusFilter === status && styles.filterChipActive
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === status && styles.filterChipTextActive
            ]}>
              {status === 'All' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        
        {/* Pipeline Filter */}
        {pipelines.length > 0 && (
          <TouchableOpacity
            style={[
              styles.filterChip,
              pipelineFilter && styles.filterChipActive
            ]}
            onPress={() => setIsFilterVisible(true)}
          >
            <Ionicons 
              name="funnel-outline" 
              size={14} 
              color={pipelineFilter ? '#fff' : COLORS.textGray} 
            />
            <Text style={[
              styles.filterChipText,
              pipelineFilter && styles.filterChipTextActive
            ]}>
              {pipelineFilter ? 
                pipelines.find(p => p._id === pipelineFilter)?.name || 'Pipeline' 
                : 'Pipeline'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Sort */}
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => {
            const currentIndex = SORT_OPTIONS.findIndex(s => s.value === sortBy.value);
            const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
            setSortBy(SORT_OPTIONS[nextIndex]);
          }}
        >
          <Ionicons name="swap-vertical-outline" size={14} color={COLORS.textGray} />
          <Text style={styles.filterChipText}>{sortBy.label}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );

  const renderProject = ({ item }: { item: Project }) => (
    <ProjectCard
      project={item}
      onPress={() => handleProjectPress(item)}
      onStatusChange={(newStatus) => handleUpdateProject(item._id, { status: newStatus })}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="briefcase-outline" size={64} color={COLORS.textGray} />
      <Text style={styles.emptyText}>No projects found</Text>
      <Text style={styles.emptySubtext}>
        {search ? 'Try adjusting your search' : 'Create your first project to get started'}
      </Text>
      {!search && (
        <TouchableOpacity 
          style={styles.emptyButton}
          onPress={() => setIsAddModalVisible(true)}
        >
          <Text style={styles.emptyButtonText}>Create Project</Text>
        </TouchableOpacity>
      )}
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
          <Text style={styles.loadingText}>Loading projects...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Projects</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={syncPipelines}
            style={styles.headerButton}
            disabled={isSyncingPipelines}
          >
            {isSyncingPipelines ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Ionicons name="sync-outline" size={24} color={COLORS.accent} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setIsAddModalVisible(true)}
            style={styles.headerButton}
          >
            <Ionicons name="add-circle" size={28} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredProjects}
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
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApply={(filters) => {
          setPipelineFilter(filters.pipelineId || null);
          setIsFilterVisible(false);
        }}
        pipelines={pipelines}
        currentFilters={{
          pipelineId: pipelineFilter,
        }}
      />

      {/* Add Project Modal */}
      <AddProjectForm
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSubmit={handleAddProject}
        pipelines={pipelines}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    height: 44,
    ...SHADOW.small,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: RADIUS.card,
    ...SHADOW.small,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  statLabel: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 2,
  },
  filterChips: {
    marginBottom: 12,
  },
  filterChipsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginRight: 8,
    gap: 4,
    ...SHADOW.small,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
  },
  filterChipText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 20,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});