// src/screens/DashboardScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
  Animated,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DragList from 'react-native-drag-sort';

// Import ALL dashboard widgets
import DepartureWidget from '../components/dashboard/DepartureWidget';
import QuickActionsWidget from '../components/dashboard/QuickActionsWidget';
import ActiveJobsWidget from '../components/dashboard/ActiveJobsWidget';
import TodayScheduleWidget from '../components/dashboard/TodayScheduleWidget';
import TodayStatsWidget from '../components/dashboard/TodayStatsWidget';
import RecentActivityWidget from '../components/dashboard/RecentActivityWidget';

// Import responsive utilities
import { isTablet, getColumns, responsive } from '../utils/responsive';

const { width: screenWidth } = Dimensions.get('window');

// Widget Registry with metadata
const WIDGET_REGISTRY = {
  departure: {
    component: DepartureWidget,
    name: 'Departure Timer',
    description: 'Shows when to leave for next appointment',
    icon: 'car',
    fullWidth: false, // Changed from true to false
    defaultEnabled: true,
    categories: ['service', 'fieldTechPro'],
  },
  quickActions: {
    component: QuickActionsWidget,
    name: 'Quick Actions',
    description: 'Fast access to common tasks',
    icon: 'flash',
    fullWidth: false,
    defaultEnabled: true,
    categories: ['all'],
  },
  stats: {
    component: TodayStatsWidget,
    name: "Today's Stats",
    description: 'Overview of daily progress',
    icon: 'stats-chart',
    fullWidth: false,
    defaultEnabled: true,
    categories: ['sales', 'operations', 'fieldTechPro'],
  },
  activeJobs: {
    component: ActiveJobsWidget,
    name: 'Active Jobs',
    description: 'Current projects in progress',
    icon: 'briefcase',
    fullWidth: false,
    defaultEnabled: true,
    categories: ['all'],
  },
  todaySchedule: {
    component: TodayScheduleWidget,
    name: "Today's Schedule",
    description: 'Timeline view of appointments',
    icon: 'time',
    fullWidth: false,
    defaultEnabled: true,
    categories: ['service', 'operations', 'fieldTechPro'],
  },
  recentActivity: {
    component: RecentActivityWidget,
    name: 'Recent Activity',
    description: 'Latest updates and changes',
    icon: 'pulse',
    fullWidth: false,
    defaultEnabled: false,
    categories: ['sales', 'operations', 'fieldTechPro'],
  },
};

