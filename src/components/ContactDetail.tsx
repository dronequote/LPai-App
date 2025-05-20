import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { getStrippedTitle } from '../utils/projectUtils';
import { Contact, Project } from '../types/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/StackNavigator';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  contact: Contact | null;
}

export default function ContactDetail({ isVisible, onClose, contact }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => {
    const fetchProjects = async () => {
      if (!contact?._id) return;
      setLoading(true);
      try {
        const res = await axios.get(`http://192.168.0.62:3000/api/projects/byContact`, {
          params: {
            contactId: contact._id,
            locationId: contact.locationId,
          },
        });

        setProjects(
          res.data.map((project: Project) => ({
            ...project,
            contactName: `${contact.firstName} ${contact.lastName}`,
          }))
        );
      } catch (err) {
        console.error('Failed to load projects for contact', err);
      } finally {
        setLoading(false);
      }
    };

    if (isVisible && contact?._id) {
      fetchProjects();
    }
  }, [contact, isVisible]);

  if (!isVisible || !contact) return null;

  const fullName = `${contact.firstName} ${contact.lastName}`;

  // Safe badge style lookup
  const getBadgeStyle = (status: string) => {
    const key = `badge_${status.replace(/\s/g, '')}` as keyof typeof styles;
    return styles[key] || {};
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Contact Details</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  onClose(); // close drawer first
                  setTimeout(() => {
                    navigation.navigate('EditContact', { contact });
                  }, 250);
                }}
              >
                <Ionicons name="pencil" size={22} color="#00B3E6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#00B3E6" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{fullName}</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{contact.email}</Text>

          {contact.phone && (
            <>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{contact.phone}</Text>
            </>
          )}

          {contact.address && (
            <>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{contact.address}</Text>
            </>
          )}

          {contact.status && (
            <>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{contact.status}</Text>
            </>
          )}

          <Text style={styles.label}>Notes</Text>
          <Text style={styles.value}>{contact.notes || '—'}</Text>

          <Text style={styles.label}>Projects</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#00B3E6" style={{ marginTop: 8 }} />
          ) : projects.length > 0 ? (
            projects.map((p) => (
              <View key={p._id} style={styles.projectCard}>
                <Text style={styles.projectTitle}>
                  {getStrippedTitle(p.title, p.contactName)}
                </Text>
                <View style={[styles.statusBadge, getBadgeStyle(p.status)]}>
                  <Text style={styles.badgeText}>{p.status}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.value}>No projects found</Text>
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
  projectCard: {
  marginTop: 12,
  marginHorizontal: 6, // ✅ adds breathing room on both sides
  padding: 16,
  backgroundColor: '#fff',
  borderRadius: 12,
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
},

  projectTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1F36',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  badge_Open: { backgroundColor: '#3498db' },
  badge_Quoted: { backgroundColor: '#f1c40f' },
  badge_Scheduled: { backgroundColor: '#9b59b6' },
  badge_JobComplete: { backgroundColor: '#2ecc71' },
});
