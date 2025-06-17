// src/screens/QuoteBuilderScreen.tsx
// Updated: 2025-06-16
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
import { projectService } from '../services/projectService';
import { quoteService } from '../services/quoteService';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Project, Quote } from '../../packages/types/dist';

type QuoteBuilderScreenProps = {
  navigation: any;
};

export default function QuoteBuilderScreen({ navigation }: QuoteBuilderScreenProps) {
  const { user } = useAuth();
  
  // State - Initialize as empty arrays
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'projects' | 'quotes'>('projects');

  // Load data using services
  const loadData = useCallback(async () => {
    if (!user?.locationId) {
      console.warn('[QuoteBuilder] No locationId available');
      return;
    }
    
    try {
      setLoading(true);
      
      if (__DEV__) {
        console.log('[QuoteBuilder] Loading data for location:', user.locationId);
      }
      
      // Load projects using the correct service method
      const projectsData = await projectService.list(user.locationId);
      
      // Load quotes - the service expects locationId as first parameter
      const quotesResponse = await quoteService.list(user.locationId);
      
      if (__DEV__) {
        console.log('[QuoteBuilder] Projects response:', projectsData);
        console.log('[QuoteBuilder] Quotes response:', quotesResponse);
        console.log('[QuoteBuilder] Quotes full data:', JSON.stringify(quotesResponse, null, 2));
      }
      
      // Handle the response - it might be the array directly or wrapped in data
      const projectsArray = Array.isArray(projectsData) ? projectsData : projectsData?.data || [];
      const quotesArray = Array.isArray(quotesResponse) ? quotesResponse : quotesResponse?.data || [];
      
      if (__DEV__) {
        console.log('[QuoteBuilder] Setting projects:', projectsArray.length);
        console.log('[QuoteBuilder] Setting quotes:', quotesArray.length);
      }
      
      setProjects(projectsArray);
      setQuotes(quotesArray);
      
    } catch (error) {
      console.error('[QuoteBuilder] Failed to load data:', error);
      if (__DEV__) {
        console.error('[QuoteBuilder] Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
      }
      Alert.alert('Error', 'Failed to load projects and quotes');
      setProjects([]);
      setQuotes([]);
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

  // Filter data based on search - with proper array checks
  const filteredProjects = React.useMemo(() => {
    if (!Array.isArray(projects)) return [];
    if (!searchQuery.trim()) return projects;
    
    const query = searchQuery.toLowerCase();
    return projects.filter(project => 
      project.title?.toLowerCase().includes(query) ||
      project.contactName?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const filteredQuotes = React.useMemo(() => {
    if (!Array.isArray(quotes)) return [];
    if (!searchQuery.trim()) return quotes;
    
    const query = searchQuery.toLowerCase();
    return quotes.filter(quote => 
      quote.title?.toLowerCase().includes(query) ||
      quote.contactName?.toLowerCase().includes(query) ||
      quote.quoteNumber?.toLowerCase().includes(query)
    );
  }, [quotes, searchQuery]);

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
            { backgroundColor: getProjectStatusColor(item.status) + '20', color: getProjectStatusColor(item.status) }
          ]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <View style={styles.projectFooter}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleCreateQuote(item)}
        >
          <Ionicons name="add-circle" size={16} color={COLORS.accent} />
          <Text style={styles.actionText}>Create Quote</Text>
        </TouchableOpacity>
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
          <Text style={styles.amountLabel}>Total</Text>
          <Text style={styles.amountValue}>${item.total?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>
      
      <View style={styles.quoteStatus}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {item.status}
        </Text>
        {item.viewedAt && (
          <Text style={styles.viewedText}>
            Viewed {new Date(item.viewedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
      
      <View style={styles.quoteFooter}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleEditQuote(item)}
        >
          <Ionicons name="pencil" size={16} color={COLORS.textGray} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        
        {(item.status !== 'declined' && item.status !== 'accepted') && (
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
    </TouchableOpacity>
  );

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
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: FONT.body,
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
    padding: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FONT.body,
    color: COLORS.textGray,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: FONT.body,
    fontWeight: '600',
  },
  projectCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.small,
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
    fontSize: FONT.body,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  projectContact: {
    fontSize: FONT.small,
    color: COLORS.textGray,
  },
  projectStatus: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    fontSize: FONT.small,
    fontWeight: '500',
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  quoteCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.small,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quoteInfo: {
    flex: 1,
  },
  quoteNumber: {
    fontSize: FONT.small,
    color: COLORS.textGray,
    marginBottom: 2,
  },
  quoteTitle: {
    fontSize: FONT.body,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  quoteContact: {
    fontSize: FONT.small,
    color: COLORS.textGray,
  },
  quoteAmount: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: FONT.small,
    color: COLORS.textGray,
  },
  amountValue: {
    fontSize: FONT.sectionTitle,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  quoteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: FONT.small,
    fontWeight: '500',
    marginRight: 12,
  },
  viewedText: {
    fontSize: FONT.small,
    color: COLORS.textGray,
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  actionText: {
    fontSize: FONT.small,
    marginLeft: 4,
    color: COLORS.textGray,
  },
});