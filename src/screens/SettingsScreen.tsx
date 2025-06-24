// src/screens/SettingsScreen.tsx
// Updated: June 23, 2025
// Description: App settings screen with better distributed tabs

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { NativeSyntheticEvent, TextInputChangeEventData } from 'react-native';
import { locationService } from '../services/locationService';

const { width } = Dimensions.get('window');

// Tab configuration - Better distributed
const TABS = [
  { id: 'profile', label: 'Profile', icon: 'person-outline' },
  { id: 'preferences', label: 'Preferences', icon: 'settings-outline' },
  { id: 'communication', label: 'Comms', icon: 'chatbubbles-outline' }, // Shortened label
];

// Option picker modal
const OptionPicker = ({ visible, options, value, onSelect, onClose, title }) => (
  <Modal visible={visible} transparent animationType="slide">
    <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.optionItem,
                value === item.value && styles.optionItemSelected,
              ]}
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  value === item.value && styles.optionTextSelected,
                ]}
              >
                {item.label}
              </Text>
              {value === item.value && (
                <Ionicons name="checkmark" size={20} color={COLORS.accent} />
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    </TouchableOpacity>
  </Modal>
);

export default function SettingsScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [preferences, setPreferences] = useState(user?.preferences || {});
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const scrollRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  // SMS number selection state
  const [smsNumbers, setSmsNumbers] = useState([]);
  const [loadingSmsNumbers, setLoadingSmsNumbers] = useState(true);
  const [showSmsNumberPicker, setShowSmsNumberPicker] = useState(false);

  // Phone number selection state
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(true);
  const [showPhoneNumberPicker, setShowPhoneNumberPicker] = useState(false);

  // Options for dropdowns
  const OPTIONS = {
    theme: [
      { label: 'System Default', value: 'system' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
    timezone: [
      { label: 'Eastern Time', value: 'America/New_York' },
      { label: 'Central Time', value: 'America/Chicago' },
      { label: 'Mountain Time', value: 'America/Denver' },
      { label: 'Pacific Time', value: 'America/Los_Angeles' },
      { label: 'Arizona', value: 'America/Phoenix' },
    ],
    dateFormat: [
      { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
      { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
      { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
    ],
    timeFormat: [
      { label: '12 Hour (1:30 PM)', value: '12h' },
      { label: '24 Hour (13:30)', value: '24h' },
    ],
    phoneProvider: [
      { label: 'Use My Phone', value: 'native' },
      { label: 'GHL Phone System', value: 'ghl_twilio' },
      { label: 'Disabled', value: 'disabled' },
    ],
    smsProvider: [
      { label: 'Use My Phone', value: 'native' },
      { label: 'GHL SMS', value: 'ghl_twilio' },
      { label: 'Disabled', value: 'disabled' },
    ],
    calendarView: [
      { label: 'Day View', value: 'day' },
      { label: 'Week View', value: 'week' },
      { label: 'Month View', value: 'month' },
    ],
    measurementUnit: [
      { label: 'Imperial (ft, in)', value: 'imperial' },
      { label: 'Metric (m, cm)', value: 'metric' },
    ],
  };

  // Load SMS and phone numbers on mount
  useEffect(() => {
    loadNumbers();
  }, []);

  const loadNumbers = async () => {
    try {
      const settings = await locationService.getSettings(user.locationId);
      setSmsNumbers(settings.settings?.smsPhoneNumbers || []);
      setPhoneNumbers(settings.settings?.phoneNumbers || settings.settings?.smsPhoneNumbers || []); // Use SMS numbers as fallback
    } catch (error) {
      console.error('Failed to load numbers:', error);
    } finally {
      setLoadingSmsNumbers(false);
      setLoadingPhoneNumbers(false);
    }
  };

  const updateSmsPreference = (numberId) => {
    updatePreference('communication.smsNumberId', numberId);
    setShowSmsNumberPicker(false);
  };

  const updatePhonePreference = (numberId) => {
    updatePreference('communication.phoneNumberId', numberId);
    setShowPhoneNumberPicker(false);
  };

  const handleTabChange = (tabId) => {
    const tabIndex = TABS.findIndex(t => t.id === tabId);
    Animated.spring(slideAnim, {
      toValue: tabIndex * (width / TABS.length),
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
    setActiveTab(tabId);
  };

  const handleSave = async () => {
    if (__DEV__) {
      console.log('💾 [Settings] Saving preferences:', preferences);
      console.log('User ID:', user?._id);
    }
    
    if (!user?._id) {
      Alert.alert('Error', 'User session invalid. Please log out and log back in.');
      return;
    }
    
    setSaving(true);
    try {
      // Save preferences
      await userService.updatePreferences(user._id, preferences);
      
      // If we're editing profile, save profile too
      if (editingProfile) {
        await userService.updateProfile(profile);
        updateUser({ ...user, ...profile, preferences });
        setEditingProfile(false);
      } else {
        updateUser({ ...user, preferences });
      }
      
      Alert.alert('Success', 'Settings saved successfully');
      
      if (__DEV__) {
        console.log('✅ [Settings] Preferences saved successfully');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('❌ [Settings] Failed to save preferences:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
      }
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save settings';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (path, value) => {
    const keys = path.split('.');
    let newPrefs = { ...preferences };
    let current = newPrefs;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setPreferences(newPrefs);
  };

  const getPreferenceValue = (path) => {
    const keys = path.split('.');
    let value = preferences;
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    return value;
  };

  const renderSetting = (config: SettingConfig) => {
    const { type, path, label, options, placeholder, description } = config;
    const value = getPreferenceValue(path);

    switch (type) {
      case 'switch':
        return (
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{label}</Text>
              {description && <Text style={styles.settingDescription}>{description}</Text>}
            </View>
            <Switch
              value={!!value}
              onValueChange={(val) => updatePreference(path, val)}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
            />
          </View>
        );

      case 'select':
        const selectedOption = options.find(o => o.value === value);
        return (
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setActiveModal({ type: 'select', path, label, options })}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{label}</Text>
              {description && <Text style={styles.settingDescription}>{description}</Text>}
            </View>
            <View style={styles.selectValue}>
              <Text style={styles.selectText}>
                {selectedOption?.label || 'Select...'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </View>
          </TouchableOpacity>
        );

      case 'text':
        return (
          <View style={styles.settingColumn}>
            <Text style={styles.settingLabel}>{label}</Text>
            {description && <Text style={styles.settingDescription}>{description}</Text>}
            <TextInput
              style={styles.textInput}
              value={value || ''}
              onChangeText={(text) => updatePreference(path, text)}
              placeholder={placeholder}
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        );

      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
              
              <View style={styles.settingColumn}>
                <Text style={styles.settingLabel}>Name</Text>
                {editingProfile ? (
                  <TextInput
                    style={styles.textInput}
                    value={profile.name}
                    onChangeText={(text) => setProfile({...profile, name: text})}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.textLight}
                  />
                ) : (
                  <Text style={styles.profileValue}>{profile.name}</Text>
                )}
              </View>

              <View style={styles.settingColumn}>
                <Text style={styles.settingLabel}>Email</Text>
                <Text style={styles.profileValue}>{profile.email}</Text>
                <Text style={styles.settingDescription}>Email cannot be changed</Text>
              </View>

              <View style={styles.settingColumn}>
                <Text style={styles.settingLabel}>Phone</Text>
                {editingProfile ? (
                  <TextInput
                    style={styles.textInput}
                    value={profile.phone}
                    onChangeText={(text) => setProfile({...profile, phone: text})}
                    placeholder="+1 (555) 123-4567"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.profileValue}>{profile.phone || 'Not set'}</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Role</Text>
                </View>
                <Text style={styles.selectText}>{user?.role || 'User'}</Text>
              </View>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Location ID</Text>
                </View>
                <Text style={styles.selectText}>{user?.locationId}</Text>
              </View>
            </View>

            {/* Move some preferences here to reduce scrolling */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DISPLAY PREFERENCES</Text>
              {renderSetting({
                type: 'select',
                path: 'theme',
                label: 'Theme',
                options: OPTIONS.theme,
                description: 'Choose your preferred color theme',
              })}
              {renderSetting({
                type: 'select',
                path: 'timezone',
                label: 'Time Zone',
                options: OPTIONS.timezone,
              })}
              {renderSetting({
                type: 'switch',
                path: 'notifications',
                label: 'Push Notifications',
                description: 'Receive alerts on your device',
              })}
            </View>
          </View>
        );

      case 'preferences':
        return (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FORMATS</Text>
              {renderSetting({
                type: 'select',
                path: 'dateFormat',
                label: 'Date Format',
                options: OPTIONS.dateFormat,
              })}
              {renderSetting({
                type: 'select',
                path: 'timeFormat',
                label: 'Time Format',
                options: OPTIONS.timeFormat,
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CALENDAR</Text>
              {renderSetting({
                type: 'select',
                path: 'defaultCalendarView',
                label: 'Default View',
                options: OPTIONS.calendarView,
              })}
              {renderSetting({
                type: 'switch',
                path: 'appointmentReminders.enabled',
                label: 'Appointment Reminders',
                description: 'Get notified before appointments',
              })}
              {renderSetting({
                type: 'switch',
                path: 'workingHours.enabled',
                label: 'Set Working Hours',
                description: 'Limit scheduling to business hours',
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>BUSINESS</Text>
              {renderSetting({
                type: 'switch',
                path: 'business.autoSaveQuotes',
                label: 'Auto-save Quotes',
                description: 'Save quotes as you work',
              })}
              {renderSetting({
                type: 'text',
                path: 'business.defaultTaxRate',
                label: 'Default Tax Rate (%)',
                placeholder: '8.5',
              })}
              {renderSetting({
                type: 'select',
                path: 'business.measurementUnit',
                label: 'Measurement Units',
                options: OPTIONS.measurementUnit,
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRIVACY</Text>
              {renderSetting({
                type: 'switch',
                path: 'privacy.showPhoneNumber',
                label: 'Show Phone to Team',
                description: 'Let team members see your phone',
              })}
              {renderSetting({
                type: 'switch',
                path: 'privacy.showEmail',
                label: 'Show Email to Team',
                description: 'Let team members see your email',
              })}
              {renderSetting({
                type: 'switch',
                path: 'privacy.activityTracking',
                label: 'Activity Analytics',
                description: 'Help improve the app with usage data',
              })}
            </View>
          </View>
        );

      case 'communication':
        return (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PHONE CALLS</Text>
              {renderSetting({
                type: 'select',
                path: 'communication.phoneProvider',
                label: 'Call Provider',
                options: OPTIONS.phoneProvider,
                description: 'How do you want to make calls?',
              })}
              {getPreferenceValue('communication.phoneProvider') === 'ghl_twilio' && (
                <View style={styles.warningBox}>
                  <Ionicons name="information-circle" size={16} color={COLORS.warning} />
                  <Text style={styles.warningText}>
                    Requires active GHL phone subscription
                  </Text>
                </View>
              )}
              
              {/* Business Phone Number Selector */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowPhoneNumberPicker(true)}
                disabled={loadingPhoneNumbers || phoneNumbers.length === 0}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Business Phone</Text>
                  <Text style={styles.settingDescription}>Your business phone number</Text>
                </View>
                <View style={styles.selectValue}>
                  <Text style={styles.selectText}>
                    {loadingPhoneNumbers ? 'Loading...' : 
                     preferences.communication?.phoneNumberId ? 
                       phoneNumbers.find(n => n._id === preferences.communication.phoneNumberId)?.number || 'Select number' :
                       'Select number'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TEXT MESSAGES</Text>
              {renderSetting({
                type: 'select',
                path: 'communication.smsProvider',
                label: 'SMS Provider',
                options: OPTIONS.smsProvider,
                description: 'How do you want to send texts?',
              })}
              {renderSetting({
                type: 'text',
                path: 'communication.smsSignature',
                label: 'SMS Signature',
                placeholder: '- John from ABC Company',
                description: 'Added to the end of your messages',
              })}
              
              {/* SMS From Number Selector */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowSmsNumberPicker(true)}
                disabled={loadingSmsNumbers || smsNumbers.length === 0}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>SMS From Number</Text>
                  <Text style={styles.settingDescription}>Which number to send texts from</Text>
                </View>
                <View style={styles.selectValue}>
                  <Text style={styles.selectText}>
                    {loadingSmsNumbers ? 'Loading...' : 
                     preferences.communication?.smsNumberId ? 
                       smsNumbers.find(n => n._id === preferences.communication.smsNumberId)?.label || 'Select number' :
                       'Select number'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LOGGING</Text>
              {renderSetting({
                type: 'switch',
                path: 'communication.autoLogCalls',
                label: 'Auto-log Calls',
                description: 'Save call history to contacts',
              })}
              {renderSetting({
                type: 'switch',
                path: 'communication.autoLogSms',
                label: 'Auto-log SMS',
                description: 'Save text history to contacts',
              })}
            </View>

            {/* Phone Number Picker Modal */}
            <Modal
              visible={showPhoneNumberPicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowPhoneNumberPicker(false)}
            >
              <View style={styles.modalOverlay}>
                <TouchableOpacity
                  style={styles.modalBackground}
                  activeOpacity={1}
                  onPress={() => setShowPhoneNumberPicker(false)}
                />
                <View style={styles.numberModalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Business Phone</Text>
                    <TouchableOpacity onPress={() => setShowPhoneNumberPicker(false)}>
                      <Ionicons name="close" size={24} color={COLORS.textDark} />
                    </TouchableOpacity>
                  </View>
                  
                  {phoneNumbers.map((number) => (
                    <TouchableOpacity
                      key={number._id}
                      style={styles.numberOption}
                      onPress={() => updatePhonePreference(number._id)}
                    >
                      <View style={styles.numberOptionContent}>
                        <Text style={styles.numberLabel}>{number.label}</Text>
                        <Text style={styles.numberValue}>{number.number}</Text>
                      </View>
                      {preferences.communication?.phoneNumberId === number._id && (
                        <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Modal>

            {/* SMS Number Picker Modal */}
            <Modal
              visible={showSmsNumberPicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowSmsNumberPicker(false)}
            >
              <View style={styles.modalOverlay}>
                <TouchableOpacity
                  style={styles.modalBackground}
                  activeOpacity={1}
                  onPress={() => setShowSmsNumberPicker(false)}
                />
                <View style={styles.numberModalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select SMS Number</Text>
                    <TouchableOpacity onPress={() => setShowSmsNumberPicker(false)}>
                      <Ionicons name="close" size={24} color={COLORS.textDark} />
                    </TouchableOpacity>
                  </View>
                  
                  {smsNumbers.map((number) => (
                    <TouchableOpacity
                      key={number._id}
                      style={styles.numberOption}
                      onPress={() => updateSmsPreference(number._id)}
                    >
                      <View style={styles.numberOptionContent}>
                        <Text style={styles.numberLabel}>{number.label}</Text>
                        <Text style={styles.numberValue}>{number.number}</Text>
                      </View>
                      {preferences.communication?.smsNumberId === number._id && (
                        <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Modal>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        {activeTab === 'profile' ? (
          <TouchableOpacity onPress={() => setEditingProfile(!editingProfile)}>
            <Text style={styles.saveButton}>{editingProfile ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Text style={styles.saveButton}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabWrapper}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && styles.tabActive,
              ]}
              onPress={() => handleTabChange(tab.id)}
            >
              <Ionicons 
                name={tab.icon} 
                size={20} 
                color={activeTab === tab.id ? COLORS.accent : COLORS.textLight} 
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [{ translateX: slideAnim }],
              width: width / TABS.length,
            },
          ]}
        />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
        
        {/* Save button for profile editing */}
        {activeTab === 'profile' && editingProfile && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.profileSaveButton}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.profileSaveButtonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Option Picker Modal */}
      {activeModal && (
        <OptionPicker
          visible={true}
          title={activeModal.label}
          options={activeModal.options}
          value={getPreferenceValue(activeModal.path)}
          onSelect={(value) => {
            updatePreference(activeModal.path, value);
            setActiveModal(null);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONT.header,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  saveButton: {
    fontSize: FONT.body,
    color: COLORS.accent,
    fontWeight: '600',
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
    justifyContent: 'center',
  },
  tabActive: {
    // Active styles handled by text color
  },
  tabText: {
    fontSize: FONT.small,
    color: COLORS.textLight,
    marginLeft: 4,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  tabIndicator: {
    height: 2,
    backgroundColor: COLORS.accent,
    position: 'absolute',
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingVertical: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: FONT.small,
    fontWeight: '600',
    color: COLORS.textLight,
    marginHorizontal: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingColumn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: FONT.body,
    color: COLORS.textDark,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: FONT.small,
    color: COLORS.textLight,
    marginTop: 2,
  },
  selectValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectText: {
    fontSize: FONT.body,
    color: COLORS.textLight,
    marginRight: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    padding: 12,
    marginTop: 8,
    fontSize: FONT.body,
    color: COLORS.textDark,
  },
  profileValue: {
    fontSize: FONT.body,
    color: COLORS.textDark,
    marginTop: 8,
  },
  profileSaveButton: {
    backgroundColor: COLORS.accent,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.medium,
    alignItems: 'center',
  },
  profileSaveButtonText: {
    fontSize: FONT.body,
    fontWeight: '600',
    color: COLORS.white,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: RADIUS.small,
  },
  warningText: {
    fontSize: FONT.small,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    maxHeight: '70%',
    ...SHADOW.medium,
  },
  numberModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT.large,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  optionItemSelected: {
    backgroundColor: COLORS.accentMuted,
  },
  optionText: {
    fontSize: FONT.body,
    color: COLORS.textDark,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: COLORS.accent,
  },
  numberOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  numberOptionContent: {
    flex: 1,
  },
  numberLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  numberValue: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
});