// Default layouts for different dashboard types
const DEFAULT_LAYOUTS = {
  service: [
    { id: 'departure', type: 'departure', enabled: true, order: 1 },
    { id: 'quickActions', type: 'quickActions', enabled: true, order: 2 },
    { id: 'todaySchedule', type: 'todaySchedule', enabled: true, order: 3 },
    { id: 'activeJobs', type: 'activeJobs', enabled: true, order: 4 },
  ],
  sales: [
    { id: 'stats', type: 'stats', enabled: true, order: 1 },
    { id: 'quickActions', type: 'quickActions', enabled: true, order: 2 },
    { id: 'activeJobs', type: 'activeJobs', enabled: true, order: 3 },
    { id: 'recentActivity', type: 'recentActivity', enabled: true, order: 4 },
  ],
  operations: [
    { id: 'stats', type: 'stats', enabled: true, order: 1 },
    { id: 'activeJobs', type: 'activeJobs', enabled: true, order: 2 },
    { id: 'todaySchedule', type: 'todaySchedule', enabled: true, order: 3 },
    { id: 'recentActivity', type: 'recentActivity', enabled: true, order: 4 },
  ],
  fieldTechPro: [
    { id: 'departure', type: 'departure', enabled: true, order: 1 },
    { id: 'stats', type: 'stats', enabled: true, order: 2 },
    { id: 'quickActions', type: 'quickActions', enabled: true, order: 3 },
    { id: 'todaySchedule', type: 'todaySchedule', enabled: true, order: 4 },
    { id: 'activeJobs', type: 'activeJobs', enabled: true, order: 5 },
    { id: 'recentActivity', type: 'recentActivity', enabled: true, order: 6 },
  ],
  custom: [], // User will configure their own
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [widgetData, setWidgetData] = useState({});
  const [widgetLayout, setWidgetLayout] = useState([]);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Get dashboard type from user preferences
  const dashboardType = user?.preferences?.dashboardType || 'service';

  // Load widget layout from storage or defaults
  useEffect(() => {
    loadWidgetLayout();
  }, [dashboardType]);

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadWidgetLayout = async () => {
    try {
      const savedLayout = await AsyncStorage.getItem(`dashboard_layout_${user?._id}`);
      if (savedLayout) {
        setWidgetLayout(JSON.parse(savedLayout));
      } else {
        // Use default layout for dashboard type
        setWidgetLayout(DEFAULT_LAYOUTS[dashboardType] || DEFAULT_LAYOUTS.service);
      }
    } catch (error) {
      console.error('Failed to load widget layout:', error);
      setWidgetLayout(DEFAULT_LAYOUTS[dashboardType] || DEFAULT_LAYOUTS.service);
    }
  };

  const saveWidgetLayout = async (newLayout) => {
    try {
      await AsyncStorage.setItem(`dashboard_layout_${user?._id}`, JSON.stringify(newLayout));
      setWidgetLayout(newLayout);
    } catch (error) {
      console.error('Failed to save widget layout:', error);
    }
  };

  // Load all widget data
  const loadDashboardData = useCallback(async () => {
    try {
      if (__DEV__) {
        console.log('🔄 [Dashboard] Loading dashboard data...');
      }
      // Each widget loads its own data
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [Dashboard] Error loading data:', error);
      }
    }
  }, [user?.locationId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const toggleWidget = (widgetId) => {
    const newLayout = widgetLayout.map(widget => 
      widget.id === widgetId 
        ? { ...widget, enabled: !widget.enabled }
        : widget
    );
    saveWidgetLayout(newLayout);
  };

  const reorderWidgets = (newOrder) => {
    const newLayout = newOrder.map((widget, index) => ({
      ...widget,
      order: index + 1,
    }));
    saveWidgetLayout(newLayout);
  };

  const resetToDefault = () => {
    Alert.alert(
      'Reset Dashboard',
      'This will reset your dashboard to the default layout. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            setWidgetLayout(DEFAULT_LAYOUTS[dashboardType] || DEFAULT_LAYOUTS.service);
            AsyncStorage.removeItem(`dashboard_layout_${user?._id}`);
          }
        },
      ]
    );
  };

  const renderWidget = (widget) => {
    if (!widget.enabled) return null;

    const widgetConfig = WIDGET_REGISTRY[widget.type];
    if (!widgetConfig) {
      if (__DEV__) {
        console.warn(`⚠️ [Dashboard] Unknown widget type: ${widget.type}`);
      }
      return null;
    }

    const WidgetComponent = widgetConfig.component;
    const isFullWidth = widgetConfig.fullWidth;

    // Widget wrapper style
    let widgetStyle = isFullWidth ? styles.fullWidthWidget : styles.widgetContainer;
    
    if (!isFullWidth && isTablet() && widget.size === 'half') {
      widgetStyle = [styles.widgetContainer, { width: (screenWidth - (responsive.padding * 2) - 16) / 2 }];
    }

    return (
      <Animated.View 
        key={widget.id} 
        style={[
          widgetStyle,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
          isEditMode && styles.editModeWidget,
        ]}
      >
        {isEditMode && (
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => toggleWidget(widget.id)}
          >
            <Ionicons name="close-circle" size={24} color="#FF4444" />
          </TouchableOpacity>
        )}
        <WidgetComponent
          {...widget.config}
          navigation={navigation}
          userData={user}
          widgetData={widgetData[widget.type]}
        />
      </Animated.View>
    );
  };

  // Get enabled widgets sorted by order
  const enabledWidgets = widgetLayout
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  const CustomizeModal = () => (
    <Modal
      visible={showCustomizeModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCustomizeModal(false)}>
            <Text style={styles.modalCancel}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Customize Dashboard</Text>
          <TouchableOpacity onPress={resetToDefault}>
            <Text style={styles.modalReset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.sectionTitle}>Available Widgets</Text>
          {Object.entries(WIDGET_REGISTRY).map(([key, config]) => {
            const widget = widgetLayout.find(w => w.type === key);
            const isEnabled = widget?.enabled || false;

            return (
              <TouchableOpacity
                key={key}
                style={styles.widgetOption}
                onPress={() => toggleWidget(widget?.id || key)}
              >
                <View style={styles.widgetOptionLeft}>
                  <View style={[styles.widgetIcon, { backgroundColor: COLORS.accent + '20' }]}>
                    <Ionicons name={config.icon as any} size={24} color={COLORS.accent} />
                  </View>
                  <View style={styles.widgetInfo}>
                    <Text style={styles.widgetName}>{config.name}</Text>
                    <Text style={styles.widgetDescription}>{config.description}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => toggleWidget(widget?.id || key)}
                  style={styles.toggleButton}
                >
                  <Ionicons 
                    name={isEnabled ? "checkmark-circle" : "ellipse-outline"} 
                    size={28} 
                    color={isEnabled ? COLORS.accent : COLORS.textGray} 
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              Good {getTimeOfDay()}, {user?.name?.split(' ')[0] || 'there'}! 👋
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.customizeButton}
              onPress={() => setShowCustomizeModal(true)}
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.accent} />
            </TouchableOpacity>
            {user?.role === 'admin' && (
              <Text style={styles.roleIndicator}>Admin</Text>
            )}
          </View>
        </View>

        {/* Dashboard Type Indicator (for testing) */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>Dashboard: {dashboardType}</Text>
            <TouchableOpacity onPress={() => setIsEditMode(!isEditMode)}>
              <Text style={styles.debugText}>Edit: {isEditMode ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Widgets */}
        <View style={styles.widgetsWrapper}>
          {enabledWidgets.length > 0 ? (
            enabledWidgets.map((widget) => renderWidget(widget))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="apps-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyStateTitle}>No widgets enabled</Text>
              <Text style={styles.emptyStateText}>
                Tap the settings icon to customize your dashboard
              </Text>
            </View>
          )}
        </View>

        {/* Add some bottom padding */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Customize Modal */}
      <CustomizeModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsive.padding,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    fontSize: responsive.fontSize.large,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  date: {
    fontSize: responsive.fontSize.small,
    color: COLORS.textGray,
    marginTop: 4,
  },
  customizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIndicator: {
    fontSize: responsive.fontSize.small,
    color: COLORS.accent,
    fontWeight: '600',
    backgroundColor: COLORS.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  debugInfo: {
    backgroundColor: COLORS.accentMuted,
    paddingHorizontal: responsive.padding,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debugText: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
  },
  widgetsWrapper: {
    flex: 1,
  },
  widgetContainer: {
    marginBottom: 16,
    paddingHorizontal: responsive.padding,
  },
  fullWidthWidget: {
    marginBottom: 16,
    // No horizontal padding for full-width widgets
  },
  editModeWidget: {
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: responsive.padding,
  },
  emptyStateTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  modalCancel: {
    fontSize: FONT.input,
    color: COLORS.accent,
    fontWeight: '500',
  },
  modalReset: {
    fontSize: FONT.input,
    color: '#FF4444',
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: FONT.label,
    fontWeight: '600',
    color: COLORS.textGray,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  widgetOption: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.card,
  },
  widgetOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  widgetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  widgetInfo: {
    flex: 1,
  },
  widgetName: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  widgetDescription: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  toggleButton: {
    padding: 8,
  },
});