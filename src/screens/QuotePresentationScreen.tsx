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

const QuotePresentationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Get quote and template from route params with safety checks
  const routeParams = route.params as { quote: any; template: Template } || {};
  const { quote, template } = routeParams;
  
  console.log('[QuotePresentation] ===== STARTING QUOTE PRESENTATION =====');
  console.log('[QuotePresentation] Route params received:', { 
    hasQuote: !!quote, 
    hasTemplate: !!template 
  });
  
  // CRITICAL: Log the actual quote object structure
  if (quote) {
    console.log('[QuotePresentation] Quote object:', {
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      customerName: quote.customerName,
      contactName: quote.contactName,
      hasTermsAndConditions: quote.hasOwnProperty('termsAndConditions'),
      termsAndConditions: quote.termsAndConditions,
      total: quote.total,
      sections: Array.isArray(quote.sections) ? quote.sections.length : 'NOT_ARRAY'
    });
  } else {
    console.log('[QuotePresentation] Quote object is NULL/UNDEFINED');
  }
  
  if (template) {
    console.log('[QuotePresentation] Template check:', {
      id: template._id,
      name: template.name,
      hasTabsArray: Array.isArray(template.tabs),
      tabsLength: template.tabs?.length,
      tabsType: typeof template.tabs,
      tabs: template.tabs
    });
    
    // Log each tab structure
    if (template.tabs && Array.isArray(template.tabs)) {
      template.tabs.forEach((tab, index) => {
        console.log(`[QuotePresentation] Tab ${index}:`, {
          id: tab?.id,
          title: tab?.title,
          enabled: tab?.enabled,
          hasBlocks: Array.isArray(tab?.blocks),
          blocksLength: tab?.blocks?.length,
          blocksType: typeof tab?.blocks
        });
      });
    }
  }
  
  console.log('[QuotePresentation] About to call getEnabledTabs...');
  
  // Safety check - if no template, show error
  if (!template) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>No template provided</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // State
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [companyData, setCompanyData] = useState<CompanyData>({});
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Load company data on mount
  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    if (!user?.locationId) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get(`/api/locations/byLocation?locationId=${user.locationId}`);
      
      if (response.data?.companyInfo) {
        setCompanyData(response.data.companyInfo);
      }
    } catch (error) {
      console.error('[QuotePresentation] Failed to load company data:', error);
      // Continue with empty company data - not critical
    } finally {
      setLoading(false);
    }
  };

  // Build variables object for template rendering
  const buildVariables = () => {
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
      customerName: quote.customerName || quote.contactName || 'Customer',
      projectTitle: quote.projectTitle || quote.title || 'Project',
      totalAmount: quote.total ? `$${quote.total.toLocaleString()}` : '$0',
      termsAndConditions: quote.termsAndConditions || 'Standard terms and conditions apply.',
      paymentTerms: quote.paymentTerms || 'Payment due upon completion.',
      notes: quote.notes || '',
    };
  };

  // Get enabled tabs sorted by order
  const getEnabledTabs = () => {
    console.log('[QuotePresentation] Getting enabled tabs, template.tabs:', template?.tabs);
    
    if (!template?.tabs || !Array.isArray(template.tabs)) {
      console.log('[QuotePresentation] No valid tabs array found');
      return [];
    }
    
    const enabledTabs = template.tabs
      .filter(tab => {
        console.log('[QuotePresentation] Checking tab:', tab?.id, 'enabled:', tab?.enabled);
        return tab && tab.enabled === true;
      })
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
    navigation.navigate('SignatureCapture', { quote, template });
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={template?.styling?.primaryColor || '#2E86AB'} />
          <Text style={styles.loadingText}>Loading presentation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const enabledTabs = getEnabledTabs();
  const variables = buildVariables();

  // Safety check - don't render if no enabled tabs
  if (!enabledTabs || enabledTabs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>No template sections available</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
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
  backButton: {
    backgroundColor: '#2E86AB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QuotePresentationScreen;