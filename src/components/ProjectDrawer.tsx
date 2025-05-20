import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Modal from 'react-native-modal';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

interface Project {
  _id: string;
  title: string;
  contactName?: string;
  contactId: string;
  status?: string;
  notes?: string;
}

interface Props {
  isVisible: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function ProjectDetail({ isVisible, onClose, project }: Props) {
  const navigation = useNavigation();

  if (!project) return null;

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="right"
      animationIn="slideInRight"
      animationOut="slideOutRight"
      style={{ margin: 0, justifyContent: 'flex-end', alignItems: 'flex-end' }}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Project Details</Text>
            <TouchableOpacity
              onPress={() => {
                onClose();
                navigation.navigate('EditProjectScreen', {
                  projectId: project._id,
                });
              }}
            >
              <MaterialIcons name="edit" size={24} color="#00B3E6" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Title</Text>
          <Text style={styles.value}>{project.title}</Text>

          <Text style={styles.label}>Client</Text>
          <Text style={styles.value}>{project.contactName || '—'}</Text>

          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{project.status || '—'}</Text>

          <Text style={styles.label}>Notes</Text>
          <Text style={styles.value}>{project.notes || '—'}</Text>
        </ScrollView>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '80%',
    height: '100%',
    backgroundColor: 'white',
    padding: 24,
    paddingTop: 48,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 3, height: 0 },
    shadowRadius: 10,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1F36',
  },
  label: {
    marginTop: 16,
    fontSize: 13,
    color: '#AAB2BD',
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: '#1A1F36',
    marginTop: 4,
  },
  closeButton: {
    marginTop: 32,
    backgroundColor: '#00B3E6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
