// src/screens/ContactsScreen.tsx
// Updated: 2025-06-18
// Enhanced with React Query, modern UI, and sorting options

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
  Animated,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useContacts, useCreateContact } from '../hooks/useContacts';
import ContactCard from '../components/ContactCard';
import FilterModal from '../components/FilterModal';
import AddContactForm from '../components/AddContactForm';
import { Contact } from '../../packages/types/dist';
import { COLORS, FONT, SHADOW } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const topFilters = [
  { id: 'All', label: 'All', icon: 'grid' },
  { id: 'Open', label: 'Open', icon: 'folder-open' },
  { id: 'Quoted', label: 'Quoted', icon: 'document-text' },
  { id: 'Scheduled', label: 'Scheduled', icon: 'calendar' },
];

const sortOptions = [
  { id: 'name', label: 'Name (A-Z)', icon: 'text' },
  { id: 'nameDesc', label: 'Name (Z-A)', icon: 'text' },
  { id: 'recentlyAdded', label: 'Recently Added', icon: 'time' },
  { id: 'recentlyUpdated', label: 'Recently Updated', icon: 'refresh' },
  { id: 'mostProjects', label: 'Most Projects', icon: 'briefcase' },
];

export default function ContactsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  
  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [topFilter, setTopFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchBarOpacity = useRef(new Animated.Value(1)).current;
  const sortOptionsHeight = useRef(new Animated.Value(0)).current;
  
  // React Query
  const { data: contacts = [], isLoading, refetch, isRefetching } = useContacts();
  const createContactMutation = useCreateContact();
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);
  
  // Toggle sort options
  const toggleSortOptions = () => {
    const toValue = showSortOptions ? 0 : sortOptions.length * 48;
    
    Animated.timing(sortOptionsHeight, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    setShowSortOptions(!showSortOptions);
  };
  
  // Sort contacts
  const sortContacts = (contactsToSort: Contact[]) => {
    const sorted = [...contactsToSort];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => {
          const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'zzz';
          const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'zzz';
          return aName.localeCompare(bName);
        });
        break;
        
      case 'nameDesc':
        sorted.sort((a, b) => {
          const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || '';
          const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim() || '';
          return bName.localeCompare(aName);
        });
        break;
        
      case 'recentlyAdded':
        sorted.sort((a, b) => {
          const aDate = new Date(a.createdAt || 0).getTime();
          const bDate = new Date(b.createdAt || 0).getTime();
          return bDate - aDate;
        });
        break;
        
      case 'recentlyUpdated':
        sorted.sort((a, b) => {
          const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bDate - aDate;
        });
        break;
        
      case 'mostProjects':
        sorted.sort((a, b) => {
          const aProjects = a.projects?.length || 0;
          const bProjects = b.projects?.length || 0;
          return bProjects - aProjects;
        });
        break;
    }
    
    // Move contacts without names to the end
    const withNames = sorted.filter(c => c.firstName || c.lastName);
    const withoutNames = sorted.filter(c => !c.firstName && !c.lastName);
    
    return [...withNames, ...withoutNames];
  };
  
  // Filter contacts
  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    
    // Top filter
    if (topFilter !== 'All') {
      result = result.filter((c) => {
        const sorted = [...(c.projects || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const latest = sorted[0];
        return latest?.status === topFilter.toLowerCase();
      });
    }
    
    // Status filter
    if (statusFilter) {
      result = result.filter((c) => {
        const sorted = [...(c.projects || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const latest = sorted[0];
        return latest?.status === statusFilter;
      });
    }
    
    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
      );
    }
    
    // Project filter
    if (projectFilter.trim()) {
      result = result.filter((c) =>
        c.projects?.some((p) =>
          p.title.toLowerCase().includes(projectFilter.toLowerCase())
        )
      );
    }
    
    // Phone filter
    if (phoneFilter.trim()) {
      result = result.filter((c) =>
        c.phone?.toLowerCase().includes(phoneFilter.toLowerCase())
      );
    }
    
    // Apply sorting
    return sortContacts(result);
  }, [contacts, topFilter, statusFilter, debouncedSearch, projectFilter, phoneFilter, sortBy]);
  
  // Handle create contact
  const handleCreateContact = async (contactData: any) => {
    try {
      const newContact = await createContactMutation.mutateAsync(contactData);
      setIsAddModalVisible(false);
      navigation.navigate('ContactDetailScreen', { contact: newContact });
    } catch (error) {
      Alert.alert('Error', 'Failed to create contact. Please try again.');
    }
  };
  
  // Handle scroll animations
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        // Hide search bar when scrolling down
        Animated.timing(searchBarOpacity, {
          toValue: offsetY > 50 ? 0.3 : 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      },
    }
  );
  
  // Get formatted date
  const getFormattedDate = (date: string | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };
  
  // Render contact item
  const renderContact = ({ item }: { item: Contact }) => {
    const initials = `${item.firstName?.[0] || ''}${item.lastName?.[0] || ''}`.toUpperCase() || '?';
    const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'No Name';
    const latestProject = item.projects?.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    
    // Show relevant date based on sort
    let dateText = '';
    if (sortBy === 'recentlyAdded') {
      dateText = getFormattedDate(item.createdAt);
    } else if (sortBy === 'recentlyUpdated') {
      dateText = getFormattedDate(item.updatedAt || item.createdAt);
    }
    
    return (
      <TouchableOpacity
        style={styles.contactCard}
        onPress={() => navigation.navigate('ContactDetailScreen', { contact: item })}
        activeOpacity={0.7}
      >
        <View style={[styles.contactAvatar, !item.firstName && !item.lastName && styles.contactAvatarGray]}>
          <Text style={styles.contactInitials}>{initials}</Text>
        </View>
        
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{fullName}</Text>
          
          {item.email && (
            <View style={styles.contactDetail}>
              <Ionicons name="mail-outline" size={14} color={COLORS.textGray} />
              <Text style={styles.contactDetailText} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
          )}
          
          {item.phone && (
            <View style={styles.contactDetail}>
              <Ionicons name="call-outline" size={14} color={COLORS.textGray} />
              <Text style={styles.contactDetailText}>{item.phone}</Text>
            </View>
          )}
          
          {latestProject && (
            <View style={styles.projectBadge}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(latestProject.status) }]} />
              <Text style={styles.projectText}>
                {latestProject.title}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.contactActions}>
          {dateText && (
            <Text style={styles.dateText}>{dateText}</Text>
          )}
          <Text style={styles.projectCount}>
            {item.projects?.length || 0} {item.projects?.length === 1 ? 'project' : 'projects'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>
    );
  };
  
  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return COLORS.info;
      case 'quoted': return COLORS.warning;
      case 'scheduled': return COLORS.success;
      case 'won': return COLORS.success;
      case 'lost': return COLORS.error;
      default: return COLORS.textLight;
    }
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setTopFilter('All');
    setStatusFilter(null);
    setProjectFilter('');
    setPhoneFilter('');
    setSearch('');
  };
  
  const hasActiveFilters = topFilter !== 'All' || statusFilter || projectFilter || phoneFilter || search;
  const currentSort = sortOptions.find(s => s.id === sortBy);
  
  if (isLoading && contacts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={toggleSortOptions}>
            <Ionicons name="swap-vertical" size={24} color={COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setIsFilterVisible(true)}>
            <Ionicons name="filter" size={24} color={COLORS.accent} />
            {hasActiveFilters && <View style={styles.filterIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setIsAddModalVisible(true)}>
            <Ionicons name="add" size={28} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Sort Options Dropdown */}
      <Animated.View style={[styles.sortOptionsContainer, { height: sortOptionsHeight }]}>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.sortOption, sortBy === option.id && styles.sortOptionActive]}
            onPress={() => {
              setSortBy(option.id);
              toggleSortOptions();
            }}
          >
            <Ionicons 
              name={option.icon as any} 
              size={20} 
              color={sortBy === option.id ? COLORS.accent : COLORS.textGray} 
            />
            <Text style={[styles.sortOptionText, sortBy === option.id && styles.sortOptionTextActive]}>
              {option.label}
            </Text>
            {sortBy === option.id && (
              <Ionicons name="checkmark" size={20} color={COLORS.accent} />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
      
      {/* Search Bar */}
      <Animated.View style={[styles.searchContainer, { opacity: searchBarOpacity }]}>
        <Ionicons name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
        <TextInput
          placeholder="Search contacts..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor={COLORS.textLight}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </Animated.View>
      
      {/* Top Filters */}
      <View style={styles.filterRow}>
        {topFilters.map((filter) => {
          const isActive = topFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              onPress={() => setTopFilter(filter.id)}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
            >
              <Ionicons 
                name={filter.icon as any} 
                size={16} 
                color={isActive ? COLORS.white : COLORS.textDark} 
                style={styles.filterIcon}
              />
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Active Filters Bar */}
      {(hasActiveFilters || sortBy !== 'name') && (
        <View style={styles.activeFiltersBar}>
          <View style={styles.activeFiltersLeft}>
            <Text style={styles.activeFiltersText}>
              {filteredContacts.length} of {contacts.length}
            </Text>
            {sortBy !== 'name' && (
              <View style={styles.sortIndicator}>
                <Ionicons name={currentSort?.icon as any} size={14} color={COLORS.accent} />
                <Text style={styles.sortIndicatorText}>{currentSort?.label}</Text>
              </View>
            )}
          </View>
          {hasActiveFilters && (
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Contacts List */}
      <FlatList
        data={filteredContacts}
        renderItem={renderContact}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={refetch}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>
              {hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearAllFilters} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      
      {/* Filter Modal */}
      <FilterModal
        isVisible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        phoneFilter={phoneFilter}
        setPhoneFilter={setPhoneFilter}
        onClear={() => {
          setStatusFilter(null);
          setProjectFilter('');
          setPhoneFilter('');
        }}
      />
      
      {/* Add Contact Modal */}
      <AddContactForm
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontFamily: FONT.bold,
    color: COLORS.textDark,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    position: 'relative',
  },
  filterIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  sortOptionsContainer: {
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
    height: 48,
  },
  sortOptionActive: {
    backgroundColor: COLORS.lightAccent,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 12,
  },
  sortOptionTextActive: {
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    paddingLeft: 20,
    paddingRight: 12, // Less padding on right since pills have marginRight
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 6, // Reduced from 8
    borderRadius: 18, // Slightly smaller
    backgroundColor: COLORS.background,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: COLORS.accent,
  },
  filterIcon: {
    marginRight: 4, // Reduced from 6
  },
  filterPillText: {
    fontSize: 13, // Reduced from 14
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  activeFiltersBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: COLORS.lightAccent,
  },
  activeFiltersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeFiltersText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  sortIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  sortIndicatorText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.accent,
    marginLeft: 4,
  },
  clearFiltersText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.accent,
  },
  listContainer: {
    paddingBottom: 100,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactAvatarGray: {
    backgroundColor: COLORS.textLight,
  },
  contactInitials: {
    fontSize: 18,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  contactDetailText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 6,
    flex: 1,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  projectText: {
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.textDark,
  },
  contactActions: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.accent,
    marginBottom: 2,
  },
  projectCount: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginTop: 16,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
  },
  emptyButtonText: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: COLORS.white,
  },
});