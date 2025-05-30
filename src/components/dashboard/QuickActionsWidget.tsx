// src/components/dashboard/QuickActionsWidget.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT, RADIUS, SHADOW } from '../../styles/theme';
import ProjectSelectorModal from '../ProjectSelectorModal';
import CreateAppointmentModal from '../CreateAppointmentModal';

export default function QuickActionsWidget() {
  const navigation = useNavigation();
  
  // Modal states
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'photo' | 'quote' | 'payment' | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  const handleActionPress = (action: 'photo' | 'quote' | 'payment' | 'schedule') => {
    if (action === 'schedule') {
      setShowAppointmentModal(true);
    } else {
      setSelectedAction(action);
      setShowProjectSelector(true);
    }
  };

  const handleProjectSelected = (project: any) => {
    setShowProjectSelector(false);
    
    switch (selectedAction) {
      case 'photo':
        // Navigate to project detail with photo tab
        navigation.navigate('ProjectDetailScreen' as never, { 
          project,
          initialTab: 'photos'
        } as never);
        break;
      
      case 'quote':
        // Navigate to quote builder with selected project
        navigation.navigate('QuoteBuilder' as never, { 
          project 
        } as never);
        break;
      
      case 'payment':
        // Navigate to project detail with payment action
        navigation.navigate('ProjectDetailScreen' as never, { 
          project,
          showPaymentModal: true
        } as never);
        break;
    }
    
    setSelectedAction(null);
  };

  const getModalTitle = () => {
    switch (selectedAction) {
      case 'photo':
        return 'Select Project for Photos';
      case 'quote':
        return 'Select Project for Quote';
      case 'payment':
        return 'Select Project for Payment';
      default:
        return 'Select Project';
    }
  };

  const quickActions = [
    {
      id: 'photo',
      label: 'Photo',
      icon: 'camera',
      color: '#00B3E6',
      onPress: () => handleActionPress('photo'),
    },
    {
      id: 'quote',
      label: 'Quote',
      icon: 'document-text',
      color: '#27AE60',
      onPress: () => handleActionPress('quote'),
    },
    {
      id: 'payment',
      label: 'Payment',
      icon: 'card',
      color: '#9B59B6',
      onPress: () => handleActionPress('payment'),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: 'calendar',
      color: '#F39C12',
      onPress: () => handleActionPress('schedule'),
    },
  ];

  return (
    <>
      <View style={styles.container}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionButton,
                index === 0 && styles.firstButton,
                index === quickActions.length - 1 && styles.lastButton
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: action.color + '15' }]}>
                <Ionicons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Project Selector Modal */}
      <ProjectSelectorModal
        visible={showProjectSelector}
        onClose={() => {
          setShowProjectSelector(false);
          setSelectedAction(null);
        }}
        onSelectProject={handleProjectSelected}
        title={getModalTitle()}
        actionType={selectedAction || 'photo'}
      />

      {/* Appointment Modal */}
      <CreateAppointmentModal
        visible={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        onSubmit={(data) => {
          console.log('Creating appointment:', data);
          setShowAppointmentModal(false);
          Alert.alert('Success', 'Appointment scheduled successfully');
        }}
        contacts={[]} // Would fetch from API
        selectedDate={new Date()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 12,
    ...SHADOW.card,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    minWidth: 70,
  },
  firstButton: {
    marginLeft: 0,
  },
  lastButton: {
    marginRight: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textDark,
    textAlign: 'center',
  },
});