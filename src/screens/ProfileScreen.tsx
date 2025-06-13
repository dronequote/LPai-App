import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

export default function ProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    avatar: user?.avatar || '',
    emailSignature: user?.preferences?.emailSignature || '',
    businessSignature: user?.preferences?.business?.signature?.value || '',
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update basic profile
      await userService.updateProfile(user._id, {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        avatar: formData.avatar,
      });

      // Update preferences
      await userService.updatePreferences(user._id, {
        emailSignature: formData.emailSignature,
        business: {
          ...user.preferences?.business,
          signature: {
            type: 'text',
            value: formData.businessSignature,
          },
        },
      });

      // Update local user
      updateUser({
        ...user,
        firstName: formData.firstName,
        lastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        avatar: formData.avatar,
        preferences: {
          ...user.preferences,
          emailSignature: formData.emailSignature,
          business: {
            ...user.preferences?.business,
            signature: {
              type: 'text',
              value: formData.businessSignature,
            },
          },
        },
      });

      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setFormData({ ...formData, avatar: result.assets[0].uri });
    }
  };

  const getInitials = () => {
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase() || 'U';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          {editing ? (
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={editing ? handleImagePick : null}
              disabled={!editing}
            >
              {formData.avatar ? (
                <Image source={{ uri: formData.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{getInitials()}</Text>
                </View>
              )}
              {editing && (
                <View style={styles.avatarOverlay}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.userName}>
              {`${formData.firstName} ${formData.lastName}`.trim() || 'Your Name'}
            </Text>
            <Text style={styles.userRole}>{user?.role || 'User'}</Text>
          </View>

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                placeholder="First Name"
                editable={editing}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                placeholder="Last Name"
                editable={editing}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={formData.email}
                editable={false}
                keyboardType="email-address"
              />
              <Text style={styles.helper}>Email cannot be changed</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
                editable={editing}
              />
            </View>
          </View>

          {/* Signatures */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SIGNATURES</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Signature</Text>
              <TextInput
                style={[styles.textArea, !editing && styles.inputDisabled]}
                value={formData.emailSignature}
                onChangeText={(text) => setFormData({ ...formData, emailSignature: text })}
                placeholder="Best regards,\nJohn Smith\nABC Company"
                multiline
                numberOfLines={4}
                editable={editing}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Document Signature</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={formData.businessSignature}
                onChangeText={(text) => setFormData({ ...formData, businessSignature: text })}
                placeholder="John Smith"
                editable={editing}
              />
              <Text style={styles.helper}>Used for quotes and documents</Text>
            </View>
          </View>

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACCOUNT</Text>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('ChangePasswordScreen')}
            >
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textDark} />
              <Text style={styles.actionText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('NotificationScreen')}
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.textDark} />
              <Text style={styles.actionText}>Notification Preferences</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>

          {/* Account Info */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID</Text>
              <Text style={styles.infoValue}>{user?._id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location ID</Text>
              <Text style={styles.infoValue}>{user?.locationId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#fff',
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
  editButton: {
    fontSize: FONT.body,
    color: COLORS.accent,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.textDark,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: FONT.large,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  userRole: {
    fontSize: FONT.body,
    color: COLORS.textLight,
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT.small,
    fontWeight: '600',
    color: COLORS.textLight,
    marginHorizontal: 20,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: FONT.small,
    fontWeight: '500',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    padding: 12,
    fontSize: FONT.body,
    color: COLORS.textDark,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: COLORS.background,
    color: COLORS.textLight,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    padding: 12,
    fontSize: FONT.body,
    color: COLORS.textDark,
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helper: {
    fontSize: FONT.small,
    color: COLORS.textLight,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionText: {
    flex: 1,
    fontSize: FONT.body,
    color: COLORS.textDark,
    marginLeft: 12,
  },
  infoSection: {
    padding: 20,
    marginTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: FONT.small,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: FONT.small,
    color: COLORS.textDark,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});