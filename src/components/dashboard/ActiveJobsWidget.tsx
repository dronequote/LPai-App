// src/components/dashboard/ActiveJobsWidget.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { projectService } from '../../services/projectService';
import { Project } from '../../../packages/types';

interface Job {
  _id: string;
  title: string;
  contactName: string;
  status: string;
  progress: number;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export default function ActiveJobsWidget() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchActiveJobs();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [loading]);

  const fetchActiveJobs = async () => {
    if (!user?.locationId) {
      setError('No location ID found');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Use projectService instead of direct API call
      const projects = await projectService.list(user.locationId, {
        status: 'active', // This might need adjustment based on your backend
        limit: 10
      }, {
        locationId: user.locationId // Pass locationId in service options
      });
      
      // Filter for active statuses and map to Job format
      const activeJobs = projects
        .filter((p: Project) => ['in_progress', 'scheduled'].includes(p.status))
        .slice(0, 4)
        .map((p: Project) => ({
          _id: p._id,
          title: p.title,
          contactName: p.contactName || p.contact?.name || 'Unknown',
          status: p.status,
          progress: calculateProgress(p),
          priority: p.customFields?.priority || 'medium',
          dueDate: p.customFields?.dueDate
        }));
      
      setJobs(activeJobs);
    } catch (error) {
      console.error('Failed to fetch active jobs:', error);
      setError('Failed to load active jobs');
      setJobs([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (project: Project): number => {
    // If project has milestones, calculate based on completed milestones
    if (project.milestones && project.milestones.length > 0) {
      const completed = project.milestones.filter(m => m.completed).length;
      return Math.round((completed / project.milestones.length) * 100);
    }
    
    // Otherwise use status-based defaults
    switch (project.status) {
      case 'open': return 10;
      case 'scheduled': return 30;
      case 'in_progress': return 60;
      default: return 0;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#00B3E6';
      case 'scheduled': return '#FFA500';
      case 'in_progress': return '#27AE60';
      default: return COLORS.textGray;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'scheduled': return 'Scheduled';
      case 'in_progress': return 'In Progress';
      default: return status;
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'high': return 'alert-circle';
      case 'low': return 'arrow-down-circle';
      default: return 'remove-circle';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return '#FF4757';
      case 'low': return '#5F9EA0';
      default: return COLORS.textGray;
    }
  };

  const handleJobPress = (job: Job) => {
    navigation.navigate('ProjectDetail', { projectId: job._id });
  };

  const handleViewAll = () => {
    navigation.navigate('Projects');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle" size={32} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchActiveJobs} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="briefcase" size={20} color={COLORS.primary} />
          <Text style={styles.title}>Active Jobs</Text>
        </View>
        <TouchableOpacity onPress={handleViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          <Text style={styles.emptyTitle}>No active jobs</Text>
          <Text style={styles.emptySubtitle}>All caught up! 🎉</Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.jobsList}
        >
          {jobs.map((job, index) => (
            <TouchableOpacity
              key={job._id}
              style={[
                styles.jobCard,
                index === jobs.length - 1 && styles.lastJobCard
              ]}
              onPress={() => handleJobPress(job)}
              activeOpacity={0.7}
            >
              <View style={styles.jobHeader}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {job.contactName}
                  </Text>
                </View>
                <View style={styles.jobMeta}>
                  {job.priority && (
                    <Ionicons 
                      name={getPriorityIcon(job.priority)} 
                      size={16} 
                      color={getPriorityColor(job.priority)} 
                    />
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(job.status)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${job.progress}%`,
                        backgroundColor: getStatusColor(job.status)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>{job.progress}%</Text>
              </View>

              {job.dueDate && (
                <View style={styles.dueDateRow}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.textGray} />
                  <Text style={styles.dueDateText}>
                    Due {new Date(job.dueDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 16,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  errorState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.primary,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textGray,
  },
  jobsList: {
    gap: 12,
  },
  jobCard: {
    padding: 12,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lastJobCard: {
    marginBottom: 0,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
    marginRight: 12,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 13,
    color: COLORS.textGray,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.inputBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textGray,
    minWidth: 35,
    textAlign: 'right',
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 12,
    color: COLORS.textGray,
  },
});