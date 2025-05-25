import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStrippedTitle } from '../utils/projectUtils';
import { Contact, Project } from '../../packages/types/dist';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/StackNavigator';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  contact: Contact | null;
}

export default function ContactDetail({ isVisible, onClose, contact }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncedContact, setSyncedContact] = useState<Contact | null>(contact);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();

  useEffect(() => {
    const syncAndLoad = async () => {
      if (!contact?._id) return;
      setLoading(true);
      let updated = contact;

      try {
        // 1. 🔄 Sync with GHL if GHL contact exists
        if (contact.ghlContactId) {
          console.log('[ContactDetail] Attempting to sync contact from /api/ghl/[id]');
          try {
            // GET request to your backend sync endpoint
            const syncRes = await api.get(
              `/api/ghl/${contact._id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            updated = syncRes.data.contact;
            if (syncRes.data.synced) {
              console.log('[ContactDetail] Contact was synced from GHL');
            } else {
              console.log('[ContactDetail] Contact already in sync with GHL');
            }
          } catch (err: any) {
            // Log out error response
            console.error('[ContactDetail] Error syncing contact:', err?.response?.data || err?.message || err);
            Alert.alert('Sync Error', `Failed to sync contact from GHL: ${err?.response?.data?.error || err.message || 'Unknown error'}`);
          }
        } else {
          console.log('[ContactDetail] No GHL contact ID found, skipping sync.');
        }

        setSyncedContact(updated);

        // 2. 📦 Fetch Projects
        try {
          const projRes = await api.get('/api/projects/byContact', {
            params: {
              contactId: updated._id,
              locationId: updated.locationId,
            },
            headers: { Authorization: `Bearer ${token}` },
          });

          setProjects(
            projRes.data.map((project: Project) => ({
              ...project,
              contactName: `${updated.firstName} ${updated.lastName}`,
            }))
          );
        } catch (projErr: any) {
          console.error('[ContactDetail] Failed to fetch projects:', projErr?.response?.data || projErr?.message || projErr);
        }
      } catch (err) {
        console.error('[ContactDetail] Unexpected error in syncAndLoad:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isVisible && contact?._id) {
      syncAndLoad();
    }
  }, [isVisible, contact?._id, token]);

  if (!isVisible || !syncedContact) return null;

  const fullName = `${syncedContact.firstName} ${syncedContact.lastName}`;
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
                  onClose();
                  setTimeout(() => {
                    navigation.navigate('ContactDetailScreen', { contact: syncedContact });
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
          <Text style={styles.value}>{syncedContact.email}</Text>

          {syncedContact.phone && (
            <>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{syncedContact.phone}</Text>
            </>
          )}

          {syncedContact.address && (
            <>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{syncedContact.address}</Text>
            </>
          )}

          {syncedContact.status && (
            <>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{syncedContact.status}</Text>
            </>
          )}

          <Text style={styles.label}>Notes</Text>
          <Text style={styles.value}>{syncedContact.notes || '—'}</Text>

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
  // ... (styles unchanged)
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
  container: { flex: 1, padding: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: { fontSize: 22, fontWeight: '700', color: '#1A1F36' },
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
    marginHorizontal: 6,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  projectTitle: { fontSize: 15, fontWeight: '600', color: '#1A1F36' },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  badge_Open: { backgroundColor: '#3498db' },
  badge_Quoted: { backgroundColor: '#f1c40f' },
  badge_Scheduled: { backgroundColor: '#9b59b6' },
  badge_JobComplete: { backgroundColor: '#2ecc71' },
});
