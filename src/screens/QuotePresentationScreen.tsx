// src/screens/QuotePresentationScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  SafeAreaView,
  FlatList,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import BlockRenderer from '../components/BlockRenderer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Template {
  _id: string;
  name: string;
  styling: {
    primaryColor: string;
    accentColor: string;
  };
  companyOverrides: {
    name?: string;
    logo?: string;
    tagline?: string;
    phone?: string;
    email?: string;
    address?: string;
    establishedYear?: string;
    warrantyYears?: string;
  };
  tabs: Array<{
    id: string;
    title: string;
    icon: string;
    enabled: boolean;
    order: number;
    blocks: Array<{
      id: string;
      type: string;
      position: number;
      content: any;
    }>;
  }>;
}

interface CompanyData {
  name?: string;
  logo?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  establishedYear?: string;
  warrantyYears?: string;
  website?: string;
  licenseNumber?: string;
}

interface QuotePresentationRouteParams {
  quoteId?: string;  // Primary approach - fetch fresh data
  template: Template;
  quote?: any;       // Fallback for backward compatibility
}

const QuotePresentationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Get params with safety checks
  const routeParams = route.params as QuotePresentationRouteParams || {};
  const { quoteId, template, quote: fallbackQuote } = routeParams;
  
  console.log('[QuotePresentation] ===== STARTING CLEAN QUOTE PRESENTATION =====');
  console.log('[QuotePresentation] Route params received:', { 
    hasQuoteId: !!quoteId,
    hasTemplate: !!template,
    hasFallbackQuote: !!fallbackQuote,
    templateName: template?.name
  });
  
  // State
  const [quote, setQuote] = useState<any>(null);
  const [companyData, setCompanyData] = useState<CompanyData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Safety check - if no template, show error
  if (!template) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
          <Text style={styles.errorTitle}>No Template Provided</Text>
          <Text style={styles.errorSubtitle}>Unable to display quote presentation</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Load data on mount
  useEffect(() => {
    loadPresentationData();
  }, []);

  const loadPresentationData = async () => {
    console.log('[QuotePresentation] Loading presentation data...');
    
    if (!user?.locationId) {
      setError('Missing location information');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Parallel loading of quote and company data
      const dataPromises = [];

      // 1. Load quote data (primary approach: fetch by ID, fallback to passed data)
      if (quoteId) {
        console.log('[QuotePresentation] Fetching fresh quote data for ID:', quoteId);
        dataPromises.push(
          api.get(`/api/quotes/${quoteId}`, {
            params: { locationId: user.locationId }
          }).then(response => ({ type: 'quote', data: response.data }))
        );
      } else if (fallbackQuote) {
        console.log('[QuotePresentation] Using fallback quote data');
        dataPromises.push(
          Promise.resolve({ type: 'quote', data: fallbackQuote })
        );
      } else {
        throw new Error('No quote data available (no quoteId or fallback quote)');
      }

      // 2. Load company data
      dataPromises.push(
        api.get(`/api/locations/byLocation`, {
          params: { locationId: user.locationId }
        }).then(response => ({ type: 'company', data: response.data }))
        .catch(error => {
          console.warn('[QuotePresentation] Company data fetch failed, using defaults:', error);
          return { type: 'company', data: {} }; // Non-critical failure
        })
      );

      // Wait for all data
      const results = await Promise.allSettled(dataPromises);
      
      // Process results
      let quoteData = null;
      let companyInfo = {};

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'quote') {
            quoteData = result.value.data;
          } else if (result.value.type === 'company') {
            companyInfo = result.value.data.companyInfo || result.value.data || {};
          }
        }
      });

      if (!quoteData) {
        throw new Error('Failed to load quote data');
      }

      // Ensure sections is always an array (critical fix)
      const sectionsArray = Array.isArray(quoteData.sections) 
        ? JSON.parse(JSON.stringify(quoteData.sections))  // Deep clone
        : [];

      const processedQuote = {
        ...quoteData,
        sections: sectionsArray,
        // Ensure we have required fields with fallbacks
        customerName: quoteData.contactName || quoteData.customerName || 'Customer',
        projectTitle: quoteData.projectTitle || quoteData.title || 'Project',
        termsAndConditions: quoteData.termsAndConditions || 'Standard terms and conditions apply.',
        paymentTerms: quoteData.paymentTerms || 'Payment due upon completion.',
        notes: quoteData.notes || '',
      };

      console.log('[QuotePresentation] Data loaded successfully:', {
        quoteId: processedQuote._id,
        quoteNumber: processedQuote.quoteNumber,
        sectionsCount: processedQuote.sections.length,
        hasCompanyData: Object.keys(companyInfo).length > 0,
        customerName: processedQuote.customerName,
        total: processedQuote.total
      });

      setQuote(processedQuote);
      setCompanyData(companyInfo);

    } catch (error) {
      console.error('[QuotePresentation] Failed to load presentation data:', error);
      setError(error.message || 'Failed to load quote data');
    } finally {
      setLoading(false);
    }
  };

  // Build variables object for template rendering
  const buildVariables = () => {
    if (!quote) return {};

    const currentYear = new Date().getFullYear();
    const establishedYear = parseInt(
      template?.companyOverrides?.establishedYear || 
      companyData.establishedYear || 
      currentYear.toString()
    );
    const experienceYears = currentYear - establishedYear;

    return {
      // Company variables (template overrides take priority)
      companyName: template?.companyOverrides?.name || companyData.name || 'Your Company',
      companyLogo: template?.companyOverrides?.logo || companyData.logo || '🏢',
      companyTagline: template?.companyOverrides?.tagline || companyData.tagline || 'Professional service you can trust',
      phone: template?.companyOverrides?.phone || companyData.phone || '',
      email: template?.companyOverrides?.email || companyData.email || '',
      address: template?.companyOverrides?.address || companyData.address || '',
      establishedYear: template?.companyOverrides?.establishedYear || companyData.establishedYear || currentYear.toString(),
      warrantyYears: template?.companyOverrides?.warrantyYears || companyData.warrantyYears || '1',
      experienceYears: experienceYears.toString(),
      
      // Quote variables
      quoteNumber: quote.quoteNumber || 'Q-XXXX-XXX',
      customerName: quote.customerName,
      projectTitle: quote.projectTitle,
      totalAmount: quote.total ? `$${quote.total.toLocaleString()}` : '$0',
      termsAndConditions: quote.termsAndConditions,
      paymentTerms: quote.paymentTerms,
      notes: quote.notes,
    };
  };

  // Get enabled tabs sorted by order
  const getEnabledTabs = () => {
    if (!template?.tabs || !Array.isArray(template.tabs)) {
      console.log('[QuotePresentation] No valid tabs array found');
      return [];
    }
    
    const enabledTabs = template.tabs
      .filter(tab => tab && tab.enabled === true)
      .sort((a, b) => (a?.order || 0) - (b?.order || 0));
    
    console.log('[QuotePresentation] Enabled tabs count:', enabledTabs.length);
    return enabledTabs;
  };

  // Handle tab navigation
  const handleTabPress = (index: number) => {
    setActiveTabIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveTabIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Replace variables in text
  const replaceVariables = (text: string, variables: Record<string, string>): string => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value || `{${key}}`);
    });
    return result;
  };

  // Action handlers
  const handleClose = () => {
    navigation.goBack();
  };

  const handleShare = () => {
    Alert.alert('Share Proposal', 'Share functionality will be implemented here');
  };

  const handleSaveForLater = () => {
    Alert.alert('Save for Later', 'Proposal saved to drafts');
  };

  const handleGetSignature = () => {
    // Pass both quote and template to signature screen
    navigation.navigate('SignatureCapture', { quote, template });
  };

  const handleRetry = () => {
    loadPresentationData();
  };

  // Render tab content using BlockRenderer
  const renderTabContent = (tab: any) => {
    if (!tab?.blocks || !Array.isArray(tab.blocks)) {
      return (
        <ScrollView style={styles.sectionContainer}>
          <View style={styles.emptyContent}>
            <Text style={styles.emptyText}>No content available for this section</Text>
          </View>
        </ScrollView>
      );
    }

    const variables = buildVariables();
    
    // Sort blocks by position
    const sortedBlocks = [...tab.blocks].sort((a, b) => a.position - b.position);

    return (
      <ScrollView style={styles.sectionContainer} showsVerticalScrollIndicator={false}>
        {sortedBlocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            styling={template?.styling || { primaryColor: '#2E86AB', accentColor: '#A23B72' }}
            variables={variables}
            quote={quote}
          />
        ))}
      </ScrollView>
    );
  };

  const renderSection = ({ item: tab, index }) => (
    <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
      {renderTabContent(tab)}
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={template?.styling?.primaryColor || '#2E86AB'} />
          <Text style={styles.loadingText}>Loading presentation...</Text>
          <Text style={styles.loadingSubtext}>Fetching quote and company data</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
          <Text style={styles.errorTitle}>Failed to Load Quote</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // No quote data
  if (!quote) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="document-outline" size={64} color="#6b7280" />
          <Text style={styles.errorTitle}>No Quote Data</Text>
          <Text style={styles.errorSubtitle}>Unable to find quote information</Text>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const enabledTabs = getEnabledTabs();
  const variables = buildVariables();

  // No enabled tabs
  if (!enabledTabs || enabledTabs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="layers-outline" size={64} color="#6b7280" />
          <Text style={styles.errorTitle}>No Template Sections</Text>
          <Text style={styles.errorSubtitle}>This template has no enabled sections to display</Text>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main presentation render
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={template?.styling?.primaryColor || '#2E86AB'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: template?.styling?.primaryColor || '#2E86AB' }]}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proposal Presentation</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollView}>
          {enabledTabs.map((tab, index) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTabIndex === index && [styles.activeTab, { borderBottomColor: template?.styling?.accentColor || '#A23B72' }]
              ]}
              onPress={() => handleTabPress(index)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[
                styles.tabText,
                activeTabIndex === index && [styles.activeTabText, { color: template?.styling?.accentColor || '#A23B72' }]
              ]}>
                {replaceVariables(tab.title, variables)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <FlatList
        ref={flatListRef}
        data={enabledTabs}
        renderItem={renderSection}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
      />

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]} 
          onPress={handleSaveForLater}
        >
          <Text style={styles.secondaryButtonText}>Save for Later</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: template?.styling?.primaryColor || '#2E86AB' }]} 
          onPress={handleGetSignature}
        >
          <Text style={styles.primaryButtonText}>Get Signature</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  errorSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#2E86AB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  tabScrollView: {
    flexGrow: 0,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minWidth: 120,
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  activeTabText: {
    fontWeight: '600',
  },
  slideContainer: {
    flex: 1,
  },
  sectionContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  primaryButton: {
    backgroundColor: '#2E86AB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default QuotePresentationScreen;