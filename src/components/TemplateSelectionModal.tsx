import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import api from '../lib/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7;

// Mock templates - in real app, these come from MongoDB
const mockTemplates = [
  {
    _id: 'template_1',
    name: 'Professional Plumbing Proposal',
    description: 'Clean, professional layout perfect for residential plumbing projects',
    primaryColor: '#2E86AB',
    accentColor: '#A23B72',
    preview: '🔧',
    isDefault: true,
    sections: [
      { id: 'company_intro', title: 'Why Choose {companyName}', enabled: true, order: 1, icon: '🏠' },
      { id: 'quote_details', title: 'Your Quote Details', enabled: true, order: 2, icon: '💰' },
      { id: 'our_process', title: 'Our Process', enabled: true, order: 3, icon: '⚙️' },
      { id: 'warranty_service', title: 'Warranty & Service', enabled: true, order: 4, icon: '🛡️' },
      { id: 'system_details', title: 'Project Details', enabled: true, order: 5, icon: '📋' }
    ]
  },
  {
    _id: 'template_2', 
    name: 'Executive Summary',
    description: 'Concise, high-level presentation for quick decisions',
    primaryColor: '#1E3A8A',
    accentColor: '#F59E0B',
    preview: '📊',
    isDefault: false,
    sections: [
      { id: 'company_intro', title: 'Why Choose {companyName}', enabled: true, order: 1, icon: '🏠' },
      { id: 'quote_details', title: 'Your Quote Details', enabled: true, order: 2, icon: '💰' },
      { id: 'warranty_service', title: 'Warranty & Service', enabled: true, order: 3, icon: '🛡️' }
    ]
  },
  {
    _id: 'template_3',
    name: 'Detailed Technical',
    description: 'Comprehensive technical presentation for complex projects',
    primaryColor: '#059669',
    accentColor: '#DC2626',
    preview: '🔬',
    isDefault: false,
    sections: [
      { id: 'company_intro', title: 'Why Choose {companyName}', enabled: true, order: 1, icon: '🏠' },
      { id: 'quote_details', title: 'Your Quote Details', enabled: true, order: 2, icon: '💰' },
      { id: 'our_process', title: 'Our Process', enabled: true, order: 3, icon: '⚙️' },
      { id: 'warranty_service', title: 'Warranty & Service', enabled: true, order: 4, icon: '🛡️' },
      { id: 'system_details', title: 'Project Details', enabled: true, order: 5, icon: '📋' },
      { id: 'technical_specs', title: 'Technical Specifications', enabled: true, order: 6, icon: '🔧' }
    ]
  }
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: any) => void;
  userPermissions?: string[];
}

export default function TemplateSelectionModal({ 
  visible, 
  onClose, 
  onSelectTemplate,
  userPermissions = []
}: Props) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [translateY] = useState(new Animated.Value(MODAL_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Load templates when modal opens
  useEffect(() => {
    if (visible) {
      loadTemplates();
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

  const animateOut = (callback) => {
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
    animateOut(() => {
      onClose();
      setSelectedTemplate(null);
    });
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // In real app: const response = await api.get(`/api/templates/${user.locationId}`);
      // For now, use mock data with permission filtering
      const availableTemplates = mockTemplates.filter(template => {
        // If no permissions specified, show all templates
        if (!userPermissions.length) return true;
        
        // Show default templates to everyone
        if (template.isDefault) return true;
        
        // Check user permissions for custom templates
        return userPermissions.includes(template._id) || userPermissions.includes('all_templates');
      });
      
      setTemplates(availableTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates(mockTemplates); // Fallback to mock data
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
  };

  const handleConfirmSelection = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      handleClose();
    }
  };

  const renderTemplate = ({ item }) => {
    const isSelected = selectedTemplate?._id === item._id;
    
    return (
      <TouchableOpacity
        style={[
          styles.templateCard,
          isSelected && [styles.selectedTemplateCard, { borderColor: item.primaryColor }]
        ]}
        onPress={() => handleSelectTemplate(item)}
        activeOpacity={0.8}
      >
        {/* Template Preview */}
        <View style={[styles.templatePreview, { backgroundColor: item.primaryColor }]}>
          <Text style={styles.templatePreviewIcon}>{item.preview}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
            </View>
          )}
        </View>

        {/* Template Info */}
        <View style={styles.templateInfo}>
          <View style={styles.templateHeader}>
            <Text style={styles.templateName}>{item.name}</Text>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={24} color={item.primaryColor} />
            )}
          </View>
          
          <Text style={styles.templateDescription}>{item.description}</Text>
          
          {/* Section Count */}
          <View style={styles.templateMeta}>
            <View style={styles.sectionCount}>
              <Ionicons name="layers-outline" size={16} color={COLORS.textGray} />
              <Text style={styles.sectionCountText}>
                {item.sections.filter(s => s.enabled).length} sections
              </Text>
            </View>
            
            {/* Color Preview */}
            <View style={styles.colorPreview}>
              <View style={[styles.colorDot, { backgroundColor: item.primaryColor }]} />
              <View style={[styles.colorDot, { backgroundColor: item.accentColor }]} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
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
            <Text style={styles.title}>Choose Presentation Template</Text>
            <Text style={styles.subtitle}>Select the template that best fits your presentation style</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading templates...</Text>
              </View>
            ) : (
              <FlatList
                data={templates}
                renderItem={renderTemplate}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.templateList}
              />
            )}
          </View>

          {/* Bottom Action Bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.confirmButton,
                selectedTemplate ? styles.confirmButtonEnabled : styles.confirmButtonDisabled
              ]} 
              onPress={handleConfirmSelection}
              disabled={!selectedTemplate}
            >
              <Text style={[
                styles.confirmButtonText,
                selectedTemplate ? styles.confirmButtonTextEnabled : styles.confirmButtonTextDisabled
              ]}>
                Present Quote
              </Text>
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
    paddingVertical: 20,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    marginTop: 16,
  },
  templateList: {
    paddingVertical: 20,
    gap: 16,
  },
  templateCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOW.card,
  },
  selectedTemplateCard: {
    borderWidth: 2,
    ...SHADOW.fab,
  },
  templatePreview: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  templatePreviewIcon: {
    fontSize: 24,
    color: '#fff',
  },
  defaultBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  templateInfo: {
    flex: 1,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  templateName: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
  },
  templateDescription: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    lineHeight: 18,
    marginBottom: 12,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCountText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 4,
  },
  colorPreview: {
    flexDirection: 'row',
    gap: 4,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonEnabled: {
    backgroundColor: COLORS.accent,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  confirmButtonText: {
    fontSize: FONT.input,
    fontWeight: '600',
  },
  confirmButtonTextEnabled: {
    color: '#fff',
  },
  confirmButtonTextDisabled: {
    color: COLORS.textLight,
  },
});