// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

export default function ProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  
  // SMS Preference State
  const [smsConfig, setSmsConfig] = useState({
    availableNumbers: [],
    userPreference: null
  });
  const [showSmsPicker, setShowSmsPicker] = useState(false);
  const [loadingSmsConfig, setLoadingSmsConfig] = useState(true);

  useEffect(() => {
    loadSmsConfig();
  }, []);

  const loadSmsConfig = async () => {
    try {
      const config = await userService.getSmsPreference();
      setSmsConfig({
        availableNumbers: config.availableNumbers || [],
        userPreference: config.userPreference
      });
    } catch (error) {
      console.error('Failed to load SMS config:', error);
    } finally {
      setLoadingSmsConfig(false);
    }
  };

const updateSmsPreference = async (numberId) => {
  try {
    await userService.updateSmsPreference(numberId);
    
    setSmsConfig(prev => ({
      ...prev,
      userPreference: numberId
    }));
    
    setShowSmsPicker(false);
    Alert.alert('Success', 'SMS preference updated');
  } catch (error) {
    Alert.alert('Error', 'Failed to update SMS preference');
  }
};

  const handleSave = async () => {
    setLoading(true);
    try {
      await userService.updateProfile(profile);
      updateUser({ ...user, ...profile });
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const selectedNumber = smsConfig.availableNumbers.find(
    n => n._id?.toString() === smsConfig.userPreference?.toString()
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Text style={styles.editButton}>{editing ? 'Cancel' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={profile.name}
                onChangeText={(text) => setProfile({...profile, name: text})}
              />
            ) : (
              <Text style={styles.value}>{profile.name}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={profile.phone}
                onChangeText={(text) => setProfile({...profile, phone: text})}
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.value}>{profile.phone || 'Not set'}</Text>
            )}
          </View>

          {editing && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* SMS Preference Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SMS Settings</Text>
          
          <TouchableOpacity
            style={styles.smsSelector}
            onPress={() => setShowSmsPicker(true)}
            disabled={loadingSmsConfig || smsConfig.availableNumbers.length === 0}
          >
            <View style={styles.smsSelectorContent}>
              <Ionicons name="chatbox-outline" size={24} color={COLORS.accent} />
              <View style={styles.smsSelectorText}>
                <Text style={styles.smsSelectorLabel}>Send SMS From</Text>
                {loadingSmsConfig ? (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                ) : selectedNumber ? (
                  <View>
                    <Text style={styles.smsSelectorValue}>{selectedNumber.label}</Text>
                    <Text style={styles.smsSelectorNumber}>{selectedNumber.number}</Text>
                  </View>
                ) : smsConfig.availableNumbers.length > 0 ? (
                  <Text style={styles.smsSelectorPlaceholder}>Select a number</Text>
                ) : (
                  <Text style={styles.smsSelectorPlaceholder}>No numbers available</Text>
                )}
              </View>
            </View>
            {smsConfig.availableNumbers.length > 0 && (
              <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
            )}
          </TouchableOpacity>

          {smsConfig.availableNumbers.length === 0 && !loadingSmsConfig && (
            <Text style={styles.helperText}>
              Contact your administrator to configure SMS phone numbers
            </Text>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{user?.role || 'User'}</Text>
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>Location ID</Text>
            <Text style={styles.value}>{user?.locationId}</Text>
          </View>
        </View>
      </ScrollView>

      {/* SMS Number Picker Modal */}
      <Modal
        visible={showSmsPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSmsPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSmsPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select SMS Number</Text>
              <TouchableOpacity onPress={() => setShowSmsPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {smsConfig.availableNumbers.map((number) => (
                <TouchableOpacity
                  key={number._id}
                  style={styles.numberOption}
                  onPress={() => updateSmsPreference(number._id)}
                >
                  <View style={styles.radioContainer}>
                    <View style={styles.radioButton}>
                      {smsConfig.userPreference?.toString() === number._id?.toString() && (
                        <View style={styles.radioSelected} />
                      )}
                    </View>
                    <View style={styles.numberOptionText}>
                      <Text style={styles.numberOptionLabel}>{number.label}</Text>
                      <Text style={styles.numberOptionNumber}>{number.number}</Text>
                      {number.isDefault && (
                        <Text style={styles.defaultIndicator}>Location default</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  editButton: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.accent,
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
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  field: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 12,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.medium,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.white,
  },
  smsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  smsSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  smsSelectorText: {
    marginLeft: 16,
    flex: 1,
  },
  smsSelectorLabel: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  smsSelectorValue: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  smsSelectorNumber: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  smsSelectorPlaceholder: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
  },
  helperText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  modalBody: {
    paddingVertical: 8,
  },
  numberOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  numberOptionText: {
    flex: 1,
  },
  numberOptionLabel: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  numberOptionNumber: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  defaultIndicator: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.accent,
    marginTop: 4,
  },
});