// src/components/BulkSmsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { smsService } from '../services/smsService';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

interface BulkSmsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedContacts: Array<{ _id: string; firstName: string; lastName: string }>;
  onSuccess: () => void;
}

export default function BulkSmsModal({ 
  visible, 
  onClose, 
  selectedContacts,
  onSuccess 
}: BulkSmsModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkSmsConfiguration();
  }, [visible]);

  const checkSmsConfiguration = async () => {
    if (!visible) return;
    
    setChecking(true);
    try {
      const configured = await smsService.isConfigured();
      setIsConfigured(configured);
    } catch (error) {
      setIsConfigured(false);
    } finally {
      setChecking(false);
    }
  };

  const sendBulkSms = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setSending(true);
    try {
      const contactIds = selectedContacts.map(c => c._id);
      const result = await smsService.sendBatch(contactIds, message.trim());
      
      Alert.alert(
        'Success', 
        `Messages sent successfully!\n\nSent: ${result.sent}\nFailed: ${result.failed}`,
        [{ text: 'OK', onPress: onSuccess }]
      );
      
      setMessage('');
      onClose();
      
    } catch (error: any) {
      if (error.message.includes('No SMS number configured')) {
        Alert.alert(
          'SMS Setup Required',
          'Please select your SMS number in Profile settings.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to send messages. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Send SMS to {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>

          {checking ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
              <Text style={styles.loadingText}>Checking SMS configuration...</Text>
            </View>
          ) : !isConfigured ? (
            <View style={styles.notConfiguredContainer}>
              <Ionicons name="warning-outline" size={48} color={COLORS.warning} />
              <Text style={styles.notConfiguredText}>SMS Not Configured</Text>
              <Text style={styles.notConfiguredSubtext}>
                Please select your SMS number in Profile settings before sending messages.
              </Text>
              <TouchableOpacity
                style={styles.configureButton}
                onPress={onClose}
              >
                <Text style={styles.configureButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.modalBody}>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Type your message here..."
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                  maxHeight={120}
                  maxLength={160}
                  editable={!sending}
                />
                
                <Text style={styles.charCount}>
                  {message.length}/160 characters
                </Text>
                
                <View style={styles.recipientsList}>
                  <Text style={styles.recipientsLabel}>Recipients:</Text>
                  {selectedContacts.slice(0, 3).map((contact, index) => (
                    <Text key={contact._id} style={styles.recipientName}>
                      • {contact.firstName} {contact.lastName}
                    </Text>
                  ))}
                  {selectedContacts.length > 3 && (
                    <Text style={styles.recipientName}>
                      • and {selectedContacts.length - 3} more...
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={sending}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, styles.sendButton, sending && styles.buttonDisabled]}
                  onPress={sendBulkSms}
                  disabled={sending || !message.trim()}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color={COLORS.white} />
                      <Text style={styles.sendButtonText}>Send Messages</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    maxHeight: '80%',
    ...SHADOW.large,
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
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  messageInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    textAlign: 'right',
    marginTop: 4,
  },
  recipientsList: {
    marginTop: 20,
  },
  recipientsLabel: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.medium,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
  sendButton: {
    backgroundColor: COLORS.accent,
  },
  sendButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.white,
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 12,
  },
  notConfiguredContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  notConfiguredText: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  notConfiguredSubtext: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    textAlign: 'center',
    marginBottom: 24,
  },
  configureButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.medium,
  },
  configureButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.white,
  },
});