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
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import ContactCard from '../components/ContactCard';
import FilterModal from '../components/FilterModal';
import Modal from 'react-native-modal';
import AddContactForm from '../components/AddContactForm';
import ContactDetail from '../components/ContactDetail';

interface Project {
  _id: string;
  title: string;
  status?: string;
  contactId: string;
  locationId: string;
}

interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  status: string;
  locationId: string;
  ghlContactId: string;
  projects?: Project[];
}

const topFilters = ['All', 'Open', 'Quoted'];

export default function ContactsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filtered, setFiltered] = useState<Contact[]>([]);
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
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const fetchContacts = async () => {
    try {
      const res = await axios.get('http://192.168.0.62:3000/api/contacts', {
        params: { locationId: user?.locationId },
      });
      setContacts(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContacts();
  }, []);

  useEffect(() => {
    if (user?.locationId) fetchContacts();
  }, [user?.locationId]);

  const applyFilters = () => {
    let result = [...contacts];

    if (topFilter !== 'All') {
      result = result.filter((c) => c.status === topFilter);
    }

    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    if (projectFilter.trim()) {
      result = result.filter((c) =>
        c.projects?.some((p) =>
          p.title.toLowerCase().includes(projectFilter.toLowerCase())
        )
      );
    }

    if (phoneFilter.trim()) {
      result = result.filter((c) =>
        c.phone?.toLowerCase().includes(phoneFilter.toLowerCase())
      );
    }

    setFiltered(result);
  };

  useEffect(() => {
    applyFilters();
  }, [search, topFilter, statusFilter, projectFilter, phoneFilter, contacts]);

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 32 }} />;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.header}>My Contacts</Text>

          <View style={styles.topBar}>
            <TextInput
              placeholder="Search name, email, or phone..."
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
                style={[
                  styles.pill,
                  topFilter === item && styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    topFilter === item && styles.pillTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.countText}>Total Contacts: {filtered.length}</Text>

          {filtered.map((contact) => (
            <ContactCard
              key={contact._id}
              name={`${contact.firstName} ${contact.lastName}`}
              email={contact.email}
              status={contact.status}
              project={contact.projects?.[0]?.title ?? '—'}
              onPress={() => {
                setSelectedContact(contact);
                setIsDetailVisible(true);
              }}
            />
          ))}

          {filtered.length === 0 && (
            <Text style={styles.empty}>No contacts match your filters.</Text>
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
          <View
            style={{
              backgroundColor: 'white',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 20,
              height: '65%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Add Contact
            </Text>

            <AddContactForm
              onSubmit={async (data) => {
                try {
                  setSubmitting(true);
                  await axios.post('http://192.168.0.62:3000/api/contacts', {
                    ...data,
                    status: 'Open',
                    locationId: user?.locationId,
                  });
                  setIsAddModalVisible(false);
                  fetchContacts(); // reload
                } catch (error) {
                  console.error(error);
                  Alert.alert('Error', 'Failed to add contact.');
                } finally {
                  setSubmitting(false);
                }
              }}
              submitting={submitting}
            />
          </View>
        </Modal>

        <ContactDetail
          isVisible={isDetailVisible}
          onClose={() => setIsDetailVisible(false)}
          contact={selectedContact}
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
});
