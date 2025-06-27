// src/screens/QuoteEditorScreen.tsx
// Updated: 2025-06-26
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { quoteService } from '../services/quoteService';
import { libraryService } from '../services/libraryService';
import { templateService } from '../services/templateService';
import api from '../lib/api'; // Temporarily import API directly
import { COLORS, FONT, RADIUS, SHADOW, SIZES } from '../styles/theme';
import type { Project, Quote, QuoteSection, QuoteLineItem, ProductLibrary, LibraryItem, Contact } from '../../packages/types/dist';
import TemplateSelectionModal from '../components/TemplateSelectionModal';

// Global variable to store quote data for navigation (workaround for React Navigation serialization issues)
global.tempQuoteData = null;

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

type QuoteEditorRouteParams = {
  mode: 'create' | 'edit';
  project?: Project;
  quote?: Quote;
  contact?: Contact;
  opportunityId?: string;
  opportunityTitle?: string;
  createNewOpportunity?: boolean;
};

type TabType = 'details' | 'items' | 'pricing' | 'terms';

// Define the service name for this component
const serviceName = 'quotes';

export default function QuoteEditorScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const { 
    mode, 
    project, 
    quote: existingQuote,
    contact,
    opportunityId,
    opportunityTitle,
    createNewOpportunity 
  } = route.params as QuoteEditorRouteParams;

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [libraries, setLibraries] = useState<ProductLibrary[]>([]);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  
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

  // ADD DEPOSIT FIELDS
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>('percentage');
  const [depositValue, setDepositValue] = useState(0); // Either % or fixed amount

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
      
      // Load libraries
      if (user?.locationId) {
        const librariesData = await libraryService.getLibraries(user.locationId);
        setLibraries(librariesData || []);
      }
      
      // Set initial data based on mode
      if (mode === 'create') {
        // Creating new quote with contact data passed from QuoteBuilder
        if (contact) {
          const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
                            contact.companyName || 
                            contact.email || 
                            'Unknown Customer';
          
          setTitle(`${contactName} - ${opportunityTitle || 'Quote'}`);
          setDescription(`Quote for ${opportunityTitle || contactName}`);
        } else if (project) {
          // Legacy support for project-based creation
          setTitle(`${project.contactName} - ${project.title} Quote`);
          setDescription(`Quote for ${project.title}`);
        }
        
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
        
        // ADD: Load deposit fields
        setDepositType(existingQuote.depositType || 'percentage');
        setDepositValue(existingQuote.depositValue || 0);
        
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

  // Calculate totals - FIXED: Removed depositAmount from state updates
  const calculateTotals = useCallback(() => {
    const subtotal = sections.reduce((sum, section) => sum + section.subtotal, 0);
    const discountAmount = subtotal * (discountPercentage / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    const total = taxableAmount + taxAmount;
    
    // Calculate deposit amount
    let calculatedDeposit = 0;
    if (depositType === 'percentage' && depositValue > 0) {
      calculatedDeposit = (total * depositValue) / 100;
    } else if (depositType === 'fixed' && depositValue > 0) {
      calculatedDeposit = depositValue;
    }
    
    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
      depositAmount: calculatedDeposit,
    };
  }, [sections, taxRate, discountPercentage, depositType, depositValue]);

  // Get totals without triggering re-renders
  const totals = calculateTotals();

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
    const calculatedTotals = calculateTotals();
    
    // Determine contact and project IDs based on what was passed
    let finalContactId = contact?._id || project?.contactId || existingQuote?.contactId;
    let finalProjectId = opportunityId || project?._id || existingQuote?.projectId;
    
    // Ensure all required fields are present
    const quoteData = {
      title: title.trim(),
      description: description.trim(),
      sections: sections || [],
      taxRate: taxRate || 0.08,
      discountPercentage: discountPercentage || 0,
      discountAmount: totals.discountAmount || 0,
      termsAndConditions: termsAndConditions.trim(),
      paymentTerms: paymentTerms.trim(),
      notes: notes.trim(),
      depositType: depositType || 'percentage',
      depositValue: depositValue || 0,
      depositAmount: calculatedTotals.depositAmount || 0,
      projectId: finalProjectId,
      contactId: finalContactId,
      locationId: user?.locationId,
      userId: user?._id,
      // Add calculated totals
      subtotal: calculatedTotals.subtotal || 0,
      taxAmount: calculatedTotals.taxAmount || 0,
      total: calculatedTotals.total || 0,
    };
    
    if (__DEV__) {
      console.log('[QuoteEditor] Building quote data:', quoteData);
    }
    
    return quoteData;
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
      
      if (__DEV__) {
        console.log('[QuoteEditor] Saving quote with data:', quoteData);
      }
      
      if (mode === 'create') {
        // Use API directly for create as well
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
      } else if (existingQuote?._id) {
        // For update, use API directly to avoid service issues
        const updatePayload = {
          title: quoteData.title,
          description: quoteData.description,
          sections: quoteData.sections,
          taxRate: quoteData.taxRate,
          discountPercentage: quoteData.discountPercentage,
          discountAmount: quoteData.discountAmount,
          depositType: quoteData.depositType,
          depositValue: quoteData.depositValue,
          depositAmount: quoteData.depositAmount,
          termsAndConditions: quoteData.termsAndConditions,
          paymentTerms: quoteData.paymentTerms,
          notes: quoteData.notes,
          subtotal: quoteData.subtotal,
          taxAmount: quoteData.taxAmount,
          total: quoteData.total,
          locationId: user.locationId,
          action: 'update_content',
        };
        
        const response = await api.patch(`/api/quotes/${existingQuote._id}`, updatePayload);
        
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
      console.error('[QuoteEditor] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to save quote. Please try again.');
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
        isArray: Array.isArray(quoteData.sections),
        hasLocationId: !!quoteData.locationId,
        hasProjectId: !!quoteData.projectId,
      });

      let quoteId;
      if (mode === 'create') {
        // Use API directly for create
        const response = await api.post('/api/quotes', quoteData);
        quoteId = response.data._id;
        console.log('[QuoteEditor] Created quote for presentation:', response.data.quoteNumber);
        
        // Small delay to ensure DB write completes
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (existingQuote?._id) {
        // For update, use API directly to avoid service issues
        const updatePayload = {
          title: quoteData.title,
          description: quoteData.description,
          sections: quoteData.sections,
          taxRate: quoteData.taxRate,
          discountPercentage: quoteData.discountPercentage,
          discountAmount: quoteData.discountAmount,
          depositType: quoteData.depositType,
          depositValue: quoteData.depositValue,
          depositAmount: quoteData.depositAmount,
          termsAndConditions: quoteData.termsAndConditions,
          paymentTerms: quoteData.paymentTerms,
          notes: quoteData.notes,
          subtotal: quoteData.subtotal,
          taxAmount: quoteData.taxAmount,
          total: quoteData.total,
          locationId: user.locationId,
          action: 'update_content',
        };
        
        const response = await api.patch(`/api/quotes/${existingQuote._id}`, updatePayload);
        
        quoteId = existingQuote._id;
        console.log('[QuoteEditor] Updated quote for presentation:', existingQuote.quoteNumber);
      }

      // Store the saved quote ID for later use
      setSavedQuoteId(quoteId);
      
      console.log('[QuoteEditor] Saved quote ID for presentation:', quoteId);

      // Show template selection modal
      setShowTemplateSelection(true);
      
    } catch (error) {
      console.error('[QuoteEditor] Failed to save quote before presentation:', error);
      console.error('[QuoteEditor] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to save quote. Please try again.');
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
      
      // Fetch the complete, fresh quote from database using API directly
      try {
        const response = await api.get(`/api/quotes/${savedQuoteId}?locationId=${user.locationId}`);
        const freshQuoteData = response.data;
        
        console.log('[QuoteEditor] Fresh quote data structure:', {
          id: freshQuoteData._id,
          quoteNumber: freshQuoteData.quoteNumber,
          hasSections: Array.isArray(freshQuoteData.sections),
          sectionsLength: freshQuoteData.sections?.length,
          sectionsData: freshQuoteData.sections,
          hasContact: !!freshQuoteData.contact,
          hasProject: !!freshQuoteData.project,
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
          depositType: freshQuoteData.depositType,
          depositValue: freshQuoteData.depositValue,
          depositAmount: freshQuoteData.depositAmount,
        };

        console.log('[QuoteEditor] Quote prepared for navigation:', {
          id: quoteForNavigation._id,
          hasSections: Array.isArray(quoteForNavigation.sections),
          sectionsLength: quoteForNavigation.sections?.length,
          sectionsType: typeof quoteForNavigation.sections,
          customerName: quoteForNavigation.customerName,
          depositAmount: quoteForNavigation.depositAmount
        });

        // Navigate to presentation with sanitized data
        navigation.navigate('QuotePresentation', {
          quoteId: savedQuoteId,
          template: template,
        });
      } catch (fetchError) {
        console.error('[QuoteEditor] Failed to fetch quote:', fetchError);
        console.error('[QuoteEditor] Fetch error response:', fetchError.response?.data);
        
        // If fetch fails, try to navigate with the ID anyway
        navigation.navigate('QuotePresentation', {
          quoteId: savedQuoteId,
          template: template,
        });
      }
            
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

  // Get display names for customer info
  const getCustomerDisplayName = () => {
    if (contact) {
      const firstName = contact.firstName || '';
      const lastName = contact.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || contact.companyName || contact.email || 'Unknown Customer';
    }
    return project?.contactName || existingQuote?.contactName || 'Unknown';
  };

  const getProjectDisplayName = () => {
    return opportunityTitle || project?.title || existingQuote?.projectTitle || 'Unknown';
  };

  // Get customer details for display
  const getCustomerDetails = () => {
    if (contact) {
      return {
        name: getCustomerDisplayName(),
        phone: contact.phone || 'No phone',
        email: contact.email || 'No email',
        address: contact.address1 ? 
          `${contact.address1}${contact.address2 ? ' ' + contact.address2 : ''}, ${contact.city || ''} ${contact.state || ''} ${contact.postalCode || ''}`.trim() : 
          'No address'
      };
    }
    return null;
  };

  // Tab configuration
  const tabs = [
    { id: 'details', label: 'Details', icon: 'document-text-outline' },
    { id: 'items', label: 'Items', icon: 'list-outline' },
    { id: 'pricing', label: 'Pricing', icon: 'calculator-outline' },
    { id: 'terms', label: 'Terms', icon: 'shield-checkmark-outline' },
  ];

  // Render tab content
  const renderTabContent = () => {
    const customerDetails = getCustomerDetails();
    
    switch (activeTab) {
      case 'details':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
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

              {/* Customer Info Card */}
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Customer Information</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>
                    {getCustomerDisplayName()}
                  </Text>
                </View>
                
                {customerDetails && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone</Text>
                      <Text style={styles.infoValue}>
                        {customerDetails.phone}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Email</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {customerDetails.email}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Address</Text>
                      <Text style={styles.infoValue} numberOfLines={2}>
                        {customerDetails.address}
                      </Text>
                    </View>
                  </>
                )}
                
                <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 8 }]}>
                  <Text style={styles.infoLabel}>Project</Text>
                  <Text style={styles.infoValue}>
                    {getProjectDisplayName()}
                  </Text>
                </View>
                
                {existingQuote && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Quote #</Text>
                    <Text style={styles.infoValue}>{existingQuote.quoteNumber}</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        );

      case 'items':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
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

              {sections.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color={COLORS.textGray} />
                  <Text style={styles.emptyStateText}>No sections yet</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Add a section to start building your quote
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        );

      case 'pricing':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            {/* Pricing Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pricing Summary</Text>
              
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

            {/* Deposit Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deposit</Text>
              
              <View style={styles.depositCard}>
                <Text style={styles.label}>Deposit Type</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[styles.toggle, depositType === 'percentage' && styles.activeToggle]}
                    onPress={() => setDepositType('percentage')}
                  >
                    <Text style={[styles.toggleText, depositType === 'percentage' && styles.activeToggleText]}>
                      Percentage %
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggle, depositType === 'fixed' && styles.activeToggle]}
                    onPress={() => setDepositType('fixed')}
                  >
                    <Text style={[styles.toggleText, depositType === 'fixed' && styles.activeToggleText]}>
                      Fixed Amount $
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {depositType === 'percentage' ? 'Deposit Percentage' : 'Deposit Amount'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={depositValue.toString()}
                    onChangeText={(text) => setDepositValue(parseFloat(text) || 0)}
                    keyboardType="numeric"
                    placeholder={depositType === 'percentage' ? "50" : "500"}
                    placeholderTextColor={COLORS.textGray}
                  />
                </View>

                {depositValue > 0 && (
                  <View style={styles.depositPreview}>
                    <Text style={styles.depositPreviewLabel}>Deposit Due:</Text>
                    <Text style={styles.depositPreviewValue}>
                      ${totals.depositAmount.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        );

      case 'terms':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Terms & Conditions</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={termsAndConditions}
                  onChangeText={setTermsAndConditions}
                  placeholder="Terms and conditions"
                  multiline
                  numberOfLines={4}
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
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholderTextColor={COLORS.textGray}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { height: 120 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes (optional)"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  placeholderTextColor={COLORS.textGray}
                />
              </View>
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

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
          <View style={{ width: 24 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id as TabType)}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={20} 
                color={activeTab === tab.id ? COLORS.accent : COLORS.textGray} 
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {renderTabContent()}
        </View>

        {/* Action Buttons - Always visible */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={saveQuote}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.textDark} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={COLORS.textDark} />
                <Text style={styles.secondaryButtonText}>
                  {mode === 'create' ? 'Save Draft' : 'Save Changes'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.primaryButton,
              (!isFormValid() || saving) && styles.actionButtonDisabled
            ]}
            onPress={handlePresentQuote}
            disabled={!isFormValid() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Present Quote</Text>
              </>
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
  
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    fontWeight: '500',
    marginLeft: 6,
  },
  activeTabText: {
    color: COLORS.accent,
  },
  
  // Content
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  section: {
    marginTop: 24,
    marginBottom: 24,
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
  
  // Info Card
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginTop: 16,
    ...SHADOW.card,
  },
  infoCardTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    flex: 0.35,
  },
  infoValue: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    fontWeight: '500',
    flex: 0.65,
    textAlign: 'right',
  },
  
  // Form Inputs
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
    height: 100,
    textAlignVertical: 'top',
  },
  
  // Buttons
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
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: FONT.sectionTitle,
    color: COLORS.textGray,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    marginTop: 8,
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
  
  // Deposit Styles
  depositCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    ...SHADOW.card,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: RADIUS.input,
    overflow: 'hidden',
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeToggle: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  toggleText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#fff',
  },
  depositPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  depositPreviewLabel: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  depositPreviewValue: {
    fontSize: FONT.sectionTitle,
    fontWeight: '700',
    color: COLORS.accent,
  },
  
  // Action Container
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  actionButton: {
    borderRadius: RADIUS.button,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.textGray,
  },
  secondaryButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
  },
  secondaryButtonText: {
    color: COLORS.textDark,
    fontSize: FONT.input,
    fontWeight: '600',
    marginLeft: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
    marginLeft: 8,
  },
});