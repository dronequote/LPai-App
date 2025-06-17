// src/screens/ContactsScreen.tsx
// Updated: 2025-01-06
// Using services instead of direct API calls

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
import { contactService } from '../services/contactService';
import ContactCard from '../components/ContactCard';
import FilterModal from '../components/FilterModal';
import AddContactForm from '../components/AddContactForm';
import ContactDetail from '../components/ContactDetail';
import { Contact, Project } from '../../packages/types/dist';

const topFilters = ['All', 'Open', 'Quoted', 'Scheduled'];

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

  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const fetchContacts = async () => {
    if (!user?.locationId) {
      setLoading(false);
      return;
    }

    try {
      // Check if we should use getWithProjects or regular list
      const data = await contactService.getWithProjects 
        ? await contactService.getWithProjects(user.locationId)
        : await contactService.list(user.locationId, { includeProjects: true });
      
      // Ensure data is an array
      const contactsArray = Array.isArray(data) ? data : [];
      
      setContacts(contactsArray);
      setFiltered(contactsArray);
    } catch (err) {
      console.error('Failed to fetch contacts with projects:', err);
      // Set empty arrays on error
      setContacts([]);
      setFiltered([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContacts();
  }, [user?.locationId]);

  useEffect(() => {
    if (user?.locationId) fetchContacts();
  }, [user?.locationId]);

  const applyFilters = () => {
    if (!Array.isArray(contacts)) {
      setFiltered([]);
      return;
    }

    let result = [...contacts];

    if (topFilter !== 'All') {
      result = result.filter((c) => {
        const sorted = [...(c.projects || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const latest = sorted[0];
        return latest?.status === topFilter;
      });
    }

    if (statusFilter) {
      result = result.filter((c) => {
        const sorted = [...(c.projects || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const latest = sorted[0];
        return latest?.status === statusFilter;
      });
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

  const handleCreateContact = async (contactData: any) => {
    if (!user?.locationId) {
      Alert.alert('Error', 'Location information missing');
      return;
    }

    try {
      const newContact = await contactService.create({
        ...contactData,
        locationId: user.locationId,
      });
      
      setIsAddModalVisible(false);
      await fetchContacts();
      
      // Navigate to the new contact detail screen
      navigation.navigate('ContactDetailScreen', { contact: newContact });
    } catch (error) {
      console.error('Failed to create contact:', error);
      Alert.alert('Error', 'Failed to create contact. Please try again.');
    }
  };

  const validContacts = filtered.filter(
    (c) =>
      c &&
      typeof c._id === 'string' &&
      typeof c.firstName === 'string' &&
      typeof c.lastName === 'string' &&
      typeof c.email === 'string' &&
      typeof c.phone === 'string'
  );

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
                style={[styles.pill, topFilter === item && styles.pillActive]}
              >
                <Text style={[styles.pillText, topFilter === item && styles.pillTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.countText}>Total Contacts: {validContacts.length}</Text>

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

          {validContacts.map((contact) => (
            <ContactCard
              key={contact._id}
              name={`${contact.firstName} ${contact.lastName}`}
              email={contact.email}
              phone={contact.phone}
              projects={contact.projects || []}
              onPress={() => {
                // Navigate directly to ContactDetailScreen
                navigation.navigate('ContactDetailScreen', { contact });
              }}
            />
          ))}

          {validContacts.length === 0 && (
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

        {/* Updated AddContactForm Modal */}
        <AddContactForm
          visible={isAddModalVisible}
          onClose={() => setIsAddModalVisible(false)}
          onSubmit={handleCreateContact}
          isModal={true} // Use as standalone modal
        />

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