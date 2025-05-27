// src/screens/QuoteEditorScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Project, Quote, QuoteSection, QuoteLineItem, ProductLibrary, LibraryItem } from '../../packages/types/dist';
import TemplateSelectionModal from '../components/TemplateSelectionModal';

// Global variable to store quote data for navigation (workaround for React Navigation serialization issues)
global.tempQuoteData = null;

type QuoteEditorRouteParams = {
  mode: 'create' | 'edit';
  project?: Project;
  quote?: Quote;
};

export default function QuoteEditorScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const { mode, project, quote: existingQuote } = route.params as QuoteEditorRouteParams;

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [libraries, setLibraries] = useState<ProductLibrary[]>([]);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  
  // Create a ref to store quote data for navigation
  const quoteDataRef = useRef<any>(null);
  
  // Quote Data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<QuoteSection[]>([]);
  const [taxRate, setTaxRate] = useState(0.08); // 8% default tax
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [termsAndConditions, setTermsAndConditions] = useState('Payment due within 30 days of completion.');
  const [paymentTerms, setPaymentTerms] = useState('50% deposit required to begin work.');
  const [notes, setNotes] = useState('');

  // UI State
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showLibraryBrowser, setShowLibraryBrowser] = useState(false);
  const [selectedSectionForItem, setSelectedSectionForItem] = useState<string | null>(null);
  const [showTemplateSelection, setShowTemplateSelection] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load libraries - TODO: Create /api/libraries endpoint
      // if (user?.locationId) {
      //   const librariesRes = await api.get('/api/libraries', {
      //     params: { locationId: user.locationId }
      //   });
      //   setLibraries(librariesRes.data || []);
      // }
      setLibraries([]); // Set empty array for now
      
      // Set initial data based on mode
      if (mode === 'create' && project) {
        // Creating new quote
        setTitle(`${project.contactName} - ${project.title} Quote`);
        setDescription(`Quote for ${project.title}`);
        
        // Create default sections
        const defaultSections: QuoteSection[] = [
          {
            id: 'materials',
            name: 'Materials',
            lineItems: [],
            subtotal: 0,
            isCollapsed: false,
          },
          {
            id: 'labor',
            name: 'Labor',
            lineItems: [],
            subtotal: 0,
            isCollapsed: false,
          }
        ];
        setSections(defaultSections);
        setExpandedSections(new Set(['materials', 'labor']));
        
      } else if (mode === 'edit' && existingQuote) {
        // Editing existing quote
        setTitle(existingQuote.title);
        setDescription(existingQuote.description || '');
        setSections(existingQuote.sections || []);
        setTaxRate(existingQuote.taxRate);
        setDiscountPercentage(existingQuote.discountPercentage || 0);
        setTermsAndConditions(existingQuote.termsAndConditions || '');
        setPaymentTerms(existingQuote.paymentTerms || '');
        setNotes(existingQuote.notes || '');
        
        // Expand all sections by default when editing
        const sectionIds = new Set(existingQuote.sections?.map(s => s.id) || []);
        setExpandedSections(sectionIds);
      }
      
    } catch (error) {
      console.error('[QuoteEditor] Failed to load initial data:', error);
      console.error('[QuoteEditor] Error response:', error.response?.data);
      console.error('[QuoteEditor] Error status:', error.response?.status);
      console.error('[QuoteEditor] Request URL:', error.config?.url);
      console.error('[QuoteEditor] Request params:', error.config?.params);
      Alert.alert('Error', 'Failed to load quote data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const subtotal = sections.reduce((sum, section) => sum + section.subtotal, 0);
    const discountAmount = subtotal * (discountPercentage / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    const total = taxableAmount + taxAmount;
    
    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };
  }, [sections, taxRate, discountPercentage]);

  // Add new section
  const addSection = () => {
    const newSection: QuoteSection = {
      id: Date.now().toString(),
      name: 'New Section',
      lineItems: [],
      subtotal: 0,
      isCollapsed: false,
    };
    
    setSections([...sections, newSection]);
    setExpandedSections(prev => new Set([...prev, newSection.id]));
    setEditingSection(newSection.id);
  };

  // Update section name
  const updateSectionName = (sectionId: string, newName: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, name: newName }
        : section
    ));
  };

  // Delete section
  const deleteSection = (sectionId: string) => {
    Alert.alert(
      'Delete Section',
      'Are you sure you want to delete this section and all its items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSections(prev => prev.filter(section => section.id !== sectionId));
            setExpandedSections(prev => {
              const newSet = new Set(prev);
              newSet.delete(sectionId);
              return newSet;
            });
          }
        }
      ]
    );
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Add line item to section
  const addLineItem = (sectionId: string, item?: LibraryItem) => {
    const newLineItem: QuoteLineItem = {
      id: Date.now().toString(),
      libraryItemId: item?.id,
      name: item?.name || 'Custom Item',
      description: item?.description || '',
      quantity: 1,
      unitPrice: item ? (item.basePrice * item.markup) : 0,
      totalPrice: item ? (item.basePrice * item.markup) : 0,
      unit: item?.unit || 'each',
      sku: item?.sku || '',
      isCustomItem: !item,
    };

    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const updatedLineItems = [...section.lineItems, newLineItem];
        const subtotal = updatedLineItems.reduce((sum, lineItem) => sum + lineItem.totalPrice, 0);
        
        return {
          ...section,
          lineItems: updatedLineItems,
          subtotal,
        };
      }
      return section;
    }));
  };

  // Update line item
  const updateLineItem = (sectionId: string, itemId: string, updates: Partial<QuoteLineItem>) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const updatedLineItems = section.lineItems.map(item => {
          if (item.id === itemId) {
            const updatedItem = { ...item, ...updates };
            // Recalculate total price
            updatedItem.totalPrice = updatedItem.quantity * updatedItem.unitPrice;
            return updatedItem;
          }
          return item;
        });
        
        const subtotal = updatedLineItems.reduce((sum, lineItem) => sum + lineItem.totalPrice, 0);
        
        return {
          ...section,
          lineItems: updatedLineItems,
          subtotal,
        };
      }
      return section;
    }));
  };

  // Delete line item
  const deleteLineItem = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const updatedLineItems = section.lineItems.filter(item => item.id !== itemId);
        const subtotal = updatedLineItems.reduce((sum, lineItem) => sum + lineItem.totalPrice, 0);
        
        return {
          ...section,
          lineItems: updatedLineItems,
          subtotal,
        };
      }
      return section;
    }));
  };

  // Form validation
  const isFormValid = () => {
    return title.trim() && sections.length > 0;
  };

  // Build quote data object
  const buildQuoteData = () => {
    return {
      title: title.trim(),
      description: description.trim(),
      sections,
      taxRate,
      discountPercentage,
      termsAndConditions: termsAndConditions.trim(),
      paymentTerms: paymentTerms.trim(),
      notes: notes.trim(),
      projectId: project?._id || existingQuote?.projectId,
      contactId: project?.contactId || existingQuote?.contactId,
      locationId: user?.locationId,
      userId: user?._id,
    };
  };

  // Save quote (regular save)
  const saveQuote = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a quote title');
      return;
    }

    if (!user?.locationId) {
      Alert.alert('Error', 'Missing location information');
      return;
    }

    try {
      setSaving(true);
      
      const quoteData = buildQuoteData();
      
      if (mode === 'create') {
        const response = await api.post('/api/quotes', quoteData);
        console.log('[QuoteEditor] Created quote:', response.data.quoteNumber);
        
        Alert.alert(
          'Success',
          `Quote ${response.data.quoteNumber} created successfully!`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            }
          ]
        );
      } else if (existingQuote) {
        await api.patch(`/api/quotes/${existingQuote._id}`, {
          ...quoteData,
          action: 'update_content',
          locationId: user.locationId,
        });
        
        console.log('[QuoteEditor] Updated quote:', existingQuote.quoteNumber);
        
        Alert.alert(
          'Success',
          'Quote updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('[QuoteEditor] Failed to save quote:', error);
      Alert.alert('Error', 'Failed to save quote. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Present quote (save first, then show template selection)
  const handlePresentQuote = async () => {
    console.log('[QuoteEditor] ===== HANDLE PRESENT QUOTE STARTED =====');
    
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a quote title before presenting');
      return;
    }

    if (!user?.locationId) {
      Alert.alert('Error', 'Missing location information');
      return;
    }

    try {
      setSaving(true);
      
      // Debug: Check sections data before saving
      console.log('[QuoteEditor] Sections before save:', {
        sectionsLength: sections.length,
        sectionsType: typeof sections,
        isArray: Array.isArray(sections),
        firstSection: sections[0]
      });
      
      const quoteData = buildQuoteData();
      
      // Debug: Check quote data structure
      console.log('[QuoteEditor] QuoteData being saved:', {
        hasSections: !!quoteData.sections,
        sectionsLength: quoteData.sections?.length,
        sectionsType: typeof quoteData.sections,
        isArray: Array.isArray(quoteData.sections)
      });

      let quoteId;
      if (mode === 'create') {
        const response = await api.post('/api/quotes', quoteData);
        quoteId = response.data._id;
        console.log('[QuoteEditor] Created quote for presentation:', response.data.quoteNumber);
      } else if (existingQuote) {
        await api.patch(`/api/quotes/${existingQuote._id}`, {
          ...quoteData,
          action: 'update_content',
          locationId: user.locationId,
        });
        quoteId = existingQuote._id;
        console.log('[QuoteEditor] Updated quote for presentation:', existingQuote.quoteNumber);
      }

      // Store the saved quote ID for later use
      setSavedQuoteId(quoteId);

      // Show template selection modal
      setShowTemplateSelection(true);
      
    } catch (error) {
      console.error('[QuoteEditor] Failed to save quote before presentation:', error);
      Alert.alert('Error', 'Failed to save quote. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle template selection and navigate to presentation
  const handleTemplateSelected = async (template) => {
    console.log('[QuoteEditor] ===== HANDLE TEMPLATE SELECTED =====');
    
    if (!savedQuoteId || !user?.locationId) {
      Alert.alert('Error', 'Quote data not available');
      return;
    }

    try {
      console.log('[QuoteEditor] Fetching fresh quote data from DB, quoteId:', savedQuoteId);
      
      // Fetch the complete, fresh quote from database
      const response = await api.get(`/api/quotes/${savedQuoteId}`, {
        params: { locationId: user.locationId }
      });
      
      const freshQuoteData = response.data;
      
      console.log('[QuoteEditor] Fresh quote data structure:', {
        id: freshQuoteData._id,
        quoteNumber: freshQuoteData.quoteNumber,
        hasSections: Array.isArray(freshQuoteData.sections),
        sectionsLength: freshQuoteData.sections?.length,
        sectionsData: freshQuoteData.sections,
        sectionsActualValue: JSON.stringify(freshQuoteData.sections),
        hasContact: !!freshQuoteData.contact,
        hasProject: !!freshQuoteData.project,
        fullObject: freshQuoteData
      });

      // CRITICAL FIX: Deep clone and ensure sections is always an array
      const sectionsArray = Array.isArray(freshQuoteData.sections) 
        ? JSON.parse(JSON.stringify(freshQuoteData.sections))  // Deep clone
        : [];

      console.log('[QuoteEditor] Sections processing:', {
        originalSections: freshQuoteData.sections,
        originalType: typeof freshQuoteData.sections,
        originalIsArray: Array.isArray(freshQuoteData.sections),
        processedSections: sectionsArray,
        processedType: typeof sectionsArray,
        processedIsArray: Array.isArray(sectionsArray),
        processedLength: sectionsArray.length
      });

      const quoteForNavigation = {
        _id: freshQuoteData._id,
        quoteNumber: freshQuoteData.quoteNumber,
        contactName: freshQuoteData.contactName,
        customerName: freshQuoteData.contactName || freshQuoteData.customerName,
        projectTitle: freshQuoteData.projectTitle || freshQuoteData.title,
        title: freshQuoteData.title,
        sections: sectionsArray,  // Use the processed array
        subtotal: freshQuoteData.subtotal || 0,
        taxAmount: freshQuoteData.taxAmount || 0,
        total: freshQuoteData.total || 0,
        termsAndConditions: freshQuoteData.termsAndConditions || '',
        paymentTerms: freshQuoteData.paymentTerms || '',
        notes: freshQuoteData.notes || '',
        contact: freshQuoteData.contact,
        project: freshQuoteData.project,
      };

      console.log('[QuoteEditor] Quote prepared for navigation:', {
        id: quoteForNavigation._id,
        hasSections: Array.isArray(quoteForNavigation.sections),
        sectionsLength: quoteForNavigation.sections?.length,
        sectionsType: typeof quoteForNavigation.sections,
        sectionsValue: JSON.stringify(quoteForNavigation.sections),
        customerName: quoteForNavigation.customerName,
        termsAndConditions: quoteForNavigation.termsAndConditions
      });

      // Navigate to presentation with sanitized data
      navigation.navigate('QuotePresentation', {
        quoteId: savedQuoteId,
        template: template,
      });
            
    } catch (error) {
      console.error('[QuoteEditor] Failed to fetch quote for presentation:', error);
      Alert.alert('Error', 'Failed to load quote data for presentation');
    }
  };

  // Open library browser
  const openLibraryBrowser = (sectionId: string) => {
    setSelectedSectionForItem(sectionId);
    // TODO: Navigate to LibraryBrowserScreen
    // For now, let's add a simple custom item
    addLineItem(sectionId);
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading quote editor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === 'create' ? 'Create Quote' : 'Edit Quote'}
          </Text>
          <TouchableOpacity onPress={saveQuote} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Ionicons name="checkmark" size={24} color={COLORS.accent} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Quote Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quote Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Quote title"
                placeholderTextColor={COLORS.textGray}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Quote description (optional)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={COLORS.textGray}
              />
            </View>
          </View>

          {/* Line Items Sections */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Line Items</Text>
              <TouchableOpacity style={styles.addButton} onPress={addSection}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addButtonText}>Section</Text>
              </TouchableOpacity>
            </View>

            {sections.map((section) => (
              <View key={section.id} style={styles.sectionCard}>
                {/* Section Header */}
                <TouchableOpacity 
                  style={styles.sectionCardHeader}
                  onPress={() => toggleSection(section.id)}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons 
                      name={expandedSections.has(section.id) ? "chevron-down" : "chevron-forward"} 
                      size={20} 
                      color={COLORS.textGray} 
                    />
                    {editingSection === section.id ? (
                      <TextInput
                        style={styles.sectionNameInput}
                        value={section.name}
                        onChangeText={(text) => updateSectionName(section.id, text)}
                        onBlur={() => setEditingSection(null)}
                        onSubmitEditing={() => setEditingSection(null)}
                        autoFocus
                      />
                    ) : (
                      <Text style={styles.sectionName}>{section.name}</Text>
                    )}
                  </View>
                  
                  <View style={styles.sectionHeaderRight}>
                    <Text style={styles.sectionTotal}>
                      ${section.subtotal.toLocaleString()}
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setEditingSection(section.id)}
                      style={styles.sectionAction}
                    >
                      <Ionicons name="pencil" size={16} color={COLORS.textGray} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => deleteSection(section.id)}
                      style={styles.sectionAction}
                    >
                      <Ionicons name="trash" size={16} color={COLORS.textRed} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Section Content */}
                {expandedSections.has(section.id) && (
                  <View style={styles.sectionContent}>
                    {section.lineItems.map((item) => (
                      <LineItemRow
                        key={item.id}
                        item={item}
                        onUpdate={(updates) => updateLineItem(section.id, item.id, updates)}
                        onDelete={() => deleteLineItem(section.id, item.id)}
                      />
                    ))}
                    
                    {/* Add Item Button */}
                    <TouchableOpacity 
                      style={styles.addItemButton}
                      onPress={() => openLibraryBrowser(section.id)}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
                      <Text style={styles.addItemText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Pricing Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            
            <View style={styles.pricingCard}>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Subtotal</Text>
                <Text style={styles.pricingValue}>${totals.subtotal.toLocaleString()}</Text>
              </View>
              
              <View style={styles.pricingRow}>
                <View style={styles.pricingInputRow}>
                  <Text style={styles.pricingLabel}>Discount</Text>
                  <TextInput
                    style={styles.percentInput}
                    value={discountPercentage.toString()}
                    onChangeText={(text) => setDiscountPercentage(parseFloat(text) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.percentSymbol}>%</Text>
                </View>
                <Text style={styles.pricingValue}>-${totals.discountAmount.toLocaleString()}</Text>
              </View>
              
              <View style={styles.pricingRow}>
                <View style={styles.pricingInputRow}>
                  <Text style={styles.pricingLabel}>Tax</Text>
                  <TextInput
                    style={styles.percentInput}
                    value={(taxRate * 100).toString()}
                    onChangeText={(text) => setTaxRate((parseFloat(text) || 0) / 100)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.percentSymbol}>%</Text>
                </View>
                <Text style={styles.pricingValue}>${totals.taxAmount.toLocaleString()}</Text>
              </View>
              
              <View style={[styles.pricingRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${totals.total.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Terms & Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Notes</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Terms & Conditions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={termsAndConditions}
                onChangeText={setTermsAndConditions}
                placeholder="Terms and conditions"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={COLORS.textGray}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Terms</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={paymentTerms}
                onChangeText={setPaymentTerms}
                placeholder="Payment terms"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={COLORS.textGray}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes (optional)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={COLORS.textGray}
              />
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={{ height: 50 }} />
        </ScrollView>

        {/* Save Container - Updated with two buttons */}
        <View style={styles.saveContainer}>
          <TouchableOpacity 
            style={[styles.saveButton, styles.secondaryButton]}
            onPress={saveQuote}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.textDark} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {mode === 'create' ? 'Save Draft' : 'Save Changes'}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.saveButton, 
              styles.primaryButton,
              (!isFormValid() || saving) && styles.saveButtonDisabled
            ]}
            onPress={handlePresentQuote}
            disabled={!isFormValid() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Present Quote</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        visible={showTemplateSelection}
        onClose={() => setShowTemplateSelection(false)}
        onSelectTemplate={handleTemplateSelected}
        userPermissions={user?.permissions || []}
      />
    </SafeAreaView>
  );
}

// Line Item Component
const LineItemRow = ({ 
  item, 
  onUpdate, 
  onDelete 
}: { 
  item: QuoteLineItem; 
  onUpdate: (updates: Partial<QuoteLineItem>) => void;
  onDelete: () => void;
}) => {
  return (
    <View style={styles.lineItem}>
      <View style={styles.lineItemHeader}>
        <TextInput
          style={styles.itemNameInput}
          value={item.name}
          onChangeText={(text) => onUpdate({ name: text })}
          placeholder="Item name"
          placeholderTextColor={COLORS.textGray}
        />
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={16} color={COLORS.textRed} />
        </TouchableOpacity>
      </View>
      
      {item.description ? (
        <TextInput
          style={styles.itemDescInput}
          value={item.description}
          onChangeText={(text) => onUpdate({ description: text })}
          placeholder="Description"
          multiline
          placeholderTextColor={COLORS.textGray}
        />
      ) : null}
      
      <View style={styles.lineItemRow}>
        <View style={styles.quantityContainer}>
          <Text style={styles.lineItemLabel}>Qty</Text>
          <TextInput
            style={styles.quantityInput}
            value={item.quantity.toString()}
            onChangeText={(text) => onUpdate({ quantity: parseFloat(text) || 1 })}
            keyboardType="numeric"
          />
        </View>
        
        <View style={styles.priceContainer}>
          <Text style={styles.lineItemLabel}>Price</Text>
          <TextInput
            style={styles.priceInput}
            value={item.unitPrice.toString()}
            onChangeText={(text) => onUpdate({ unitPrice: parseFloat(text) || 0 })}
            keyboardType="numeric"
            placeholder="0.00"
          />
        </View>
        
        <View style={styles.totalContainer}>
          <Text style={styles.lineItemLabel}>Total</Text>
          <Text style={styles.totalText}>${item.totalPrice.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: FONT.input,
    color: COLORS.textGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: COLORS.card,
    padding: 12,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: FONT.meta,
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Section Card Styles
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    marginBottom: 16,
    ...SHADOW.card,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionName: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginLeft: 8,
  },
  sectionNameInput: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginLeft: 8,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
    paddingVertical: 4,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTotal: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.accent,
    marginRight: 12,
  },
  sectionAction: {
    padding: 8,
    marginLeft: 4,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  
  // Line Item Styles
  lineItem: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.input,
    padding: 12,
    marginBottom: 8,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNameInput: {
    flex: 1,
    fontSize: FONT.input,
    fontWeight: '500',
    color: COLORS.textDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 4,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  itemDescInput: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 4,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityContainer: {
    flex: 1,
    marginRight: 12,
  },
  priceContainer: {
    flex: 2,
    marginRight: 12,
  },
  totalContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  lineItemLabel: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    padding: 8,
    fontSize: FONT.meta,
    textAlign: 'center',
  },
  priceInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    padding: 8,
    fontSize: FONT.meta,
  },
  totalText: {
    fontSize: FONT.meta,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  addItemText: {
    fontSize: FONT.input,
    color: COLORS.accent,
    fontWeight: '500',
    marginLeft: 8,
  },
  
  // Pricing Styles
  pricingCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    ...SHADOW.card,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pricingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  pricingValue: {
    fontSize: FONT.input,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  percentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    padding: 6,
    fontSize: FONT.meta,
    textAlign: 'center',
    width: 60,
    marginLeft: 8,
  },
  percentSymbol: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 4,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  totalValue: {
    fontSize: FONT.sectionTitle,
    fontWeight: '700',
    color: COLORS.accent,
  },
  
  // Save Container and Button Styles
  saveContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  saveButton: {
    borderRadius: RADIUS.button,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.textGray,
  },
  secondaryButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
    marginRight: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    flex: 1,
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: COLORS.textDark,
    fontSize: FONT.input,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
});