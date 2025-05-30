// src/components/dashboard/ActiveJobsWidget.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';  // ✅ Added useRef
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
//import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, RADIUS, SHADOW } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';

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
  const fadeAnim = useRef(new Animated.Value(0)).current;  // ✅ Now useRef is imported

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
    try {
      const res = await api.get('/api/projects', {
        params: { locationId: user?.locationId }
      });
      
      const activeJobs = res.data
        .filter((p: any) => ['Open', 'In Progress', 'Scheduled'].includes(p.status))
        .slice(0, 4)
        .map((p: any) => ({
          _id: p._id,
          title: p.title,
          contactName: p.contactName || 'Unknown',
          status: p.status,
          progress: p.status === 'Open' ? 10 : p.status === 'Scheduled' ? 30 : 60,
          priority: 'medium' // We'll add this to projects later
        }));
      
      setJobs(activeJobs);
    } catch (error) {
      console.error('Failed to fetch active jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return '#00B3E6';
      case 'Scheduled': return '#FFA500';
      case 'In Progress': return '#27AE60';
      default: return COLORS.textGray;
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
      case 'high': return '#FF4444';
      case 'low': return '#00B3E6';
      default: return '#FFA500';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="briefcase" size={24} color={COLORS.accent} />
            <Text style={styles.title}>Active Jobs</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="briefcase" size={24} color={COLORS.accent} />
          <Text style={styles.title}>Active Jobs</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ProjectsStack' as never)}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No active jobs</Text>
          <Text style={styles.emptySubtext}>All caught up! 🎉</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {jobs.map((job, index) => (
            <TouchableOpacity
              key={job._id}
              style={[styles.jobCard, index === jobs.length - 1 && styles.lastCard]}
              onPress={() => navigation.navigate('ProjectDetailScreen' as never, { project: job } as never)}
              activeOpacity={0.8}
            >
              <View style={styles.jobHeader}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={styles.jobClient}>{job.contactName}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(job.status) }]} />
                  <Text style={styles.statusText}>{job.status}</Text>
                </View>
              </View>
                // In ActiveJobsWidget.tsx, replace the LinearGradient section with:
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

              <View style={styles.jobFooter}>
                <View style={styles.priorityBadge}>
                  <Ionicons 
                    name={getPriorityIcon(job.priority) as any} 
                    size={16} 
                    color={getPriorityColor(job.priority)} 
                  />
                  <Text style={[styles.priorityText, { color: getPriorityColor(job.priority) }]}>
                    {job.priority?.charAt(0).toUpperCase() + job.priority?.slice(1) || 'Medium'}
                  </Text>
                </View>
                {job.dueDate && (
                  <View style={styles.dueDateContainer}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.textGray} />
                    <Text style={styles.dueDate}>{job.dueDate}</Text>
                  </View>
                )}
              </View>
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
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    marginLeft: 8,
  },
  viewAll: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT.input,
    color: COLORS.textGray,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 4,
  },
  jobCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.small,
    padding: 16,
    marginBottom: 12,
  },
  lastCard: {
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
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  jobClient: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textDark,
    minWidth: 35,
    textAlign: 'right',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityText: {
    fontSize: FONT.meta,
    fontWeight: '500',
    marginLeft: 4,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDate: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 4,
  },
});