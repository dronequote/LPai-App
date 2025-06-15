// src/screens/SettingsScreen.tsx
// Updated: June 13, 2025
// Description: App settings screen with tabbed interface for user preferences

import React, { useState, useRef } from 'react';
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

const { width } = Dimensions.get('window');

// Tab configuration
const TABS = [
  { id: 'general', label: 'General', icon: 'settings-outline' },
  { id: 'communication', label: 'Communication', icon: 'chatbubbles-outline' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
  { id: 'business', label: 'Business', icon: 'business-outline' },
  { id: 'privacy', label: 'Privacy', icon: 'lock-closed-outline' },
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
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const scrollRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

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
      await userService.updatePreferences(user._id, preferences);
      updateUser({ ...user, preferences });
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
      case 'general':
        return (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>APPEARANCE</Text>
              {renderSetting({
                type: 'select',
                path: 'theme',
                label: 'Theme',
                options: OPTIONS.theme,
                description: 'Choose your preferred color theme',
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LOCALIZATION</Text>
              {renderSetting({
                type: 'select',
                path: 'timezone',
                label: 'Time Zone',
                options: OPTIONS.timezone,
              })}
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
              <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
              {renderSetting({
                type: 'switch',
                path: 'notifications',
                label: 'Push Notifications',
                description: 'Receive alerts on your device',
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
              {renderSetting({
                type: 'text',
                path: 'communication.defaultPhoneNumber',
                label: 'Business Phone',
                placeholder: '+1 (555) 123-4567',
              })}
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
          </View>
        );

      case 'calendar':
        return (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CALENDAR PREFERENCES</Text>
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
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>WORKING HOURS</Text>
              {renderSetting({
                type: 'switch',
                path: 'workingHours.enabled',
                label: 'Set Working Hours',
                description: 'Limit scheduling to business hours',
              })}
              {/* Add time pickers for start/end times here */}
            </View>
          </View>
        );

      case 'business':
        return (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QUOTES & INVOICES</Text>
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
          </View>
        );

      case 'privacy':
        return (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DATA SHARING</Text>
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
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
        >
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
        </ScrollView>
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
  tabScroll: {
    flexGrow: 0,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: width / TABS.length,
  },
  tabActive: {
    // Active styles handled by text color
  },
  tabText: {
    fontSize: FONT.small,
    color: COLORS.textLight,
    marginLeft: 6,
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
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    maxHeight: '70%',
    ...SHADOW.medium,
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
});