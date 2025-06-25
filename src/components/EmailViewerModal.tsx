// src/components/EmailViewerModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '../styles/theme';
import api from '../lib/api';

interface EmailViewerModalProps {
  visible: boolean;
  onClose: () => void;
  emailMessageId: string | null;
  locationId: string;
  initialSubject?: string;
}

export default function EmailViewerModal({
  visible,
  onClose,
  emailMessageId,
  locationId,
  initialSubject,
}: EmailViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [emailContent, setEmailContent] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (visible && emailMessageId) {
      fetchEmailContent();
    }
  }, [visible, emailMessageId]);

 const fetchEmailContent = async () => {
  if (__DEV__) {
    console.log('=== EmailViewerModal Fetching ===');
    console.log('Email Message ID:', emailMessageId);
    console.log('Location ID:', locationId);
  }
  
  setLoading(true);
  setError(false);
  
  try {
    const endpoint = `/api/messages/email/${emailMessageId}`;
    const params = { locationId };
    
    if (__DEV__) {
      console.log('Fetching from:', endpoint);
      console.log('With params:', params);
    }
    
    const response = await api.get(endpoint, { params });
    
    if (__DEV__) {
      console.log('Email fetch response:', response.data);
    }
    
    if (response.data.success && response.data.email) {
      setEmailContent(response.data.email);
      
      // Also update the message in the parent component if needed
      if (onEmailFetched) {
        onEmailFetched(emailMessageId, response.data.email);
      }
    } else {
      console.error('Invalid email response:', response.data);
      setError(true);
    }
  } catch (err: any) {
    console.error('Failed to fetch email:', err);
    console.error('Error details:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    setError(true);
  } finally {
    setLoading(false);
  }
};

  const getHtmlContent = () => {
    if (!emailContent) return '';
    
    // Wrap email content with basic HTML structure
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 16px;
              color: #333;
              line-height: 1.6;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            table {
              max-width: 100%;
            }
            a {
              color: #007AFF;
            }
          </style>
        </head>
        <body>
          ${emailContent.htmlBody || emailContent.body || ''}
        </body>
      </html>
    `;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.subject} numberOfLines={1}>
              {emailContent?.subject || initialSubject || 'Email'}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading email...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={COLORS.textGray} />
            <Text style={styles.errorText}>Failed to load email</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchEmailContent}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ html: getHtmlContent() }}
            style={styles.webview}
            scalesPageToFit={false}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 16,
  },
  subject: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONT.medium,
  },
  webview: {
    flex: 1,
  },
});