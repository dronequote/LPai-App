// src/components/dashboard/ActiveJobsWidget.tsx
// Updated: 2025-06-17

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
    if (__DEV__) {
      console.log('🔄 [ActiveJobsWidget] Loading active jobs...');
    }
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
      
      if (__DEV__) {
        console.log('🔧 [ActiveJobsWidget] Fetching projects...');
      }
      
      // Use the new API - BaseService handles locationId automatically
      let projects: Project[] = [];
      
      try {
        projects = await projectService.list({
          limit: 50,
          offset: 0
        });
      } catch (projectError) {
        console.error('❌ [ActiveJobsWidget] Error calling projectService.list:', projectError);
        throw projectError;
      }
      
      if (__DEV__) {
        console.log('📊 [ActiveJobsWidget] Projects fetched:', projects.length);
        console.log('📊 [ActiveJobsWidget] First project:', projects[0]);
      }
      
      // Filter for active statuses on the client side
      const activeStatuses = ['open', 'in progress', 'scheduled', 'quoted'];
      const activeJobs = projects
        .filter((p: Project) => {
          const status = p.status?.toLowerCase() || '';
          return activeStatuses.includes(status);
        })
        .slice(0, 4)
        .map((p: Project) => {
          try {
            const progress = calculateProgress(p);
            return {
              _id: p._id,
              title: p.title || 'Untitled Project',
              contactName: p.contactName || p.contact?.name || 'Unknown',
              status: p.status || 'open',
              progress: progress,
              priority: p.customFields?.priority || 'medium',
              dueDate: p.customFields?.dueDate
            };
          } catch (mapError) {
            console.error('❌ [ActiveJobsWidget] Error mapping project:', p._id, mapError);
            throw mapError;
          }
        });
      
      if (__DEV__) {
        console.log('✅ [ActiveJobsWidget] Active jobs:', activeJobs.length);
      }
      
      setJobs(activeJobs);
    } catch (error: any) {
      console.error('❌ [ActiveJobsWidget] Failed to fetch active jobs:', error);
      
      // Better error handling based on error type
      if (error.response?.status === 422) {
        setError('Invalid request parameters');
      } else if (error.response?.status === 401) {
        setError('Please login again');
      } else if (error.message?.includes('Network')) {
        setError('Network error. Check your connection');
      } else {
        setError('Failed to load active jobs');
      }
      
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
    const status = project.status?.toLowerCase() || '';
    switch (status) {
      case 'open': return 10;
      case 'quoted': return 25;
      case 'scheduled': return 40;
      case 'in progress': return 60;
      case 'job complete': return 100;
      default: return 0;
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'open': return '#00B3E6';
      case 'quoted': return '#3498DB';
      case 'scheduled': return '#9B59B6';
      case 'in progress': return '#27AE60';
      case 'job complete': return '#2ECC71';
      default: return COLORS.textGray;
    }
  };

  const getStatusLabel = (status: string) => {
    // Convert to proper case
    return status
      .split(/[\s_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'high': return 'arrow-up-circle';
      case 'low': return 'arrow-down-circle';
      default: return 'remove-circle';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return '#E74C3C';
      case 'low': return '#3498DB';
      default: return '#F39C12';
    }
  };

  const handleJobPress = (job: Job) => {
    navigation.navigate('ProjectDetailScreen' as never, { projectId: job._id } as never);
  };

  const handleViewAll = () => {
    navigation.navigate('Projects' as never);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Active Jobs</Text>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Active Jobs</Text>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color={COLORS.textGray} />
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
        <Text style={styles.title}>Active Jobs</Text>
        <TouchableOpacity onPress={handleViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="briefcase-outline" size={48} color={COLORS.textGray} />
          <Text style={styles.emptyText}>No active jobs</Text>
          <Text style={styles.emptySubtext}>Projects will appear here when they're active</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {jobs.map((job) => (
            <TouchableOpacity
              key={job._id}
              style={styles.jobCard}
              onPress={() => handleJobPress(job)}
              activeOpacity={0.7}
            >
              <View style={styles.jobHeader}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text style={styles.jobContact} numberOfLines={1}>
                    {job.contactName}
                  </Text>
                </View>
                <View style={styles.jobMeta}>
                  <Ionicons 
                    name={getPriorityIcon(job.priority)} 
                    size={20} 
                    color={getPriorityColor(job.priority)} 
                  />
                  <View 
                    style={[
                      styles.statusBadge, 
                      { backgroundColor: getStatusColor(job.status) }
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusLabel(job.status)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressPercent}>{job.progress}%</Text>
                </View>
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
              </View>

              {job.dueDate && (
                <View style={styles.dueDateContainer}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textGray} />
                  <Text style={styles.dueDate}>
                    Due: {new Date(job.dueDate).toLocaleDateString()}
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
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 16,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  viewAllText: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
  },
  retryText: {
    color: '#fff',
    fontSize: FONT.meta,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  jobCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.input,
    padding: 12,
    marginBottom: 8,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  jobInfo: {
    flex: 1,
    marginRight: 12,
  },
  jobTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  jobContact: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  progressPercent: {
    fontSize: FONT.meta,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  dueDate: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
});