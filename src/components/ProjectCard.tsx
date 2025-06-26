// components/ProjectCard.tsx
// Updated: 2025-06-25
// iOS-style flat design matching ContactCard

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '../styles/theme';
import { Project, Contact } from '../../packages/types';

interface ProjectCardProps {
  project: Project;
  contact?: Contact;
  onPress: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
}

export default function ProjectCard({ 
  project, 
  contact,
  onPress, 
  onLongPress,
  isSelected = false 
}: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
      case 'active':
        return COLORS.success;
      case 'won':
      case 'completed':
        return COLORS.accent;
      case 'lost':
      case 'cancelled':
        return COLORS.error;
      case 'abandoned':
        return COLORS.textGray;
      default:
        return COLORS.textLight;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const updated = new Date(date);
    const diffInHours = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    
    return updated.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.selected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Status Indicator */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(project.status) }]} />
        </View>

        {/* Main Content */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {project.title || 'Untitled Project'}
          </Text>
          
          {/* Contact Info */}
          {contact && (
            <View style={styles.contactRow}>
              <Ionicons name="person-outline" size={14} color={COLORS.textGray} />
              <Text style={styles.contactName} numberOfLines={1}>
                {contact.firstName} {contact.lastName}
              </Text>
            </View>
          )}

          {/* Project Details */}
          <View style={styles.detailsRow}>
            {project.pipelineName && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{project.pipelineName}</Text>
              </View>
            )}
            
            {formatCurrency(project.monetaryValue) && (
              <Text style={styles.value}>{formatCurrency(project.monetaryValue)}</Text>
            )}
          </View>
        </View>

        {/* Right Side */}
        <View style={styles.rightContainer}>
          <Text style={styles.timeText}>
            {getRelativeTime(project.dateUpdated || project.createdAt)}
          </Text>
          
          {/* Progress Indicator */}
          {project.milestones && project.milestones.length > 0 && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {project.milestones.filter(m => m.completed).length}/{project.milestones.length}
              </Text>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            </View>
          )}
          
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selected: {
    backgroundColor: COLORS.lightAccent,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statusContainer: {
    marginRight: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: FONT.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.textGray,
    marginLeft: 6,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textDark,
  },
  value: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: COLORS.accent,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.success,
  },
});