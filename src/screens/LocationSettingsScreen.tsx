// src/screens/LocationSettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { locationService } from '../services/locationService';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

export default function LocationSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [locationData, setLocationData] = useState(null);
  const [smsNumbers, setSmsNumbers] = useState([]);
  const [showSmsForm, setShowSmsForm] = useState(false);
  const [newNumber, setNewNumber] = useState({ number: '', label: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLocationData();
    loadSmsNumbers();
  }, []);

  const loadLocationData = async () => {
    try {
      const data = await locationService.getDetails(user.locationId);
      setLocationData(data);
    } catch (error) {
      console.error('Failed to load location data:', error);
    } finally {
      setLoading(false);
    }
  };

    const loadSmsNumbers = async () => {
    try {
        const numbers = await locationService.getSmsNumbers(user.locationId);
        setSmsNumbers(numbers || []);
    } catch (error) {
        console.error('Failed to load SMS numbers:', error);
    }
    };

  const formatPhoneNumber = (number) => {
    // Remove all non-digits
    const digits = number.replace(/\D/g, '');
    
    // Format as +1 (XXX) XXX-XXXX for display
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+${digits}`;
    }
    return number;
  };

  const addSmsNumber = async () => {
    if (!newNumber.number || !newNumber.label) {
      Alert.alert('Error', 'Please enter both phone number and label');
      return;
    }

    const formattedNumber = formatPhoneNumber(newNumber.number);
    
    const updatedNumbers = [...smsNumbers, {
      number: formattedNumber,
      label: newNumber.label,
      isDefault: smsNumbers.length === 0
    }];

    await saveSmsNumbers(updatedNumbers);
    setNewNumber({ number: '', label: '' });
    setShowSmsForm(false);
  };

    const saveSmsNumbers = async (numbers) => {
    setSaving(true);
    try {
        await locationService.updateSmsNumbers(user.locationId, numbers);
        setSmsNumbers(numbers);
        Alert.alert('Success', 'SMS numbers updated successfully');
    } catch (error) {
        Alert.alert('Error', 'Failed to update SMS numbers');
    } finally {
        setSaving(false);
    }
    };

  const removeNumber = (index) => {
    Alert.alert(
      'Remove Number',
      'Are you sure you want to remove this number?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedNumbers = smsNumbers.filter((_, i) => i !== index);
            await saveSmsNumbers(updatedNumbers);
          }
        }
      ]
    );
  };

  const setAsDefault = async (index) => {
    const updatedNumbers = smsNumbers.map((num, i) => ({
      ...num,
      isDefault: i === index
    }));
    await saveSmsNumbers(updatedNumbers);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.title}>Location Settings</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Location Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Location Name</Text>
            <Text style={styles.value}>{locationData?.name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Main Phone</Text>
            <Text style={styles.value}>{locationData?.phone || 'N/A'}</Text>
          </View>
        </View>

        {/* SMS Phone Numbers Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SMS Phone Numbers (GHL)</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowSmsForm(true)}
            >
              <Ionicons name="add-circle" size={24} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.helperText}>
            Add phone numbers configured in GoHighLevel for SMS messaging
          </Text>

          {smsNumbers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbox-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No SMS numbers configured</Text>
              <Text style={styles.emptySubtext}>
                Add your GHL phone numbers to enable SMS messaging
              </Text>
            </View>
          ) : (
            smsNumbers.map((num, index) => (
              <View key={index} style={styles.numberCard}>
                <View style={styles.numberInfo}>
                  <Text style={styles.numberLabel}>{num.label}</Text>
                  <Text style={styles.phoneNumber}>{num.number}</Text>
                </View>
                <View style={styles.numberActions}>
                  {num.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  )}
                  {!num.isDefault && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => setAsDefault(index)}
                    >
                      <Text style={styles.actionText}>Set Default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => removeNumber(index)}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {showSmsForm && (
            <View style={styles.addForm}>
              <TextInput
                style={styles.input}
                placeholder="Phone number (e.g., +17205551234)"
                value={newNumber.number}
                onChangeText={(text) => setNewNumber({...newNumber, number: text})}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Label (e.g., Main Office, Sales Team)"
                value={newNumber.label}
                onChangeText={(text) => setNewNumber({...newNumber, label: text})}
              />
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowSmsForm(false);
                    setNewNumber({ number: '', label: '' });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={addSmsNumber}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Add Number'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.white,
    marginVertical: 8,
    paddingVertical: 16,
    ...SHADOW.light,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  helperText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  value: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  addButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  numberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  numberInfo: {
    flex: 1,
  },
  numberLabel: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  numberActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultBadge: {
    backgroundColor: COLORS.lightAccent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  defaultText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  actionText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  deleteButton: {
    padding: 8,
  },
  addForm: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.medium,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.white,
  },
});