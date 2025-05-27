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
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85; // ✅ Increased from 0.8 to 0.85

interface Template {
  _id: string;
  name: string;
  description: string;
  styling: {
    primaryColor: string;
    accentColor: string;
  };
  preview?: string;
  isDefault?: boolean;
  isGlobal: boolean;
  tabs: any[];
  category?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
  userPermissions?: string[];
}

export default function TemplateSelectionModal({ 
  visible, 
  onClose, 
  onSelectTemplate,
  userPermissions = []
}: Props) {
  const { user } = useAuth();
  
  // State
  const [locationTemplates, setLocationTemplates] = useState<Template[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showGlobalTemplates, setShowGlobalTemplates] = useState(true);
  
  // Animation
  const [translateY] = useState(new Animated.Value(MODAL_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Load templates when modal opens
  useEffect(() => {
    if (visible && user?.locationId) {
      loadTemplates();
      animateIn();
    }
  }, [visible, user?.locationId]);

  // Load user preference for global templates toggle
  useEffect(() => {
    if (user?.preferences?.showGlobalTemplates !== undefined) {
      setShowGlobalTemplates(user.preferences.showGlobalTemplates);
    }
  }, [user?.preferences]);

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
    animateOut(() => {
      onClose();
      setSelectedTemplate(null);
    });
  };

  const loadTemplates = async () => {
    if (!user?.locationId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/api/templates/${user.locationId}`);
      
      if (response.data) {
        setLocationTemplates(response.data.locationTemplates || []);
        setGlobalTemplates(response.data.globalTemplates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      Alert.alert(
        'Error', 
        'Failed to load templates. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveGlobalTemplatePreference = async (value: boolean) => {
    if (!user?._id) return;
    
    try {
      // TODO: Create this API endpoint
      await api.patch(`/api/users/${user._id}`, {
        preferences: {
          ...user.preferences,
          showGlobalTemplates: value,
        },
      });
    } catch (error) {
      console.error('Failed to save preference:', error);
      // Don't show error to user - this is not critical
    }
  };

  const handleGlobalTemplateToggle = (value: boolean) => {
    setShowGlobalTemplates(value);
    saveGlobalTemplatePreference(value);
  };

  const handleSelectTemplate = (template: Template) => {
    // Simply select the template - no copying needed
    setSelectedTemplate(template);
  };

  const handleConfirmSelection = () => {
    if (selectedTemplate) {
      console.log('[TemplateModal] Confirming selection - selectedTemplate:', {
        id: selectedTemplate._id,
        name: selectedTemplate.name,
        hasStyling: !!selectedTemplate.styling,
        hasCompanyOverrides: !!selectedTemplate.companyOverrides,
        hasTabsArray: Array.isArray(selectedTemplate.tabs),
        tabsLength: selectedTemplate.tabs?.length,
        tabsStructure: selectedTemplate.tabs?.map(tab => ({
          id: tab?.id,
          hasBlocks: Array.isArray(tab?.blocks),
          blocksLength: tab?.blocks?.length
        }))
      });
      
      onSelectTemplate(selectedTemplate);
      handleClose();
    }
  };

  // Combine and filter templates for display
  const getDisplayTemplates = () => {
    console.log('[TemplateModal] getDisplayTemplates - locationTemplates:', locationTemplates);
    console.log('[TemplateModal] getDisplayTemplates - globalTemplates:', globalTemplates);
    
    const templates = [...(locationTemplates || [])];
    
    if (showGlobalTemplates) {
      templates.push(...(globalTemplates || []));
    }
    
    console.log('[TemplateModal] Combined templates before filter:', templates);
    
    // Filter by permissions if specified
const filtered = templates.filter(template => {
  // Allow all global templates regardless of permissions
  if (template.isGlobal) return true;
  
  // For location-specific templates, check permissions
  if (!userPermissions || !userPermissions.length) return true;
  if (template?.isDefault) return true;
  return userPermissions.includes(template?._id) || userPermissions.includes('all_templates');
});
    
    console.log('[TemplateModal] Filtered templates:', filtered);
    return filtered;
  };

  const renderSectionHeader = (title: string, count: number) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <Text style={styles.sectionHeaderCount}>({count})</Text>
    </View>
  );

  const renderTemplate = ({ item }: { item: Template }) => {
    const isSelected = selectedTemplate?._id === item._id;
    
    return (
      <TouchableOpacity
        style={[
          styles.templateCard,
          isSelected && [styles.selectedTemplateCard, { borderColor: item.styling.primaryColor }]
        ]}
        onPress={() => handleSelectTemplate(item)}
        activeOpacity={0.8}
      >
        {/* Template Preview */}
        <View style={[styles.templatePreview, { backgroundColor: item.styling.primaryColor }]}>
          <Text style={styles.templatePreviewIcon}>{item.preview || '📄'}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
            </View>
          )}
          {item.isGlobal && (
            <View style={[styles.globalBadge, { backgroundColor: item.styling.accentColor }]}>
              <Text style={styles.globalBadgeText}>GLOBAL</Text>
            </View>
          )}
        </View>

        {/* Template Info */}
        <View style={styles.templateInfo}>
          <View style={styles.templateHeader}>
            <Text style={styles.templateName}>{item.name}</Text>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={24} color={item.styling.primaryColor} />
            )}
          </View>
          
          <Text style={styles.templateDescription}>{item.description}</Text>
          
          {/* Template Meta */}
          <View style={styles.templateMeta}>
            <View style={styles.sectionCount}>
              <Ionicons name="layers-outline" size={16} color={COLORS.textGray} />
              <Text style={styles.sectionCountText}>
                {item.tabs?.filter(t => t.enabled).length || 0} sections
              </Text>
            </View>
            
            {/* Color Preview */}
            <View style={styles.colorPreview}>
              <View style={[styles.colorDot, { backgroundColor: item.styling.primaryColor }]} />
              <View style={[styles.colorDot, { backgroundColor: item.styling.accentColor }]} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  const displayTemplates = getDisplayTemplates();
  const locationCount = locationTemplates.length;
  const globalCount = showGlobalTemplates ? globalTemplates.length : 0;

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
            
            {/* Global Templates Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Show Global Templates</Text>
              <Switch
                value={showGlobalTemplates}
                onValueChange={handleGlobalTemplateToggle}
                trackColor={{ false: COLORS.border, true: COLORS.accent }}
                thumbColor={showGlobalTemplates ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Content - ✅ FIXED: Better flex and scrolling */}
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading templates...</Text>
              </View>
            ) : (
              <FlatList
                data={displayTemplates}
                renderItem={renderTemplate}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={true} // ✅ Changed to true to show scroll indicator
                contentContainerStyle={styles.templateList}
                style={styles.flatListStyle} // ✅ Added explicit style
                nestedScrollEnabled={true} // ✅ Enable nested scrolling
                bounces={true} // ✅ Enable bouncing for better UX
                ListHeaderComponent={() => (
                  <View>
                    {locationCount > 0 && (
                      <>
                        {renderSectionHeader('Your Custom Templates', locationCount)}
                        {/* Location templates will be rendered first in the list */}
                      </>
                    )}
                    {showGlobalTemplates && globalCount > 0 && locationCount > 0 && (
                      <View style={styles.sectionSeparator} />
                    )}
                    {showGlobalTemplates && globalCount > 0 && (
                      renderSectionHeader('Global Templates', globalCount)
                    )}
                  </View>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={64} color={COLORS.textLight} />
                    <Text style={styles.emptyTitle}>No templates found</Text>
                    <Text style={styles.emptySubtitle}>
                      {showGlobalTemplates 
                        ? 'No templates are available for your account'
                        : 'Enable global templates to see more options'
                      }
                    </Text>
                  </View>
                )}
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
    paddingVertical: 16, // ✅ Reduced from 20 to 16
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
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  toggleLabel: {
    fontSize: FONT.input,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  content: {
    flex: 1, // ✅ Ensure it takes remaining space
    paddingHorizontal: 20,
    minHeight: 0, // ✅ Allow shrinking
  },
  // ✅ NEW: Explicit FlatList style
  flatListStyle: {
    flex: 1,
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
    flexGrow: 1, // ✅ Allow content to grow
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  sectionHeaderCount: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 8,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  templateCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 12,
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
  globalBadge: {
    position: 'absolute',
    bottom: -6,
    left: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  globalBadgeText: {
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textGray,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FONT.input,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
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