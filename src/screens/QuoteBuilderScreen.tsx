// src/screens/QuoteBuilderScreen.tsx
// Updated: 2025-01-19
// Clean iOS-style design with expandable opportunity cards

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Dimensions,
  Animated,
  LayoutAnimation,
  UIManager,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { contactService } from '../services/contactService';
import { quoteService } from '../services/quoteService';
import { projectService } from '../services/projectService';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Contact, Quote, Project } from '../../packages/types';
import AddContactForm from '../components/AddContactForm';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Filter options
const FILTER_OPTIONS = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'draft', label: 'Draft', icon: 'create' },
  { id: 'sent', label: 'Sent', icon: 'send' },
  { id: 'viewed', label: 'Viewed', icon: 'eye' },
  { id: 'presented', label: 'Presented', icon: 'tv' },
];

const SORT_OPTIONS = [
  { id: 'date', label: 'Date', icon: 'calendar' },
  { id: 'amount', label: 'Amount', icon: 'cash' },
  { id: 'status', label: 'Status', icon: 'flag' },
  { id: 'customer', label: 'Customer', icon: 'person' },
];

// Quote status colors
const STATUS_COLORS = {
  draft: '#95A5A6',
  sent: '#3498DB',
  viewed: '#9B59B6',
  presented: '#E67E22',
  accepted: '#27AE60',
  declined: '#E74C3C',
  expired: '#F39C12',
};

interface OpportunityGroup {
  id: string;
  contactId: string;
  contactName: string;
  contactCompany?: string;
  opportunityTitle: string;
  quotes: Quote[];
  totalAmount: number;
  hasViewed: boolean;
  hasPresented: boolean;
}

