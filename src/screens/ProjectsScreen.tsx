import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/StackNavigator';
import ProjectCard from '../components/ProjectCard';
import FilterModal from '../components/FilterModal';
import AddProjectForm from '../components/AddProjectForm';
import api from '../lib/api';

type ProjectsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Projects'>;

interface Project {
  _id: string;
  title: string;
  contactName?: string;
  status: string;
  phone?: string;
  locationId: string;
  createdAt: string;
}

const topFilters = ['All', 'Scheduled', 'In Progress', 'Job Complete'];

export default function ProjectsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<ProjectsScreenNavigationProp>();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [topFilter, setTopFilter] = useState('All');

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSyncingPipelines, setIsSyncingPipelines] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/api/projects', {
        params: { locationId: user?.locationId },
      });
      setProjects(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProjects();
  }, []);

  useEffect(() => {
    if (user?.locationId) fetchProjects();
  }, [user?.locationId]);

  const applyFilters = () => {
    let result = [...projects];

    if (topFilter !== 'All') {
      result = result.filter((p) => p.status === topFilter);
    }

    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.contactName?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q)
      );
    }

    if (projectFilter.trim()) {
      result = result.filter((p) =>
        p.title.toLowerCase().includes(projectFilter.toLowerCase())
      );
    }

    if (phoneFilter.trim()) {
      result = result.filter((p) =>
        p.phone?.toLowerCase().includes(phoneFilter.toLowerCase())
      );
    }

    setFiltered(result);
  };

  useEffect(() => {
    applyFilters();
  }, [search, topFilter, statusFilter, projectFilter, phoneFilter, projects]);

  const handleAddProject = async () => {
    if (!user?.locationId) {
      Alert.alert('Error', 'Missing location ID');
      return;
    }
    setIsSyncingPipelines(true);
    try {
      await api.get(`/api/ghl/pipelines/${user.locationId}`);
    } catch (e) {
      console.error('[ProjectsScreen] Failed to sync pipelines:', e);
    }
    setIsSyncingPipelines(false);
    setIsAddModalVisible(true);
  };

  const handleProjectSubmit = async (projectData: any) => {
    try {
      const response = await api.post('/api/projects', {
        ...projectData,
        locationId: user?.locationId,
      });
      
      setIsAddModalVisible(false);
      await fetchProjects();
      
      // Navigate to the new project detail screen
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

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 32 }} />;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.header}>My Projects</Text>

          <View style={styles.topBar}>
            <TextInput
              placeholder="Search title, contact, or phone..."
              value={search}
              onChangeText={setSearch}
              style={styles.search}
              placeholderTextColor="#AAB2BD"
            />
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setIsFilterVisible(true)}
            >
              <Text style={styles.filterButtonText}>Filter</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            {topFilters.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setTopFilter(item)}
                style={[styles.pill, topFilter === item && styles.pillActive]}
              >
                <Text style={[styles.pillText, topFilter === item && styles.pillTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.countText}>Total Projects: {filtered.length}</Text>

          {(statusFilter || projectFilter || phoneFilter) && (
            <View style={styles.activeFilters}>
              <Text style={styles.filterText}>Filters applied</Text>
              <TouchableOpacity
                onPress={() => {
                  setStatusFilter(null);
                  setProjectFilter('');
                  setPhoneFilter('');
                }}
              >
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {filtered.map((project) => (
            <ProjectCard
              key={project._id}
              title={project.title}
              name={project.contactName}
              phone={project.phone}
              status={project.status}
              onPress={() => {
                navigation.navigate('ProjectDetailScreen', { project });
              }}
            />
          ))}

          {!loading && Array.isArray(filtered) && filtered.length === 0 && (
            <Text style={styles.empty}>No projects match your filters.</Text>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddProject}
          disabled={isSyncingPipelines}
        >
          <Text style={styles.addIcon}>{isSyncingPipelines ? '⏳' : '＋'}</Text>
        </TouchableOpacity>

        <FilterModal
          isVisible={isFilterVisible}
          onClose={() => setIsFilterVisible(false)}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          projectFilter={projectFilter}
          setProjectFilter={setProjectFilter}
          phoneFilter={phoneFilter}
          setPhoneFilter={setPhoneFilter}
          onClear={() => {
            setStatusFilter(null);
            setProjectFilter('');
            setPhoneFilter('');
          }}
        />

        {/* Updated AddProjectForm Modal */}
        <AddProjectForm
          visible={isAddModalVisible}
          onClose={() => setIsAddModalVisible(false)}
          onSubmit={handleProjectSubmit}
          onAddContactPress={() => {
            setIsAddModalVisible(false);
            setTimeout(() => navigation.navigate('AddContactScreen'), 300);
          }}
          isModal={true} // Use as standalone modal
        />
      </View>
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { fontSize: 26, fontWeight: '700', marginTop: 16, marginBottom: 12, color: '#1A1F36' },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  search: {
    flex: 1,
    backgroundColor: '#F1F2F6',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    marginRight: 8,
    color: '#1A1F36',
  },
  filterButton: {
    backgroundColor: '#00B3E6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  filterButtonText: { color: '#fff', fontWeight: '600' },
  filterRow: { flexDirection: 'row', marginBottom: 12 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F2F6',
    marginRight: 8,
  },
  pillText: { color: '#1A1F36', fontSize: 14 },
  pillActive: { backgroundColor: '#00B3E6' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  countText: { fontSize: 14, color: '#AAB2BD', marginBottom: 8 },
  empty: { textAlign: 'center', color: '#AAB2BD', marginTop: 32 },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#00B3E6',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 6,
  },
  addIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F2F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  filterText: {
    color: '#1A1F36',
    fontSize: 13,
    marginRight: 12,
  },
  clearText: {
    color: '#00B3E6',
    fontWeight: '600',
    fontSize: 13,
  },
});