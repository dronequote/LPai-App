// src/components/ProjectCard.tsx
// Updated: 2025-06-16

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import { Project } from '../../packages/types';

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
  onStatusChange?: (status: string) => void;
}

const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'active':
      return COLORS.primary;
    case 'won':
    case 'completed':
    case 'job complete':
      return '#27AE60';
    case 'lost':
    case 'cancelled':
      return '#E74C3C';
    case 'abandoned':
      return '#F39C12';
    case 'quoted':
      return '#3498DB';
    case 'scheduled':
      return '#9B59B6';
    case 'in progress':
      return '#1ABC9C';
    default:
      return COLORS.textGray;
  }
};

const getStatusText = (status: string): string => {
  // Convert snake_case or kebab-case to Title Case
  return status
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function ProjectCard({ project, onPress, onStatusChange }: ProjectCardProps) {
  if (!project) return null;

  const statusColor = getStatusColor(project.status);
  const formattedDate = project.createdAt 
    ? new Date(project.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {project.title || 'Untitled Project'}
          </Text>
          {project.contactName && (
            <Text style={styles.contactName} numberOfLines={1}>
              {project.contactName}
            </Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>
            {getStatusText(project.status)}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        {project.monetaryValue && project.monetaryValue > 0 && (
          <View style={styles.detailItem}>
            <Ionicons name="cash-outline" size={16} color={COLORS.textGray} />
            <Text style={styles.detailText}>
              ${project.monetaryValue.toFixed(2)}
            </Text>
          </View>
        )}
        
        {project.pipelineName && (
          <View style={styles.detailItem}>
            <Ionicons name="funnel-outline" size={16} color={COLORS.textGray} />
            <Text style={styles.detailText} numberOfLines={1}>
              {project.pipelineName}
            </Text>
          </View>
        )}

        {formattedDate && (
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textGray} />
            <Text style={styles.detailText}>{formattedDate}</Text>
          </View>
        )}
      </View>

      {project.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {project.notes}
        </Text>
      )}

      {onStatusChange && (
        <View style={styles.quickActions}>
          <TouchableWithoutFeedback>
            <View style={styles.quickActionButton}>
              <Ionicons name="flash-outline" size={18} color={COLORS.accent} />
              <Text style={styles.quickActionText}>Quick Update</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  contactName: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  statusText: {
    color: '#fff',
    fontSize: FONT.meta,
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 4,
  },
  notes: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    lineHeight: 20,
    marginTop: 8,
  },
  quickActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: FONT.meta,
    color: COLORS.accent,
    fontWeight: '500',
    marginLeft: 4,
  },
});