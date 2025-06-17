// src/components/ProjectSelectorModal.tsx
// Updated: 2025-06-17
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';

interface Project {
  _id: string;
  title: string;
  contactName: string;
  status: string;
}

interface ProjectSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectProject: (project: Project) => void;
  title: string;
  actionType: 'photo' | 'quote' | 'payment';
}

export default function ProjectSelectorModal({
  visible,
  onClose,
  onSelectProject,
  title,
  actionType,
}: ProjectSelectorModalProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadProjects();
    }
  }, [visible]);

  useEffect(() => {
    filterProjects();
  }, [searchQuery, projects]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.list(user?.locationId || '');
      
      // Filter out completed projects
      const activeProjects = data.filter(
        (p: any) => !['Completed', 'Cancelled'].includes(p.status)
      );
      
      setProjects(activeProjects);
      setFilteredProjects(activeProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    if (!searchQuery.trim()) {
      setFilteredProjects(projects);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = projects.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.contactName?.toLowerCase().includes(query)
    );
    setFilteredProjects(filtered);
  };

  const handleSelectProject = (project: Project) => {
    onSelectProject(project);
    setSearchQuery('');
  };

  const getActionIcon = () => {
    switch (actionType) {
      case 'photo':
        return 'camera';
      case 'quote':
        return 'document-text';
      case 'payment':
        return 'card';
      default:
        return 'folder';
    }
  };

  const getActionColor = () => {
    switch (actionType) {
      case 'photo':
        return '#00B3E6';
      case 'quote':
        return '#27AE60';
      case 'payment':
        return '#9B59B6';
      default:
        return COLORS.accent;
    }
  };

  const renderProject = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={styles.projectItem}
      onPress={() => handleSelectProject(item)}
      activeOpacity={0.7}
    >
      <View style={styles.projectInfo}>
        <Text style={styles.projectTitle}>{item.title}</Text>
        <Text style={styles.projectClient}>{item.contactName}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return '#00B3E6';
      case 'In Progress':
        return '#27AE60';
      case 'Quoted':
        return '#F39C12';
      default:
        return COLORS.textGray;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Ionicons name={getActionIcon() as any} size={24} color={getActionColor()} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects or clients..."
            placeholderTextColor={COLORS.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Projects List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading projects...</Text>
          </View>
        ) : filteredProjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No projects found' : 'No active projects'}
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                onClose();
                // Navigate to create project
              }}
            >
              <Text style={styles.createButtonText}>Create New Project</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredProjects}
            keyExtractor={(item) => item._id}
            renderItem={renderProject}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.input,
    gap: 12,
    ...SHADOW.card,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  listContent: {
    padding: 20,
  },
  projectItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.card,
  },
  projectInfo: {
    flex: 1,
    marginRight: 12,
  },
  projectTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  projectClient: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
  },
  createButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
});