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
// ADD THESE SERVICE IMPORTS
import { contactService } from '../services/contactService';
import { projectService } from '../services/projectService';
import { appointmentService } from '../services/appointmentService';
import { locationService } from '../services/locationService';
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

      // CHANGED: Fetch projects for this contact
      try {
        const projectsData = await projectService.list(user?.locationId, {
          contactId: contact._id,
          limit: 50,
        });
        setProjects(Array.isArray(projectsData) ? projectsData : []);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
        setProjects([]);
      }

      // CHANGED: Fetch appointments
      try {
        const appointmentsData = await appointmentService.list(user?.locationId, {
          limit: 100,
        });
        
        // Filter appointments for this contact and get upcoming ones
        const now = new Date();
        const contactAppointments = (Array.isArray(appointmentsData) ? appointmentsData : [])
          .filter(apt => apt.contactId === contact._id)
          .filter(apt => new Date(apt.start || apt.time) > now)
          .sort((a, b) => new Date(a.start || a.time).getTime() - new Date(b.start || b.time).getTime())
          .slice(0, 5); // Show next 5 appointments
        
        setAppointments(contactAppointments);
      } catch (err) {
        console.error('Failed to fetch appointments:', err);
        setAppointments([]);
      }

      // CHANGED: Fetch all contacts for appointment modal
      try {
        const contactsData = await contactService.list(user?.locationId, { limit: 100 });
        setAllContacts(Array.isArray(contactsData) ? contactsData : []);
      } catch (err) {
        console.error('Failed to fetch contacts:', err);
        setAllContacts([]);
      }

    } catch (err) {
      console.error('Failed to fetch contact data:', err);
      Alert.alert('Error', 'Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  // Sync pipelines from GHL
  const syncPipelines = async () => {
    if (!user?.locationId) return;
    
    setIsSyncingPipelines(true);
    try {
      // CHANGED: Use locationService
      await locationService.syncPipelines(user.locationId);
      Alert.alert('Success', 'Pipelines synced successfully');
      // You might want to refresh project data here
      fetchContactData();
    } catch (err) {
      console.error('Failed to sync pipelines:', err);
      Alert.alert('Error', 'Failed to sync pipelines');
    } finally {
      setIsSyncingPipelines(false);
    }
  };

  useEffect(() => {
    if (contact._id && user?.locationId) {
      fetchContactData();
    }
  }, [contact._id, user?.locationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        firstName,
        lastName,
        email,
        phone,
        address,
        notes,
      };

      // CHANGED: Use contactService
      const updatedContact = await contactService.update(contact._id, updateData);
      setContact(updatedContact);
      setEditing(false);
      Alert.alert('Success', 'Contact updated successfully');
    } catch (err) {
      console.error('Failed to update contact:', err);
      Alert.alert('Error', 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAppointment = async (appointmentData: any) => {
    try {
      // CHANGED: Use appointmentService
      await appointmentService.create(appointmentData);
      setShowCreateAppointment(false);
      fetchContactData(); // Refresh data
      Alert.alert('Success', 'Appointment created successfully');
    } catch (err) {
      console.error('Failed to create appointment:', err);
      Alert.alert('Error', 'Failed to create appointment');
    }
  };

  const handleCreateProject = async (projectData: any) => {
    try {
      // CHANGED: Use projectService
      const newProject = await projectService.create(projectData);
      setShowAddProject(false);
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
                  style={[styles.input, styles.textArea]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address"
                  multiline
                  numberOfLines={2}
                />
              ) : (
                <Text style={styles.value}>{contact.address || '—'}</Text>
              )}
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Notes</Text>
              {editing ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes"
                  multiline
                  numberOfLines={4}
                />
              ) : (
                <Text style={styles.value}>{contact.notes || '—'}</Text>
              )}
            </View>

            {/* Save/Cancel buttons when editing */}
            {editing && (
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setEditing(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction} onPress={handleCallContact}>
                <Ionicons name="call" size={24} color={COLORS.accent} />
                <Text style={styles.quickActionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={handleTextContact}>
                <Ionicons name="chatbubble" size={24} color={COLORS.accent} />
                <Text style={styles.quickActionText}>Text</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={handleEmailContact}>
                <Ionicons name="mail" size={24} color={COLORS.accent} />
                <Text style={styles.quickActionText}>Email</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Projects */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Projects ({projects.length})</Text>
              <TouchableOpacity onPress={() => setShowAddProject(true)}>
                <Ionicons name="add-circle" size={24} color={COLORS.accent} />
              </TouchableOpacity>
            </View>

            {projects.length > 0 ? (
              projects.map((project) => (
                <ProjectCard
                  key={project._id}
                  project={project}
                  onPress={() => navigation.navigate('ProjectDetailScreen', { project })}
                  compact
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No projects yet</Text>
            )}
          </View>

          {/* Appointments */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Upcoming Appointments ({appointments.length})
              </Text>
              <TouchableOpacity onPress={() => setShowCreateAppointment(true)}>
                <Ionicons name="add-circle" size={24} color={COLORS.accent} />
              </TouchableOpacity>
            </View>

            {appointments.length > 0 ? (
              appointments.map((appointment) => (
                <CompactAppointmentCard
                  key={appointment._id}
                  appointment={appointment}
                  contact={contact}
                  calendar={calendarMap[appointment.calendarId]}
                  onPress={() => navigation.navigate('AppointmentDetail', {
                    appointmentId: appointment._id
                  })}
                  navigation={navigation}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No upcoming appointments</Text>
            )}
          </View>

          {/* Bottom padding */}
          <View style={{ height: 50 }} />
        </ScrollView>

        {/* Modals */}
        <CreateAppointmentModal
          visible={showCreateAppointment}
          onClose={() => setShowCreateAppointment(false)}
          onSubmit={handleCreateAppointment}
          contacts={allContacts}
          preSelectedContact={contact}
        />

        <AddProjectForm
          visible={showAddProject}
          onClose={() => setShowAddProject(false)}
          onSubmit={handleCreateProject}
          contacts={allContacts}
          preSelectedContact={contact}
          isModal
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
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  editButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.white,
    marginBottom: 10,
    padding: 20,
    ...SHADOW.light,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textLight,
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 12,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: RADIUS.medium,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.border,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    marginLeft: 10,
  },
  cancelButtonText: {
    color: COLORS.textDark,
    fontFamily: FONT.medium,
    fontSize: 16,
  },
  saveButtonText: {
    color: COLORS.white,
    fontFamily: FONT.medium,
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  quickAction: {
    alignItems: 'center',
    padding: 10,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginTop: 5,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: 20,
  },
});