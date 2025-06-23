import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { smsService } from '../services/smsService';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

interface Project {
  title: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Props {
  contact: Contact;
  name: string;
  email: string;
  phone: string;
  projects: Project[];
  onPress: () => void;
}

export default function ContactCard({ contact, name, email, phone, projects, onPress }: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigation = useNavigation();

  const total = projects.length;
  const completed = projects.filter((p) => p.status === 'Job Complete').length;

  const sorted = [...projects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const latest = sorted[0]; // After sorting newest to oldest, first item is latest

  const toggleExpanded = () => setExpanded((prev) => !prev);

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleDateString();
  };

  const badgeStyleMap: { [key: string]: any } = {
    Open: styles.badge_Open,
    Quoted: styles.badge_Quoted,
    Scheduled: styles.badge_Scheduled,
    'Job Complete': styles.badge_JobComplete,
  };

  const badgeStyle = latest?.status ? badgeStyleMap[latest.status.trim()] || {} : {};

  const handleQuickSMS = async () => {
    try {
      // Check if SMS is configured
      const isConfigured = await smsService.isConfigured();
      
      if (!isConfigured) {
        Alert.alert(
          'SMS Setup Required',
          'Please select your SMS number in Profile settings before sending messages.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Go to Profile', 
              onPress: () => navigation.navigate('ProfileScreen')
            }
          ]
        );
        return;
      }
      
      // Navigate to conversation with this contact
      navigation.navigate('ConversationScreen', { 
        contact: contact,
        defaultMode: 'sms' 
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to check SMS configuration');
    }
  };

  const handleCall = () => {
    if (phone) {
      // You can add linking to make phone calls
      // Linking.openURL(`tel:${phone}`);
      Alert.alert('Call', `Calling ${phone}`);
    }
  };

  const handleEmail = () => {
    if (email) {
      // You can add linking to send emails
      // Linking.openURL(`mailto:${email}`);
      Alert.alert('Email', `Emailing ${email}`);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={toggleExpanded}
      activeOpacity={0.9}
    >
      <View style={styles.cardHeader}>
        <View style={styles.contactInfo}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.phone}>{phone}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
        
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleCall}
          >
            <Ionicons name="call-outline" size={20} color={COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleQuickSMS}
          >
            <Ionicons name="chatbox-outline" size={20} color={COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleEmail}
          >
            <Ionicons name="mail-outline" size={20} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.label}>Latest Status: </Text>
        {latest?.status ? (
          <View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{latest.status}</Text>
          </View>
        ) : (
          <Text style={styles.meta}>—</Text>
        )}
      </View>

      <Text style={styles.meta}>
        <Text style={styles.label}>Projects: </Text>
        {total} total • {completed} completed
      </Text>

      {latest?.updatedAt && (
        <Text style={styles.meta}>
          <Text style={styles.label}>Updated: </Text>
          {formatDate(latest.updatedAt)}
        </Text>
      )}

      {expanded && (
        <View style={styles.projectList}>
          <Text style={styles.projectListTitle}>All Projects:</Text>
          {sorted.map((p, index) => (
            <View key={index} style={styles.projectItem}>
              <View style={styles.projectHeader}>
                <Text style={styles.projectTitle}>{p.title}</Text>
                <View style={[styles.badge, badgeStyleMap[p.status] || styles.badge_Default]}>
                  <Text style={styles.badgeText}>{p.status}</Text>
                </View>
              </View>
              {p.updatedAt && (
                <Text style={styles.projectDate}>Updated: {formatDate(p.updatedAt)}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.medium,
    marginBottom: 12,
    ...SHADOW.light,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  contactInfo: {
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  name: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  phone: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  meta: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 6,
  },
  label: {
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.white,
    fontFamily: FONT.medium,
  },
  badge_Open: { 
    backgroundColor: '#3498db' 
  },
  badge_Quoted: { 
    backgroundColor: '#f1c40f' 
  },
  badge_Scheduled: { 
    backgroundColor: '#9b59b6' 
  },
  badge_JobComplete: { 
    backgroundColor: '#2ecc71' 
  },
  badge_Default: {
    backgroundColor: COLORS.textGray
  },
  projectList: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  projectListTitle: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  projectItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectTitle: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    flex: 1,
    marginRight: 8,
  },
  projectStatus: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.accent,
  },
  projectDate: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
  },
});