// src/screens/QuoteBuilderScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Project, Quote, Contact } from '@lp-ai/types';

type QuoteBuilderScreenProps = {
  navigation: any;
};

export default function QuoteBuilderScreen({ navigation }: QuoteBuilderScreenProps) {
  const { user } = useAuth();
  
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'projects' | 'quotes'>('projects');

  // Load data
  const loadData = useCallback(async () => {
    if (!user?.locationId) return;
    
    try {
      setLoading(true);
      
      // Load projects and quotes in parallel
      const [projectsRes, quotesRes] = await Promise.all([
        api.get('/api/projects', {
          params: { locationId: user.locationId },
        }),
        api.get('/api/quotes', {
          params: { locationId: user.locationId },
        }),
      ]);
      
      setProjects(projectsRes.data || []);
      setQuotes(quotesRes.data || []);
      
    } catch (error) {
      console.error('[QuoteBuilder] Failed to load data:', error);
      Alert.alert('Error', 'Failed to load projects and quotes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.locationId]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Filter data based on search
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.contactName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuotes = quotes.filter(quote => 
    quote.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quote.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quote.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Navigate to create quote for project
  const handleCreateQuote = (project: Project) => {
    navigation.navigate('QuoteEditor', { 
      mode: 'create',
      project,
    });
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
    navigation.navigate('QuotePresentation', { quote });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return COLORS.textGray;
      case 'sent': return '#3498db';
      case 'viewed': return '#9b59b6';
      case 'accepted': return '#27ae60';
      case 'declined': return '#e74c3c';
      case 'expired': return '#f39c12';
      default: return COLORS.textGray;
    }
  };

  // Render project item
  const renderProjectItem = ({ item }: { item: Project }) => (
    <TouchableOpacity 
      style={styles.projectCard}
      onPress={() => handleCreateQuote(item)}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectInfo}>
          <Text style={styles.projectTitle}>{item.title}</Text>
          <Text style={styles.projectContact}>{item.contactName}</Text>
        </View>
        <View style={styles.projectStatus}>
          <Text style={[
            styles.statusBadge, 
            { backgroundColor: getProjectStatusColor(item.status) }
          ]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <View style={styles.projectFooter}>
        <Text style={styles.projectDate}>
          Created: {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <View style={styles.projectActions}>
          <Text style={styles.createQuoteText}>Tap to Create Quote</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render quote item
  const renderQuoteItem = ({ item }: { item: Quote }) => (
    <TouchableOpacity 
      style={styles.quoteCard}
      onPress={() => handleEditQuote(item)}
    >
      <View style={styles.quoteHeader}>
        <View style={styles.quoteInfo}>
          <Text style={styles.quoteNumber}>{item.quoteNumber}</Text>
          <Text style={styles.quoteTitle}>{item.title}</Text>
          <Text style={styles.quoteContact}>{item.contactName}</Text>
        </View>
        <View style={styles.quoteAmount}>
          <Text style={styles.totalAmount}>${item.total.toLocaleString()}</Text>
          <Text style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) }
          ]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.quoteFooter}>
        <Text style={styles.quoteDate}>
          Created: {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <View style={styles.quoteActions}>
          {item.status === 'draft' && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                handleEditQuote(item);
              }}
            >
              <Ionicons name="pencil" size={16} color={COLORS.accent} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}
          
          {(item.status === 'sent' || item.status === 'accepted') && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                handlePresentQuote(item);
              }}
            >
              <Ionicons name="eye" size={16} color={COLORS.accent} />
              <Text style={styles.actionText}>Present</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Get project status color
  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return '#3498db';
      case 'Quoted': return '#f1c40f';
      case 'Scheduled': return '#9b59b6';
      case 'In Progress': return '#e67e22';
      case 'Job Complete': return '#27ae60';
      default: return COLORS.textGray;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading projects and quotes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quote Builder</Text>
        <TouchableOpacity onPress={() => {
          // Navigate to library management or settings
          navigation.navigate('LibraryManager');
        }}>
          <Ionicons name="library-outline" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder={selectedTab === 'projects' ? "Search projects..." : "Search quotes..."}
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
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'projects' && styles.activeTab]}
          onPress={() => setSelectedTab('projects')}
        >
          <Text style={[
            styles.tabText, 
            selectedTab === 'projects' && styles.activeTabText
          ]}>
            Projects ({filteredProjects.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'quotes' && styles.activeTab]}
          onPress={() => setSelectedTab('quotes')}
        >
          <Text style={[
            styles.tabText,
            selectedTab === 'quotes' && styles.activeTabText
          ]}>
            Quotes ({filteredQuotes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {selectedTab === 'projects' ? (
          filteredProjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-outline" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Create a project first to build quotes'
                }
              </Text>
              {!searchQuery && (
                <TouchableOpacity 
                  style={styles.createButton}
                  onPress={() => navigation.navigate('Projects')}
                >
                  <Text style={styles.createButtonText}>View Projects</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredProjects}
              renderItem={renderProjectItem}
              keyExtractor={(item) => item._id}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : (
          filteredQuotes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No quotes found' : 'No quotes yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Select a project to create your first quote'
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredQuotes}
              renderItem={renderQuoteItem}
              keyExtractor={(item) => item._id}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )
        )}
      </View>
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: FONT.input,
    color: COLORS.textDark,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: FONT.input,
    fontWeight: '500',
    color: COLORS.textGray,
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  
  // Project Card Styles
  projectCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.card,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  projectContact: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  projectStatus: {
    marginLeft: 12,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectDate: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  projectActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createQuoteText: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
    marginRight: 4,
  },
  
  // Quote Card Styles
  quoteCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.card,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  quoteInfo: {
    flex: 1,
  },
  quoteNumber: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '600',
    marginBottom: 2,
  },
  quoteTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  quoteContact: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  quoteAmount: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: FONT.input,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteDate: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  quoteActions: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  actionText: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
    marginLeft: 4,
  },
  
  // Status Badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
    lineHeight: 22,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
  },
  createButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
});