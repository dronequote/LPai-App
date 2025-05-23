import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Pipeline {
  id: string;
  name: string;
}

interface Props {
  onSubmit: (data: any) => void;
  submitting: boolean;
  onAddContactPress: () => void;
  locationId?: string;
}

export default function AddProjectForm({ onSubmit, submitting, onAddContactPress }: Props) {
  const { user } = useAuth();
  const locationId = user?.locationId;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedPipelineName, setSelectedPipelineName] = useState('');

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Open');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<{ [key: string]: string }>({});

  // --- Fetch Contacts ---
  useEffect(() => {
    if (!locationId) return;
    const fetchContacts = async () => {
      try {
        const res = await api.get('/api/contacts', {
          params: { locationId },
        });
        setContacts(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch contacts:', err);
      }
    };
    fetchContacts();
  }, [locationId]);

  useEffect(() => {
    const q = contactSearch.toLowerCase();
    const matches = contacts.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
    setFilteredContacts(matches);
  }, [contactSearch, contacts]);

  // --- Load Pipelines from DB ---
  useEffect(() => {
    if (!locationId) return;

    const loadPipelines = async () => {
      try {
        // Only fetch from locations DB (pipelines already synced by ProjectsScreen)
        const locRes = await api.get('/api/locations/byLocation', {
          params: { locationId },
        });
        const mongoPipes = locRes.data?.pipelines || [];
        setPipelines(mongoPipes);
        // Auto-select first pipeline if any
        if (mongoPipes.length) {
          setSelectedPipelineId(mongoPipes[0].id);
          setSelectedPipelineName(mongoPipes[0].name);
        } else {
          setSelectedPipelineId('');
          setSelectedPipelineName('');
        }
        console.log('[AddProjectForm] Pipelines loaded from DB:', mongoPipes);
      } catch (err) {
        setPipelines([]);
        setSelectedPipelineId('');
        setSelectedPipelineName('');
        console.error('❌ Failed to fetch pipelines from DB:', err);
      }
    };

    loadPipelines();
  }, [locationId]);

  // --- Handle Pipeline Picker Change ---
  const handlePipelineChange = (id: string) => {
    setSelectedPipelineId(id);
    const found = pipelines.find((p) => p.id === id);
    setSelectedPipelineName(found?.name || '');
    console.log('[AddProjectForm] User selected pipeline:', found);
  };

  // --- Submit ---
  const handleSubmit = () => {
    if (!selectedContact || !user || !locationId) return;
    const fullTitle = `${selectedContact.firstName} ${selectedContact.lastName} – ${title}`;
    onSubmit({
      contactId: selectedContact._id,
      userId: user.userId,
      locationId,
      title: fullTitle,
      status,
      notes,
      pipelineId: selectedPipelineId,
      pipelineName: selectedPipelineName,
      ...customFields,
    });
  };

  return (
    <View>
      <Text style={styles.label}>Contact</Text>
      {!selectedContact ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Search by name, phone, or email"
            value={contactSearch}
            onChangeText={setContactSearch}
          />
          {filteredContacts.length > 0 ? (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setSelectedContact(item)}>
                  <Text style={styles.resultItem}>
                    {item.firstName} {item.lastName} — {item.email}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.resultsList}
            />
          ) : (
            <TouchableOpacity onPress={onAddContactPress}>
              <Text style={styles.addNew}>+ Add New Contact</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.selectedBox}>
          <Text style={styles.meta}>
            {selectedContact.firstName} {selectedContact.lastName}
          </Text>
          <TouchableOpacity onPress={() => setSelectedContact(null)}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- Pipeline Picker --- */}
      <Text style={[styles.label, !selectedContact && styles.disabled]}>Pipeline</Text>
      {pipelines.length > 0 ? (
        <Picker
          enabled={!!selectedContact}
          selectedValue={selectedPipelineId}
          onValueChange={handlePipelineChange}
          style={styles.input}
        >
          {pipelines.map((pipe) => (
            <Picker.Item key={pipe.id} label={pipe.name} value={pipe.id} />
          ))}
        </Picker>
      ) : (
        <Text style={{ color: '#aaa', marginBottom: 8 }}>No pipelines found.</Text>
      )}

      <Text style={[styles.label, !selectedContact && styles.disabled]}>Title</Text>
      <TextInput
        editable={!!selectedContact}
        placeholder="Project title"
        style={styles.input}
        value={title}
        onChangeText={setTitle}
      />

      {/* Status is always Open for new projects sent to GHL */}


      <Text style={[styles.label, !selectedContact && styles.disabled]}>Notes</Text>
      <TextInput
        editable={!!selectedContact}
        style={[styles.input, { height: 100 }]}
        multiline
        placeholder="Optional notes..."
        value={notes}
        onChangeText={setNotes}
      />

      {/* Example: add custom field for "Scope of Work" */}
      <Text style={[styles.label, !selectedContact && styles.disabled]}>Scope of Work</Text>
      <TextInput
        editable={!!selectedContact}
        style={styles.input}
        placeholder="Describe scope of work"
        value={customFields.scopeOfWork || ''}
        onChangeText={(val) => setCustomFields((f) => ({ ...f, scopeOfWork: val }))}
      />

      <TouchableOpacity
        style={[styles.button, !selectedContact && styles.disabledBtn]}
        disabled={!selectedContact || submitting}
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>Create Project</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', marginBottom: 6, marginTop: 18, color: '#1A1F36' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  disabled: { color: '#ccc' },
  resultItem: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultsList: { maxHeight: 150, marginBottom: 6 },
  selectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  meta: { fontSize: 16, fontWeight: '600' },
  clearText: { color: '#00B3E6', fontWeight: '600' },
  addNew: { color: '#00B3E6', fontStyle: 'italic', marginTop: 4 },
  statusOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  selectedStatus: {
    backgroundColor: '#00B3E6',
    borderColor: '#00B3E6',
  },
  button: {
    backgroundColor: '#00B3E6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  disabledBtn: { backgroundColor: '#ccc' },
});
