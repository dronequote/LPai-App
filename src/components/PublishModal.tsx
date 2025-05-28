// src/components/PublishModal.tsx
import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Switch,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.75;

interface PublishModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (publishOptions: PublishOptions) => void;
  quote: any;
  template: any;
  publishing: boolean;
}

interface PublishOptions {
  sendEmail: boolean;
  sendPDF: boolean;
  copyLink: boolean;
  emailOptions?: {
    subject: string;
    message: string;
    recipientEmail: string;
  };
}

export default function PublishModal({
  visible,
  onClose,
  onSubmit,
  quote,
  template,
  publishing
}: PublishModalProps) {
  // Animation
  const [translateY] = useState(new Animated.Value(MODAL_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Form state
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPDF, setSendPDF] = useState(false);
  const [copyLink, setCopyLink] = useState(true);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  // Initialize form when modal opens
  React.useEffect(() => {
    if (visible) {
      // Set default email content
      setEmailSubject(`Your quote from ${template?.companyOverrides?.name || 'Our Company'} - ${quote?.quoteNumber || 'Quote'}`);
      setEmailMessage(`Hi ${quote?.customerName || 'there'},

I've prepared your quote for ${quote?.projectTitle || 'your project'}. Please review the details and let me know if you have any questions.

You can view and approve your quote using the link below:

Best regards,
${template?.companyOverrides?.name || 'Our Team'}`);
      setRecipientEmail(quote?.contact?.email || '');
      
      animateIn();
    }
  }, [visible]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const handleClose = () => {
    if (publishing) return; // Prevent closing while publishing
    animateOut(onClose);
  };

  const handleSubmit = () => {
    const publishOptions: PublishOptions = {
      sendEmail,
      sendPDF,
      copyLink,
      emailOptions: sendEmail ? {
        subject: emailSubject,
        message: emailMessage,
        recipientEmail: recipientEmail,
      } : undefined,
    };

    onSubmit(publishOptions);
  };

  const isFormValid = () => {
    if (sendEmail && (!recipientEmail || !emailSubject)) {
      return false;
    }
    return sendEmail || sendPDF || copyLink; // At least one option selected
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <SafeAreaView style={styles.modalContent}>
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Publish Quote</Text>
            <Text style={styles.subtitle}>
              Share your professional quote with {quote?.customerName || 'the customer'}
            </Text>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Quote Info */}
            <View style={styles.quoteInfo}>
              <Text style={styles.quoteNumber}>{quote?.quoteNumber}</Text>
              <Text style={styles.quoteTitle}>{quote?.projectTitle}</Text>
              <Text style={styles.quoteAmount}>${quote?.total?.toLocaleString() || '0'}</Text>
              <Text style={styles.quoteStatus}>Status: {quote?.status || 'Draft'}</Text>
            </View>

            {/* Publishing Options */}
            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>Publishing Options</Text>
              
              {/* Send Email Option */}
              <View style={styles.optionRow}>
                <View style={styles.optionLeft}>
                  <Ionicons name="mail-outline" size={24} color={COLORS.accent} />
                  <Text style={styles.optionTitle}>Send Web Link via Email</Text>
                </View>
                <Switch
                  value={sendEmail}
                  onValueChange={setSendEmail}
                  trackColor={{ false: COLORS.border, true: COLORS.accent }}
                  thumbColor={sendEmail ? '#fff' : '#f4f3f4'}
                />
              </View>

              {sendEmail && (
                <View style={styles.emailOptions}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Recipient Email</Text>
                    <TextInput
                      style={styles.input}
                      value={recipientEmail}
                      onChangeText={setRecipientEmail}
                      placeholder="customer@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Subject</Text>
                    <TextInput
                      style={styles.input}
                      value={emailSubject}
                      onChangeText={setEmailSubject}
                      placeholder="Email subject"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Message</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={emailMessage}
                      onChangeText={setEmailMessage}
                      placeholder="Email message"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              )}

              {/* Send PDF Option */}
              <View style={styles.optionRow}>
                <View style={styles.optionLeft}>
                  <Ionicons name="document-outline" size={24} color={COLORS.accent} />
                  <Text style={styles.optionTitle}>Also Send PDF</Text>
                </View>
                <Switch
                  value={sendPDF}
                  onValueChange={setSendPDF}
                  trackColor={{ false: COLORS.border, true: COLORS.accent }}
                  thumbColor={sendPDF ? '#fff' : '#f4f3f4'}
                />
              </View>

              {/* Copy Link Option */}
              <View style={styles.optionRow}>
                <View style={styles.optionLeft}>
                  <Ionicons name="link-outline" size={24} color={COLORS.accent} />
                  <Text style={styles.optionTitle}>Copy Web Link</Text>
                </View>
                <Switch
                  value={copyLink}
                  onValueChange={setCopyLink}
                  trackColor={{ false: COLORS.border, true: COLORS.accent }}
                  thumbColor={copyLink ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Web Link Preview */}
            {quote?.webLinkToken && (
              <View style={styles.linkPreview}>
                <Text style={styles.linkPreviewTitle}>Web Link Preview</Text>
                <Text style={styles.linkPreviewUrl}>
                  {`${process.env.EXPO_PUBLIC_APP_URL || 'https://yourapp.com'}/quote/${quote.webLinkToken}`}
                </Text>
                <Text style={styles.linkPreviewNote}>
                  This secure link allows customers to view and sign the quote without logging in.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.actionBar}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleClose}
              disabled={publishing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.publishButton,
                isFormValid() ? styles.publishButtonEnabled : styles.publishButtonDisabled
              ]} 
              onPress={handleSubmit}
              disabled={!isFormValid() || publishing}
            >
              {publishing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[
                  styles.publishButtonText,
                  isFormValid() ? styles.publishButtonTextEnabled : styles.publishButtonTextDisabled
                ]}>
                  Publish Quote
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalContent: {
    flex: 1,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textLight,
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  quoteInfo: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
    ...SHADOW.card,
  },
  quoteNumber: {
    fontSize: FONT.meta,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 4,
  },
  quoteTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  quoteAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  quoteStatus: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  optionsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.card,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionTitle: {
    fontSize: FONT.input,
    fontWeight: '500',
    color: COLORS.textDark,
    marginLeft: 12,
  },
  emailOptions: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    marginLeft: 20,
    ...SHADOW.card,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: FONT.label,
    fontWeight: '600',
    color: COLORS.textGray,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.background,
    padding: 12,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  linkPreview: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
    ...SHADOW.card,
  },
  linkPreviewTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  linkPreviewUrl: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  linkPreviewNote: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    lineHeight: 18,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textGray,
  },
  publishButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonEnabled: {
    backgroundColor: COLORS.accent,
  },
  publishButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  publishButtonText: {
    fontSize: FONT.input,
    fontWeight: '600',
  },
  publishButtonTextEnabled: {
    color: '#fff',
  },
  publishButtonTextDisabled: {
    color: COLORS.textLight,
  },
});