export default function QuoteBuilderScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const route = useRoute();
  
  // State
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedSort, setSelectedSort] = useState('date');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSort, setContactSort] = useState('name'); // name, recent, company
  const [contactFilter, setContactFilter] = useState('all'); // all, withProjects, withoutProjects
  const [showContactSortOptions, setShowContactSortOptions] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  
  // Animation values
  const sortAnimHeight = useRef(new Animated.Value(0)).current;
  const contactSortAnimHeight = useRef(new Animated.Value(0)).current;
  
  // Load data
  const loadData = useCallback(async () => {
    if (!user?.locationId) return;
    
    try {
      setLoading(true);
      
      const [quotesData, contactsData, opportunitiesData] = await Promise.all([
        quoteService.list(user.locationId),
        contactService.list(user.locationId, { limit: 100 }),
        projectService.list(user.locationId),
      ]);
      
      // Filter quotes - only show non-accepted/declined quotes
      const activeQuotes = quotesData.filter((q: Quote) => 
        q.status !== 'accepted' && q.status !== 'declined'
      );
      
      // Filter opportunities - only show open ones
      const openOpportunities = opportunitiesData.filter((p: Project) => 
        p.status === 'open'
      );
      
      setQuotes(activeQuotes);
      setContacts(contactsData);
      setOpportunities(openOpportunities);
      
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load quotes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle create contact
  const handleCreateContact = async (contactData: any) => {
    try {
      // Add locationId to the contact data
      const newContact = await contactService.create({
        ...contactData,
        locationId: user?.locationId,
      });
      
      // Close the add contact modal
      setShowAddContactModal(false);
      
      // Reload contacts to include the new one
      await loadData();
      
      // Show contact picker and auto-select the new contact
      setShowContactPicker(true);
      
      // Give a slight delay to ensure modal is open and data is loaded
      setTimeout(() => {
        handleSelectContact(newContact);
      }, 300);
      
    } catch (error) {
      console.error('Failed to create contact:', error);
      Alert.alert('Error', 'Failed to create contact. Please try again.');
    }
  };

  // Group quotes by opportunity
  const opportunityGroups = useMemo(() => {
    const groups: { [key: string]: OpportunityGroup } = {};
    
    quotes.forEach(quote => {
      const contact = contacts.find(c => c._id === quote.contactId);
      if (!contact) return;
      
      // Use opportunity ID or create a fake one for quotes without opportunities
      const opportunityId = quote.opportunityId || `contact-${contact._id}`;
      const opportunity = opportunities.find(o => o._id === opportunityId);
      
      if (!groups[opportunityId]) {
        groups[opportunityId] = {
          id: opportunityId,
          contactId: contact._id,
          contactName: `${contact.firstName} ${contact.lastName}`,
          contactCompany: contact.companyName,
          opportunityTitle: opportunity?.title || quote.title || 'General Quote',
          quotes: [],
          totalAmount: 0,
          hasViewed: false,
          hasPresented: false,
        };
      }
      
      groups[opportunityId].quotes.push(quote);
      groups[opportunityId].totalAmount += quote.totalAmount || 0;
      
      if (quote.status === 'viewed' || quote.viewedAt) {
        groups[opportunityId].hasViewed = true;
      }
      if (quote.status === 'presented' || quote.presentedAt) {
        groups[opportunityId].hasPresented = true;
      }
    });
    
    return Object.values(groups);
  }, [quotes, contacts, opportunities]);

  // Apply filters and search
  const filteredGroups = useMemo(() => {
    let filtered = opportunityGroups;
    
    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(group => 
        group.quotes.some(q => q.status === selectedFilter)
      );
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(group =>
        group.contactName.toLowerCase().includes(query) ||
        group.opportunityTitle.toLowerCase().includes(query) ||
        group.quotes.some(q => 
          q.quoteNumber?.toLowerCase().includes(query) ||
          q.title?.toLowerCase().includes(query)
        )
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (selectedSort) {
        case 'amount':
          return b.totalAmount - a.totalAmount;
        case 'customer':
          return a.contactName.localeCompare(b.contactName);
        case 'status':
          // Sort by most recent activity
          const aLatest = Math.max(...a.quotes.map(q => new Date(q.updatedAt || q.createdAt).getTime()));
          const bLatest = Math.max(...b.quotes.map(q => new Date(q.updatedAt || q.createdAt).getTime()));
          return bLatest - aLatest;
        case 'date':
        default:
          const aDate = Math.max(...a.quotes.map(q => new Date(q.createdAt).getTime()));
          const bDate = Math.max(...b.quotes.map(q => new Date(q.createdAt).getTime()));
          return bDate - aDate;
      }
    });
    
    return filtered;
  }, [opportunityGroups, selectedFilter, selectedSort, searchQuery]);

  // Toggle card expansion
  const toggleExpanded = (groupId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Toggle sort options
  const toggleSortOptions = () => {
    const toValue = showSortOptions ? 0 : 50;
    Animated.timing(sortAnimHeight, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setShowSortOptions(!showSortOptions);
  };

  // Navigate to create quote
  const handleCreateQuote = (group?: OpportunityGroup) => {
    if (group) {
      // Create quote for existing opportunity
      const contact = contacts.find(c => c._id === group.contactId);
      navigation.navigate('QuoteEditor', {
        mode: 'create',
        contact,
        opportunityId: group.id,
        createNewOpportunity: false,
      });
    } else {
      // Show contact picker modal
      setShowContactPicker(true);
    }
  };

  // Handle contact selection from picker
  const handleSelectContact = (contact: Contact) => {
    setShowContactPicker(false);
    setContactSearchQuery('');
    
    // Check if contact has existing opportunities
    const contactOpportunities = opportunities.filter(o => o.contactId === contact._id);
    
    if (contactOpportunities.length > 0) {
      // Show opportunity picker
      Alert.alert(
        'Select Project',
        'Would you like to add this quote to an existing project or create a new one?',
        [
          {
            text: 'New Project',
            onPress: () => {
              navigation.navigate('QuoteEditor', {
                mode: 'create',
                contact,
                createNewOpportunity: true,
              });
            },
          },
          ...contactOpportunities.map(opp => ({
            text: opp.title || 'Unnamed Project',
            onPress: () => {
              navigation.navigate('QuoteEditor', {
                mode: 'create',
                contact,
                opportunityId: opp._id,
                createNewOpportunity: false,
              });
            },
          })),
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } else {
      // Create new opportunity
      navigation.navigate('QuoteEditor', {
        mode: 'create',
        contact,
        createNewOpportunity: true,
      });
    }
  };

  // Navigate to edit quote
  const handleEditQuote = (quote: Quote) => {
    navigation.navigate('QuoteEditor', {
      mode: 'edit',
      quote,
    });
  };

  // Navigate to present quote
  const handlePresentQuote = (quote: Quote) => {
    navigation.navigate('QuotePresentation', { 
      quoteId: quote._id,
    });
  };

  // Quick actions
  const handleQuoteAction = async (quote: Quote, action: string) => {
    switch (action) {
      case 'send':
        try {
          await quoteService.sendEmail(quote._id);
          Alert.alert('Success', 'Quote sent');
          loadData();
        } catch (error) {
          Alert.alert('Error', 'Failed to send quote');
        }
        break;
      case 'present':
        handlePresentQuote(quote);
        break;
      case 'duplicate':
        try {
          await quoteService.duplicate(quote._id);
          Alert.alert('Success', 'Quote duplicated');
          loadData();
        } catch (error) {
          Alert.alert('Error', 'Failed to duplicate quote');
        }
        break;
      case 'delete':
        Alert.alert(
          'Delete Quote',
          'Are you sure you want to delete this quote?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await quoteService.delete(quote._id);
                  loadData();
                } catch (error) {
                  Alert.alert('Error', 'Failed to delete quote');
                }
              },
            },
          ]
        );
        break;
    }
  };

  // Render opportunity card
  const renderOpportunityCard = ({ item: group }: { item: OpportunityGroup }) => {
    const isExpanded = expandedCards.has(group.id);
    const primaryQuote = group.quotes[0]; // Show first quote as primary
    
    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity 
          style={styles.cardHeader}
          onPress={() => toggleExpanded(group.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeaderLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {group.contactName.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.contactName}>{group.contactName}</Text>
              <Text style={styles.opportunityTitle}>
                {group.opportunityTitle}
                {group.quotes.length > 1 && ` (+${group.quotes.length - 1} more)`}
              </Text>
            </View>
          </View>
          
          <View style={styles.cardHeaderRight}>
            <Text style={styles.totalAmount}>${group.totalAmount.toLocaleString()}</Text>
            <View style={styles.statusIndicators}>
              {group.hasPresented && (
                <View style={[styles.statusIcon, { backgroundColor: STATUS_COLORS.presented }]}>
                  <Ionicons name="tv" size={10} color={COLORS.white} />
                </View>
              )}
              {group.hasViewed && (
                <View style={[styles.statusIcon, { backgroundColor: STATUS_COLORS.viewed }]}>
                  <Ionicons name="eye" size={10} color={COLORS.white} />
                </View>
              )}
            </View>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={COLORS.textGray} 
            />
          </View>
        </TouchableOpacity>
        
        {/* Quick stats */}
        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{group.quotes.length}</Text>
            <Text style={styles.statLabel}>Quotes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {group.quotes.filter(q => q.status === 'viewed').length}
            </Text>
            <Text style={styles.statLabel}>Viewed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              ${(group.totalAmount / group.quotes.length).toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Avg Value</Text>
          </View>
        </View>
        
        {/* Expanded content */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {group.quotes.map((quote, index) => (
              <TouchableOpacity
                key={quote._id}
                style={[styles.quoteItem, index === 0 && styles.firstQuoteItem]}
                onPress={() => handleEditQuote(quote)}
              >
                <View style={styles.quoteItemHeader}>
                  <View>
                    <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
                    <Text style={styles.quoteTitle}>{quote.title || 'Untitled'}</Text>
                  </View>
                  <View style={styles.quoteItemRight}>
                    <Text style={styles.quoteAmount}>${(quote.totalAmount || 0).toLocaleString()}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[quote.status] + '20' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[quote.status] }]}>
                        {quote.status}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.quoteActions}>
                  {quote.status === 'draft' && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleQuoteAction(quote, 'send')}
                    >
                      <Ionicons name="send" size={16} color={COLORS.accent} />
                      <Text style={styles.actionText}>Send</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleQuoteAction(quote, 'present')}
                  >
                    <Ionicons name="tv" size={16} color={COLORS.accent} />
                    <Text style={styles.actionText}>Present</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleQuoteAction(quote, 'duplicate')}
                  >
                    <Ionicons name="copy" size={16} color={COLORS.textGray} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleQuoteAction(quote, 'delete')}
                  >
                    <Ionicons name="trash" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity 
              style={styles.addQuoteButton}
              onPress={() => handleCreateQuote(group)}
            >
              <Ionicons name="add" size={20} color={COLORS.accent} />
              <Text style={styles.addQuoteText}>Add Quote to Project</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Filter and sort contacts for picker
  const filteredContacts = useMemo(() => {
    let filtered = [...contacts];
    
    // Apply search filter
    if (contactSearchQuery.trim()) {
      const query = contactSearchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(query) ||
        contact.companyName?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.phone?.includes(query)
      );
    }
    
    // Apply filter
    if (contactFilter === 'withProjects') {
      const contactsWithProjects = new Set(opportunities.map(o => o.contactId));
      filtered = filtered.filter(c => contactsWithProjects.has(c._id));
    } else if (contactFilter === 'withoutProjects') {
      const contactsWithProjects = new Set(opportunities.map(o => o.contactId));
      filtered = filtered.filter(c => !contactsWithProjects.has(c._id));
    }
    
    // Apply sorting with unnamed contacts at bottom
    filtered.sort((a, b) => {
      // Check if contacts have names
      const aHasName = Boolean(a.firstName || a.lastName);
      const bHasName = Boolean(b.firstName || b.lastName);
      
      // If one has name and other doesn't, sort unnamed to bottom
      if (aHasName && !bHasName) return -1;
      if (!aHasName && bHasName) return 1;
      
      // Otherwise apply selected sort
      switch (contactSort) {
        case 'name':
          const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
          const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
          return aName.localeCompare(bName);
        case 'company':
          return (a.companyName || '').localeCompare(b.companyName || '');
        case 'recent':
          return new Date(b.updatedAt || b.createdAt).getTime() - 
                 new Date(a.updatedAt || a.createdAt).getTime();
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [contacts, contactSearchQuery, contactSort, contactFilter, opportunities]);

  // Render contact picker modal
  const renderContactPicker = () => {
    // Define toggle function inside renderContactPicker
    const handleToggleContactSort = () => {
      const toValue = showContactSortOptions ? 0 : 150;
      Animated.timing(contactSortAnimHeight, {
        toValue,
        duration: 200,
        useNativeDriver: false,
      }).start();
      setShowContactSortOptions(!showContactSortOptions);
    };
    
    return (
      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowContactPicker(false);
              setContactSearchQuery('');
              setShowContactSortOptions(false);
            }}>
              <Ionicons name="close" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Contact</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.modalSearch}>
            <Ionicons name="search" size={20} color={COLORS.textGray} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search contacts..."
              placeholderTextColor={COLORS.textGray}
              value={contactSearchQuery}
              onChangeText={setContactSearchQuery}
              autoFocus
            />
            {contactSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setContactSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Contact Filters */}
          <View style={styles.contactFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <TouchableOpacity
                style={[styles.contactFilterPill, contactFilter === 'all' && styles.contactFilterActive]}
                onPress={() => setContactFilter('all')}
              >
                <Text style={[styles.contactFilterText, contactFilter === 'all' && styles.contactFilterTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactFilterPill, contactFilter === 'withProjects' && styles.contactFilterActive]}
                onPress={() => setContactFilter('withProjects')}
              >
                <Text style={[styles.contactFilterText, contactFilter === 'withProjects' && styles.contactFilterTextActive]}>
                  With Projects
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactFilterPill, contactFilter === 'withoutProjects' && styles.contactFilterActive]}
                onPress={() => setContactFilter('withoutProjects')}
              >
                <Text style={[styles.contactFilterText, contactFilter === 'withoutProjects' && styles.contactFilterTextActive]}>
                  New Customers
                </Text>
              </TouchableOpacity>
            </ScrollView>
            
            {/* Sort dropdown */}
            <TouchableOpacity 
              style={styles.contactSortButton}
              onPress={handleToggleContactSort}
            >
              <Ionicons name="swap-vertical" size={18} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
          
          {/* Sort Options Dropdown */}
          <Animated.View style={[styles.contactSortOptions, { height: contactSortAnimHeight }]}>
            <TouchableOpacity
              style={[styles.contactSortOption, contactSort === 'name' && styles.contactSortOptionActive]}
              onPress={() => {
                setContactSort('name');
                handleToggleContactSort();
              }}
            >
              <Ionicons name="text" size={18} color={contactSort === 'name' ? COLORS.accent : COLORS.textGray} />
              <Text style={[styles.contactSortOptionText, contactSort === 'name' && styles.contactSortOptionTextActive]}>
                Name (A-Z)
              </Text>
              {contactSort === 'name' && (
                <Ionicons name="checkmark" size={18} color={COLORS.accent} style={styles.sortCheck} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.contactSortOption, contactSort === 'company' && styles.contactSortOptionActive]}
              onPress={() => {
                setContactSort('company');
                handleToggleContactSort();
              }}
            >
              <Ionicons name="briefcase" size={18} color={contactSort === 'company' ? COLORS.accent : COLORS.textGray} />
              <Text style={[styles.contactSortOptionText, contactSort === 'company' && styles.contactSortOptionTextActive]}>
                Company
              </Text>
              {contactSort === 'company' && (
                <Ionicons name="checkmark" size={18} color={COLORS.accent} style={styles.sortCheck} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.contactSortOption, contactSort === 'recent' && styles.contactSortOptionActive]}
              onPress={() => {
                setContactSort('recent');
                handleToggleContactSort();
              }}
            >
              <Ionicons name="time" size={18} color={contactSort === 'recent' ? COLORS.accent : COLORS.textGray} />
              <Text style={[styles.contactSortOptionText, contactSort === 'recent' && styles.contactSortOptionTextActive]}>
                Recently Updated
              </Text>
              {contactSort === 'recent' && (
                <Ionicons name="checkmark" size={18} color={COLORS.accent} style={styles.sortCheck} />
              )}
            </TouchableOpacity>
          </Animated.View>
          
          {/* Create Contact Button */}
          <TouchableOpacity 
            style={styles.createContactButton}
            onPress={() => {
              setShowContactPicker(false);
              setContactSearchQuery('');
              setShowAddContactModal(true);
            }}
          >
            <View style={styles.createContactIcon}>
              <Ionicons name="add" size={24} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.createContactText}>Create New Contact</Text>
              <Text style={styles.createContactSubtext}>Add a new customer to your contacts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
          </TouchableOpacity>
          
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const hasProjects = opportunities.some(o => o.contactId === item._id);
              
              // Handle name display like ContactsScreen
              const firstName = item.firstName || '';
              const lastName = item.lastName || '';
              const fullName = `${firstName} ${lastName}`.trim();
              const hasName = Boolean(firstName || lastName);
              
              // Get initials
              const initials = firstName && lastName 
                ? `${firstName[0]}${lastName[0]}`.toUpperCase()
                : (firstName || lastName || item.companyName || item.email || '?')[0].toUpperCase();
              
              // Determine display name
              const displayName = fullName || item.companyName || item.email || 'No Name';
              
              return (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleSelectContact(item)}
                >
                  <View style={[styles.contactAvatar, !hasName && styles.contactAvatarGray]}>
                    <Text style={styles.contactAvatarText}>
                      {initials}
                    </Text>
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactName}>
                      {displayName}
                    </Text>
                    {item.email && displayName !== item.email && (
                      <View style={styles.contactDetailRow}>
                        <Ionicons name="mail-outline" size={14} color={COLORS.textGray} />
                        <Text style={styles.contactDetailText} numberOfLines={1}>
                          {item.email}
                        </Text>
                      </View>
                    )}
                    {item.phone && (
                      <View style={styles.contactDetailRow}>
                        <Ionicons name="call-outline" size={14} color={COLORS.textGray} />
                        <Text style={styles.contactDetailText}>{item.phone}</Text>
                      </View>
                    )}
                  </View>
                  {hasProjects && (
                    <View style={styles.hasProjectsBadge}>
                      <Ionicons name="folder" size={14} color={COLORS.accent} />
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textGray} />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContactList}>
                <Text style={styles.emptyContactText}>
                  {contactSearchQuery ? 'No contacts found' : 'No contacts available'}
                </Text>
              </View>
            }
            contentContainerStyle={filteredContacts.length === 0 ? styles.emptyContactListContainer : undefined}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
      <Text style={styles.emptyText}>No active quotes</Text>
      <Text style={styles.emptySubtext}>
        Create quotes for your contacts to get started
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={() => handleCreateQuote()}>
        <Ionicons name="add" size={20} color={COLORS.white} />
        <Text style={styles.createButtonText}>Create Quote</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar with Add Button */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search quotes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.textGray}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => handleCreateQuote()} style={styles.addButton}>
          <Ionicons name="add" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedFilter === item.id && styles.filterPillActive
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={16} 
                color={selectedFilter === item.id ? COLORS.white : COLORS.textDark} 
              />
              <Text style={[
                styles.filterText,
                selectedFilter === item.id && styles.filterTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
        
        <TouchableOpacity style={styles.sortButton} onPress={toggleSortOptions}>
          <Ionicons name="swap-vertical" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      <Animated.View style={[styles.sortOptions, { height: sortAnimHeight }]}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.sortOption,
              selectedSort === option.id && styles.sortOptionActive
            ]}
            onPress={() => {
              setSelectedSort(option.id);
              toggleSortOptions();
            }}
          >
            <Ionicons 
              name={option.icon as any} 
              size={18} 
              color={selectedSort === option.id ? COLORS.accent : COLORS.textGray} 
            />
            <Text style={[
              styles.sortOptionText,
              selectedSort === option.id && styles.sortOptionTextActive
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.mainStatValue}>{quotes.filter(q => q.status === 'draft').length}</Text>
          <Text style={styles.mainStatLabel}>Drafts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.mainStatValue}>{quotes.filter(q => q.status === 'sent').length}</Text>
          <Text style={styles.mainStatLabel}>Sent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.mainStatValue}>{quotes.filter(q => q.status === 'viewed').length}</Text>
          <Text style={styles.mainStatLabel}>Viewed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.mainStatValue}>
            ${quotes.reduce((sum, q) => sum + (q.totalAmount || 0), 0).toLocaleString()}
          </Text>
          <Text style={styles.mainStatLabel}>Total Value</Text>
        </View>
      </View>

      {/* Content */}
      {filteredGroups.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderOpportunityCard}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadData} />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Contact Picker Modal */}
      {renderContactPicker()}
      
      {/* Add Contact Modal */}
      <AddContactForm
        visible={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onSubmit={handleCreateContact}
        isModal={true}
      />
    </SafeAreaView>
  );
}

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 8,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Filters
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: COLORS.accent,
  },
  filterText: {
    fontSize: 13,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginLeft: 6,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortOptions: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sortOptionActive: {
    backgroundColor: COLORS.lightAccent,
  },
  sortOptionText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 12,
  },
  sortOptionTextActive: {
    color: COLORS.accent,
    fontFamily: FONT.medium,
  },
  
  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 20,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  mainStatLabel: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  
  // List
  listContainer: {
    paddingVertical: 16,
  },
  
  // Opportunity card
  cardContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: RADIUS.medium,
    ...SHADOW.small,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
  },
  cardInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  opportunityTitle: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  statusIndicators: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 4,
  },
  statusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  
  // Card stats
  cardStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  
  // Expanded content
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  quoteItem: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  firstQuoteItem: {
    borderTopWidth: 0,
  },
  quoteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quoteNumber: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  quoteTitle: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
    marginTop: 2,
  },
  quoteItemRight: {
    alignItems: 'flex-end',
  },
  quoteAmount: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: FONT.medium,
    textTransform: 'capitalize',
  },
  quoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    fontFamily: FONT.medium,
    color: COLORS.accent,
    marginLeft: 4,
  },
  addQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addQuoteText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.accent,
    marginLeft: 8,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 8,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    ...SHADOW.medium,
  },
  createButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.white,
    marginLeft: 8,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    marginLeft: 8,
  },
  contactFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    marginRight: 8,
  },
  contactFilterActive: {
    backgroundColor: COLORS.accent,
  },
  contactFilterText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  contactFilterTextActive: {
    color: COLORS.white,
  },
  contactSortButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  contactSortOptions: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    overflow: 'hidden',
  },
  contactSortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactSortOptionActive: {
    backgroundColor: COLORS.lightAccent,
  },
  contactSortOptionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 12,
  },
  contactSortOptionTextActive: {
    color: COLORS.accent,
    fontFamily: FONT.medium,
  },
  sortCheck: {
    marginLeft: 'auto',
  },
  
  // Create contact button styles
  createContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.lightAccent,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  createContactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createContactText: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  createContactSubtext: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 2,
  },
  
  // Contact list styles
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarGray: {
    backgroundColor: COLORS.textLight,
  },
  contactAvatarText: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.accent,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  contactDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  contactDetailText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 4,
    flex: 1,
  },
  hasProjectsBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lightAccent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emptyContactList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContactListContainer: {
    flexGrow: 1,
  },
  emptyContactText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  }
});