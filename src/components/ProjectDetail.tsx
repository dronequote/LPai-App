import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStrippedTitle } from '../utils/projectUtils';
import { Project as BaseProject } from '../types/types';

interface ExtendedProject extends BaseProject {
  contactName?: string;
  phone?: string;
  email?: string;
}

interface ProjectDetailProps {
  isVisible: boolean;
  onClose: () => void;
  project: ExtendedProject | null;
}


export default function ProjectDetail({ isVisible, onClose, project }: ProjectDetailProps) {
  if (!isVisible || !project) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Project Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#00B3E6" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Title</Text>
          <Text style={styles.projectTitle}>
            {getStrippedTitle(project.title, project.contactName)}
          </Text>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{project.status}</Text>

          <Text style={styles.label}>Client</Text>
          <Text style={styles.value}>{project.contactName || '—'}</Text>

          {project.phone && (
            <>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{project.phone}</Text>
            </>
          )}

          {project.email && (
            <>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{project.email}</Text>
            </>
          )}

          {project.notes && (
            <>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.value}>{project.notes}</Text>
            </>
          )}

          {project.createdAt && (
            <>
              <Text style={styles.label}>Created</Text>
              <Text style={styles.value}>
                {new Date(project.createdAt).toLocaleDateString()}
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: Dimensions.get('window').width * 0.9,
    height: '100%',
    backgroundColor: '#fff',
    zIndex: 100,
    elevation: 10,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: -3, height: 0 },
  },
  container: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1F36',
  },
  label: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#AAB2BD',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1F36',
    marginTop: 4,
  },
  projectTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: '#1A1F36',
  marginTop: 4,
},

});
