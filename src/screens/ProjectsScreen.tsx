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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import ProjectCard from '../components/ProjectCard';
import FilterModal from '../components/FilterModal';
import Modal from 'react-native-modal';
import AddProjectForm from '../components/AddProjectForm';
import ProjectDetail from '../components/ProjectDetail';

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
  const navigation = useNavigation();
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
  const [submitting, setSubmitting] = useState(false);

  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('http://192.168.0.62:3000/api/projects', {
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
                setSelectedProject(project);
                setIsDetailVisible(true);
              }}
            />
          ))}

          {!loading && Array.isArray(filtered) && filtered.length === 0 && (
            <Text style={styles.empty}>No projects match your filters.</Text>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddModalVisible(true)}
        >
          <Text style={styles.addIcon}>＋</Text>
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

        <Modal
          isVisible={isAddModalVisible}
          onBackdropPress={() => setIsAddModalVisible(false)}
          onSwipeComplete={() => setIsAddModalVisible(false)}
          swipeDirection="down"
          style={{ justifyContent: 'flex-end', margin: 0 }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                backgroundColor: 'white',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: '90%',
              }}
            >
              <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
                  Add Project
                </Text>

                <AddProjectForm
                  onSubmit={async (data) => {
                    try {
                      setSubmitting(true);
                      await axios.post('http://192.168.0.62:3000/api/projects', {
                        ...data,
                        locationId: user?.locationId,
                      });
                      setIsAddModalVisible(false);
                      fetchProjects();
                    } catch (error) {
                      console.error(error);
                      Alert.alert('Error', 'Failed to add project.');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  submitting={submitting}
                  locationId={user?.locationId}
                  onAddContactPress={() => {
                    setIsAddModalVisible(false);
                    navigation.navigate('AddContactScreen');
                  }}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <ProjectDetail
          isVisible={isDetailVisible}
          onClose={() => setIsDetailVisible(false)}
          project={selectedProject}
        />
      </View>
    </SafeAreaView>
  );
}

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
