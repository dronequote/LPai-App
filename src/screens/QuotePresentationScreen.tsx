import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  SafeAreaView,
  FlatList,
  Animated,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mock data representing what would come from MongoDB
const mockQuoteData = {
  quote: {
    _id: 'quote_123',
    quoteNumber: 'Q-2025-001',
    customerName: 'Michael Dean',
    projectTitle: 'Kitchen & Master Bath Remodel',
    totalAmount: 15750,
    sections: [
      {
        name: 'Fixtures',
        lineItems: [
          { name: 'Premium Kitchen Sink', quantity: 1, unitPrice: 450, totalPrice: 450 },
          { name: 'Master Bath Vanity', quantity: 1, unitPrice: 1200, totalPrice: 1200 },
          { name: 'Shower System', quantity: 1, unitPrice: 890, totalPrice: 890 },
        ],
        subtotal: 2540
      },
      {
        name: 'Labor & Installation',
        lineItems: [
          { name: 'Kitchen Plumbing Installation', quantity: 1, unitPrice: 2400, totalPrice: 2400 },
          { name: 'Bathroom Rough-in', quantity: 1, unitPrice: 1800, totalPrice: 1800 },
          { name: 'Fixture Installation', quantity: 8, unitPrice: 150, totalPrice: 1200 },
        ],
        subtotal: 5400
      }
    ],
    subtotal: 13950,
    taxAmount: 1116,
    total: 15750,
    termsAndConditions: 'Payment due within 30 days of completion. 50% deposit required.',
  },
  company: {
    name: 'Premier Plumbing Solutions',
    logo: '🔧', // In real app, this would be an image URL
    phone: '(555) 123-4567',
    email: 'info@premierplumbing.com',
    address: '123 Main Street, Anytown, CA 90210',
    tagline: 'Your trusted plumbing experts since 1995',
    establishedYear: '1995',
    warrantyYears: '5',
  },
  template: {
    name: 'Professional Plumbing Proposal',
    primaryColor: '#2E86AB',
    accentColor: '#A23B72',
    sections: [
      {
        id: 'company_intro',
        title: 'Why Choose {companyName}',
        enabled: true,
        order: 1,
        icon: '🏠'
      },
      {
        id: 'quote_details',
        title: 'Your Quote Details',
        enabled: true,
        order: 2,
        icon: '💰'
      },
      {
        id: 'our_process',
        title: 'Our Process',
        enabled: true,
        order: 3,
        icon: '⚙️'
      },
      {
        id: 'warranty_service',
        title: 'Warranty & Service',
        enabled: true,
        order: 4,
        icon: '🛡️'
      },
      {
        id: 'system_details',
        title: 'Project Details',
        enabled: true,
        order: 5,
        icon: '📋'
      }
    ]
  }
};

