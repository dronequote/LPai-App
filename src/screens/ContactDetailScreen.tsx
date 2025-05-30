import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import CompactAppointmentCard from '../components/CompactAppointmentCard';
import ProjectCard from '../components/ProjectCard';
import CreateAppointmentModal from '../components/CreateAppointmentModal';
import AddProjectForm from '../components/AddProjectForm';
import type { Contact, Project, Appointment } from '@lp-ai/types';

type ContactDetailRouteParams = {
  contact: Contact;
};

export default function ContactDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { calendarMap } = useCalendar();
  
  const { contact: initialContact } = route.params as ContactDetailRouteParams;

  const [contact, setContact] = useState<Contact>(initialContact);
  const [projects, setProjects] = useState<Project[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Modal states
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [isSyncingPipelines, setIsSyncingPipelines] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch contact details, projects, and appointments
  useEffect(() => {
    const fetchContactData = async () => {
      try {
        setLoading(true);
        
        // Set form fields from initial contact
        setFirstName(contact.firstName || '');
        setLastName(contact.lastName || '');
        setEmail(contact.email || '');
        setPhone(contact.phone || '');
        setAddress(contact.address || '');
        setNotes(contact.notes || '');

        // Fetch projects for this contact
        const projectsRes = await api.get('/api/projects/byContact', {
          params: {
            contactId: contact._id,
            locationId: user?.locationId,
          },
        });
        setProjects(projectsRes.data || []);

        // Fetch appointments for this contact
        const appointmentsRes = await api.get('/api/appointments', {
          params: { locationId: user?.locationId },
        });
        
        // Filter appointments for this contact and get upcoming ones
        const now = new Date();
        const contactAppointments = (appointmentsRes.data || [])
          .filter(apt => apt.contactId === contact._id)
          .filter(apt => new Date(apt.start || apt.time) > now)
          .sort((a, b) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime())
          .slice(0, 5); // Show next 5 appointments
        
        setAppointments(contactAppointments);

        // Fetch all contacts for appointment modal
        const contactsRes = await api.get('/api/contacts', {
          params: { locationId: user?.locationId },
        });
        setAllContacts(contactsRes.data || []);

      } catch (err) {
        console.error('Failed to fetch contact data:', err);
        Alert.alert('Error', 'Failed to load contact details');
      } finally {
        setLoading(false);
      }
    };

    if (contact._id && user?.locationId) {
      fetchContactData();
    }
  }, [contact._id, user?.locationId]);

  const handleSave = async () => {
    if (!firstName || !lastName || !email || !phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    try {
      setSaving(true);
      const updatedContact = await api.patch(`/api/contacts/${contact._id}`, {
        firstName,
        lastName,
        email,
        phone,
        address,
        notes,
      });
      
      // Update local state
      setContact({ ...contact, firstName, lastName, email, phone, address, notes });
      setEditing(false);
      Alert.alert('Success', 'Contact updated successfully');
    } catch (err) {
      console.error('Failed to update contact:', err);
      Alert.alert('Error', 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleProjectPress = (project: Project) => {
    navigation.navigate('ProjectDetailScreen', { project });
  };

  const handleAppointmentPress = (appointment: Appointment) => {
    navigation.navigate('AppointmentDetailScreen', { 
      appointmentId: appointment._id 
    });
  };

  const handleScheduleAppointment = () => {
    setShowCreateAppointment(true);
  };

  const handleStartProject = async () => {
    if (!user?.locationId) {
      Alert.alert('Error', 'Missing location ID');
      return;
    }
    
    // Sync pipelines before opening the modal
    setIsSyncingPipelines(true);
    try {
      await api.get(`/api/ghl/pipelines/${user.locationId}`);
    } catch (e) {
      console.error('[ContactDetailScreen] Failed to sync pipelines:', e);
    }
    setIsSyncingPipelines(false);
    setShowAddProject(true);
  };

  const handleCreateAppointment = async (appointmentData: any) => {
    try {
      await api.post('/api/appointments', appointmentData);
      setShowCreateAppointment(false);
      
      // Refresh appointments
      const appointmentsRes = await api.get('/api/appointments', {
        params: { locationId: user?.locationId },
      });
      const now = new Date();
      const contactAppointments = (appointmentsRes.data || [])
        .filter(apt => apt.contactId === contact._id)
        .filter(apt => new Date(apt.start || apt.time) > now)
        .sort((a, b) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime())
        .slice(0, 5);
      setAppointments(contactAppointments);
      
      Alert.alert('Success', 'Appointment created successfully');
    } catch (err) {
      console.error('Failed to create appointment:', err);
      Alert.alert('Error', 'Failed to create appointment');
    }
  };

  const handleCreateProject = async (projectData: any) => {
    try {
      const response = await api.post('/api/projects', {
        ...projectData,
        locationId: user?.locationId,
      });
      
      setShowAddProject(false);
      
      // Refresh projects
      const projectsRes = await api.get('/api/projects/byContact', {
        params: {
          contactId: contact._id,
          locationId: user?.locationId,
        },
      });
      setProjects(projectsRes.data || []);
      
      Alert.alert('Success', 'Project created successfully');
      
      // Navigate to the new project detail screen
      const newProject = { 
        _id: response.data.projectId, 
        ...projectData 
      };
      navigation.navigate('ProjectDetailScreen', { project: newProject });
    } catch (err) {
      console.error('Failed to create project:', err);
      Alert.alert('Error', 'Failed to create project');
    }
  };

  const handleCallContact = () => {
    const phoneUrl = `tel:${contact.phone}`;
    Alert.alert(
      'Call Contact',
      `Call ${contact.firstName} ${contact.lastName} at ${contact.phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => {
          // In a real app, you'd use Linking.openURL(phoneUrl)
          console.log('Calling:', phoneUrl);
        }}
      ]
    );
  };

  const handleTextContact = () => {
    const smsUrl = `sms:${contact.phone}`;
    Alert.alert(
      'Text Contact',
      `Send text to ${contact.firstName} ${contact.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Text', onPress: () => {
          // In a real app, you'd use Linking.openURL(smsUrl)
          console.log('Texting:', smsUrl);
        }}
      ]
    );
  };

  const handleEmailContact = () => {
    const emailUrl = `mailto:${contact.email}`;
    Alert.alert(
      'Email Contact',
      `Send email to ${contact.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email', onPress: () => {
          // In a real app, you'd use Linking.openURL(emailUrl)
          console.log('Emailing:', emailUrl);
        }}
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Details</Text>
          <TouchableOpacity 
            onPress={() => setEditing(!editing)}
            style={styles.editButton}
          >
            <Ionicons 
              name={editing ? "close" : "pencil"} 
              size={20} 
              color={COLORS.accent} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            {/* First Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>First Name</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                />
              ) : (
                <Text style={styles.value}>{contact.firstName}</Text>
              )}
            </View>

            {/* Last Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Last Name</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                />
              ) : (
                <Text style={styles.value}>{contact.lastName}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.value}>{contact.email}</Text>
              )}
            </View>

            {/* Phone */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Phone</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.value}>{contact.phone}</Text>
              )}
            </View>

            {/* Address */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Address</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address"
                />
              ) : (
                <Text style={styles.value}>{contact.address || 'No address provided'}</Text>
              )}
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Notes</Text>
              {editing ? (
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes"
                  multiline
                  numberOfLines={3}
                />
              ) : (
                <Text style={styles.value}>{contact.notes || 'No notes'}</Text>
              )}
            </View>

            {/* Save button when editing */}
            {editing && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Actions */}
          {!editing && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={handleCallContact}>
                  <Ionicons name="call" size={20} color={COLORS.accent} />
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleTextContact}>
                  <Ionicons name="chatbubble" size={20} color={COLORS.accent} />
                  <Text style={styles.actionText}>Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleEmailContact}>
                  <Ionicons name="mail" size={20} color={COLORS.accent} />
                  <Text style={styles.actionText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Upcoming Appointments */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              {!editing && (
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={handleScheduleAppointment}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addButtonText}>Schedule</Text>
                </TouchableOpacity>
              )}
            </View>
            {appointments.length === 0 ? (
              <Text style={styles.emptyText}>No upcoming appointments</Text>
            ) : (
              appointments.map((appointment) => (
                <CompactAppointmentCard
                  key={appointment._id}
                  appointment={appointment}
                  contact={contact}
                  calendar={calendarMap[appointment.calendarId]}
                  onPress={() => handleAppointmentPress(appointment)}
                />
              ))
            )}
          </View>

          {/* Projects */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Projects</Text>
              {!editing && (
                <TouchableOpacity 
                  style={[
                    styles.addButton,
                    isSyncingPipelines && { opacity: 0.6 }
                  ]} 
                  onPress={handleStartProject}
                  disabled={isSyncingPipelines}
                >
                  <Ionicons 
                    name={isSyncingPipelines ? "sync" : "add"} 
                    size={16} 
                    color="#fff" 
                  />
                  <Text style={styles.addButtonText}>
                    {isSyncingPipelines ? 'Loading...' : 'Start Project'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {projects.length === 0 ? (
              <Text style={styles.emptyText}>No projects found</Text>
            ) : (
              projects.map((project) => (
                <ProjectCard
                  key={project._id}
                  title={project.title}
                  name={`${contact.firstName} ${contact.lastName}`}
                  email={contact.email}
                  phone={contact.phone}
                  status={project.status}
                  onPress={() => handleProjectPress(project)}
                />
              ))
            )}
          </View>

          {/* Bottom padding */}
          <View style={{ height: 50 }} />
        </ScrollView>

        {/* Create Appointment Modal */}
        <CreateAppointmentModal
          visible={showCreateAppointment}
          onClose={() => setShowCreateAppointment(false)}
          onSubmit={handleCreateAppointment}
          contacts={allContacts}
          preSelectedContact={contact}
        />

        {/* Add Project Modal - Updated to use new standalone modal */}
        <AddProjectForm
          visible={showAddProject}
          onClose={() => setShowAddProject(false)}
          onSubmit={handleCreateProject}
          onAddContactPress={() => {
            setShowAddProject(false);
            // Could navigate to add contact if needed
          }}
          preSelectedContact={contact}
          isModal={true} // Use as standalone modal
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    ...SHADOW.card,
  },
  headerTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
  },
  addButtonText: {
    color: '#fff',
    fontSize: FONT.meta,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.button,
    minWidth: 80,
    ...SHADOW.card,
  },
  actionText: {
    fontSize: FONT.meta,
    fontWeight: '500',
    color: COLORS.accent,
    marginTop: 4,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: FONT.label,
    fontWeight: '600',
    color: COLORS.textGray,
    marginBottom: 8,
  },
  value: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    padding: 12,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: FONT.meta,
    color: COLORS.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
});