const QuotePresentationScreen = () => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const { quote, company, template } = mockQuoteData;
  const enabledSections = template.sections.filter(section => section.enabled);

  const handleTabPress = (index) => {
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

  // Replace template variables with actual data
  const replaceVariables = (text) => {
    return text
      .replace(/{companyName}/g, company.name)
      .replace(/{customerName}/g, quote.customerName)
      .replace(/{projectTitle}/g, quote.projectTitle)
      .replace(/{totalAmount}/g, `$${quote.total.toLocaleString()}`)
      .replace(/{establishedYear}/g, company.establishedYear)
      .replace(/{warrantyYears}/g, company.warrantyYears)
      .replace(/{phone}/g, company.phone)
      .replace(/{email}/g, company.email);
  };

  const renderCompanyIntro = () => (
    <ScrollView style={styles.sectionContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.heroSection}>
        <Text style={styles.heroEmoji}>{company.logo}</Text>
        <Text style={styles.heroTitle}>Why Choose {company.name}</Text>
        <Text style={styles.heroSubtitle}>{company.tagline}</Text>
      </View>

      <View style={styles.benefitsGrid}>
        <View style={styles.benefitCard}>
          <Text style={styles.benefitIcon}>🏆</Text>
          <Text style={styles.benefitTitle}>Expert Craftsmanship</Text>
          <Text style={styles.benefitText}>
            Professional plumbing solutions with over {company.establishedYear.slice(-2)} years of experience in residential and commercial projects.
          </Text>
        </View>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitIcon}>⚡</Text>
          <Text style={styles.benefitTitle}>Fast & Reliable</Text>
          <Text style={styles.benefitText}>
            Quick response times and efficient installations that minimize disruption to your daily routine.
          </Text>
        </View>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitIcon}>🛡️</Text>
          <Text style={styles.benefitTitle}>{company.warrantyYears}-Year Warranty</Text>
          <Text style={styles.benefitText}>
            Comprehensive warranty covering all materials and labor for complete peace of mind.
          </Text>
        </View>
      </View>

      <View style={styles.contactSection}>
        <Text style={styles.contactTitle}>Contact Information</Text>
        <Text style={styles.contactItem}>📞 {company.phone}</Text>
        <Text style={styles.contactItem}>✉️ {company.email}</Text>
        <Text style={styles.contactItem}>📍 {company.address}</Text>
      </View>
    </ScrollView>
  );

  const renderQuoteDetails = () => (
    <ScrollView style={styles.sectionContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.quoteHeader}>
        <Text style={styles.quoteTitle}>Quote #{quote.quoteNumber}</Text>
        <Text style={styles.quoteSubtitle}>{quote.projectTitle}</Text>
        <Text style={styles.quoteCustomer}>Prepared for: {quote.customerName}</Text>
      </View>

      <View style={styles.pricingBreakdown}>
        {quote.sections.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.name}</Text>
            {section.lineItems.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.lineItem}>
                <View style={styles.lineItemLeft}>
                  <Text style={styles.lineItemName}>{item.name}</Text>
                  <Text style={styles.lineItemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.lineItemPrice}>${item.totalPrice.toLocaleString()}</Text>
              </View>
            ))}
            <View style={styles.sectionTotal}>
              <Text style={styles.sectionTotalText}>Section Total: ${section.subtotal.toLocaleString()}</Text>
            </View>
          </View>
        ))}

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${quote.subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>${quote.taxAmount.toLocaleString()}</Text>
          </View>
          <View style={[styles.totalRow, styles.finalTotal]}>
            <Text style={styles.finalTotalLabel}>Total</Text>
            <Text style={styles.finalTotalValue}>${quote.total.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.termsSection}>
        <Text style={styles.termsTitle}>Terms & Conditions</Text>
        <Text style={styles.termsText}>{quote.termsAndConditions}</Text>
      </View>
    </ScrollView>
  );

  const renderOurProcess = () => (
    <ScrollView style={styles.sectionContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.processHeader}>
        <Text style={styles.processTitle}>The {company.name} Process</Text>
        <Text style={styles.processSubtitle}>From consultation to completion, we guide you through every step</Text>
      </View>

      <View style={styles.processSteps}>
        {[
          { step: 1, title: 'Initial Consultation', time: '1-2 days', description: 'Free in-home assessment and detailed quote preparation' },
          { step: 2, title: 'Project Planning', time: '3-5 days', description: 'Permit acquisition and material ordering' },
          { step: 3, title: 'Installation Begins', time: '1-3 days', description: 'Professional installation by certified technicians' },
          { step: 4, title: 'Quality Inspection', time: '1 day', description: 'Thorough testing and final walkthrough' },
          { step: 5, title: 'Project Complete', time: 'Same day', description: 'Final cleanup and warranty activation' }
        ].map((item, index) => (
          <View key={index} style={styles.processStep}>
            <View style={styles.processStepNumber}>
              <Text style={styles.processStepNumberText}>{item.step}</Text>
            </View>
            <View style={styles.processStepContent}>
              <View style={styles.processStepHeader}>
                <Text style={styles.processStepTitle}>{item.title}</Text>
                <Text style={styles.processStepTime}>{item.time}</Text>
              </View>
              <Text style={styles.processStepDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderWarrantyService = () => (
    <ScrollView style={styles.sectionContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.warrantyHeader}>
        <Text style={styles.warrantyTitle}>{company.warrantyYears}-Year Peace of Mind</Text>
        <Text style={styles.warrantySubtitle}>Comprehensive protection for your investment</Text>
      </View>

      <View style={styles.warrantyCards}>
        {[
          {
            icon: '🔧',
            title: 'Materials Warranty',
            subtitle: 'Manufacturer & Installation',
            description: 'All fixtures and materials covered against defects and installation issues'
          },
          {
            icon: '👨‍🔧',
            title: 'Labor Warranty',
            subtitle: 'Workmanship Guarantee',
            description: 'Professional installation work guaranteed for the full warranty period'
          },
          {
            icon: '🚨',
            title: 'Emergency Service',
            subtitle: '24/7 Support',
            description: 'Priority emergency service for warranty-covered issues'
          }
        ].map((item, index) => (
          <View key={index} style={styles.warrantyCard}>
            <Text style={styles.warrantyCardIcon}>{item.icon}</Text>
            <Text style={styles.warrantyCardTitle}>{item.title}</Text>
            <Text style={styles.warrantyCardSubtitle}>{item.subtitle}</Text>
            <Text style={styles.warrantyCardDescription}>{item.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.serviceInfo}>
        <Text style={styles.serviceInfoTitle}>What's Included in Your {company.warrantyYears}-Year Warranty</Text>
        <View style={styles.serviceInfoList}>
          <Text style={styles.serviceInfoItem}>✅ All fixtures and fittings</Text>
          <Text style={styles.serviceInfoItem}>✅ Installation workmanship</Text>
          <Text style={styles.serviceInfoItem}>✅ Water damage protection</Text>
          <Text style={styles.serviceInfoItem}>✅ Free annual inspections</Text>
          <Text style={styles.serviceInfoItem}>✅ Priority scheduling for service calls</Text>
          <Text style={styles.serviceInfoItem}>✅ Transferable warranty (if home is sold)</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderSystemDetails = () => (
    <ScrollView style={styles.sectionContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.detailsHeader}>
        <Text style={styles.detailsTitle}>Project Specifications</Text>
        <Text style={styles.detailsSubtitle}>Technical details and scope of work</Text>
      </View>

      <View style={styles.scopeSection}>
        <Text style={styles.scopeTitle}>Scope of Work</Text>
        <View style={styles.scopeList}>
          <Text style={styles.scopeItem}>🔹 Kitchen sink and faucet replacement</Text>
          <Text style={styles.scopeItem}>🔹 Master bathroom vanity installation</Text>
          <Text style={styles.scopeItem">🔹 Shower system upgrade with modern fixtures</Text>
          <Text style={styles.scopeItem">🔹 Water line routing and connections</Text>
          <Text style={styles.scopeItem">🔹 Drain line installation and testing</Text>
          <Text style={styles.scopeItem">🔹 Pressure testing and system certification</Text>
        </View>
      </View>

      <View style={styles.specificationsGrid}>
        <View style={styles.specCard}>
          <Text style={styles.specTitle}>Materials Used</Text>
          <Text style={styles.specText}>• Premium PEX tubing</Text>
          <Text style={styles.specText}>• Brass fittings and valves</Text>
          <Text style={styles.specText}>• Code-compliant fixtures</Text>
        </View>
        <View style={styles.specCard}>
          <Text style={styles.specTitle}>Timeline</Text>
          <Text style={styles.specText}>• Start: Within 1 week</Text>
          <Text style={styles.specText}>• Duration: 2-3 days</Text>
          <Text style={styles.specText}>• Completion: Full testing</Text>
        </View>
      </View>

      <View style={styles.permitsSection}>
        <Text style={styles.permitsTitle}>Permits & Compliance</Text>
        <Text style={styles.permitsText}>
          All work will be performed to local building codes and permit requirements. 
          We handle all permit applications and inspections to ensure your project meets 
          all safety and regulatory standards.
        </Text>
      </View>
    </ScrollView>
  );

  const getSectionContent = (sectionId) => {
    switch (sectionId) {
      case 'company_intro': return renderCompanyIntro();
      case 'quote_details': return renderQuoteDetails();
      case 'our_process': return renderOurProcess();
      case 'warranty_service': return renderWarrantyService();
      case 'system_details': return renderSystemDetails();
      default: return <View><Text>Section not found</Text></View>;
    }
  };

  const renderSection = ({ item, index }) => (
    <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
      {getSectionContent(item.id)}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={template.primaryColor} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: template.primaryColor }]}>
        <TouchableOpacity style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proposal Presentation</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Text style={styles.shareButtonText}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollView}>
          {enabledSections.map((section, index) => (
            <TouchableOpacity
              key={section.id}
              style={[
                styles.tab,
                activeTabIndex === index && [styles.activeTab, { borderBottomColor: template.accentColor }]
              ]}
              onPress={() => handleTabPress(index)}
            >
              <Text style={styles.tabIcon}>{section.icon}</Text>
              <Text style={[
                styles.tabText,
                activeTabIndex === index && [styles.activeTabText, { color: template.accentColor }]
              ]}>
                {replaceVariables(section.title)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <FlatList
        ref={flatListRef}
        data={enabledSections}
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
          onPress={() => console.log('Save for later')}
        >
          <Text style={styles.secondaryButtonText}>Save for Later</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: template.primaryColor }]} 
          onPress={() => console.log('Get Signature')}
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
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
  shareButtonText: {
    fontSize: 16,
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

  // Company Intro Styles
  heroSection: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 30,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  benefitsGrid: {
    gap: 16,
    marginBottom: 30,
  },
  benefitCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  benefitIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  benefitTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  contactSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactItem: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },

  // Quote Details Styles
  quoteHeader: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quoteTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  quoteSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  quoteCustomer: {
    fontSize: 16,
    color: '#6b7280',
  },
  pricingBreakdown: {
    gap: 16,
    marginBottom: 24,
  },
  sectionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lineItemLeft: {
    flex: 1,
  },
  lineItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  lineItemQty: {
    fontSize: 14,
    color: '#6b7280',
  },
  lineItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'flex-end',
  },
  sectionTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  finalTotal: {
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    marginTop: 8,
  },
  finalTotalLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  finalTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  termsSection: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  termsText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },

  // Process Styles
  processHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  processTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  processSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  processSteps: {
    gap: 20,
  },
  processStep: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  processStepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E86AB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  processStepNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  processStepContent: {
    flex: 1,
  },
  processStepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  processStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  processStepTime: {
    fontSize: 14,
    color: '#A23B72',
    fontWeight: '500',
  },
  processStepDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },

  // Warranty Styles
  warrantyHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  warrantyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  warrantySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: '