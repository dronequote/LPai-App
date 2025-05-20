import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

interface Project {
  title: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface Props {
  name: string;
  email: string;
  phone: string;
  projects: Project[];
  onPress: () => void;
}

export default function ContactCard({ name, email, phone, projects, onPress }: Props) {
  const [expanded, setExpanded] = useState(false);

  const total = projects.length;
  const completed = projects.filter((p) => p.status === 'Job Complete').length;

  const sorted = [...projects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const latest = sorted[sorted.length - 1]; // latest = oldest index since sorted ASC

  const toggleExpanded = () => setExpanded((prev) => !prev);

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleDateString();
  };

  const badgeStyleMap: { [key: string]: any } = {
    Open: styles.badge_Open,
    Quoted: styles.badge_Quoted,
    Scheduled: styles.badge_Scheduled,
    'Job Complete': styles.badge_JobComplete,
  };

  const badgeStyle = latest?.status ? badgeStyleMap[latest.status.trim()] || {} : {};

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={toggleExpanded}
      activeOpacity={0.9}
    >
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.phone}>{phone}</Text>
      <Text style={styles.email}>{email}</Text>

      <View style={styles.statusRow}>
        <Text style={styles.label}>Latest Status: </Text>
        {latest?.status ? (
          <View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{latest.status}</Text>
          </View>
        ) : (
          <Text style={styles.meta}>—</Text>
        )}
      </View>

      <Text style={styles.meta}>
        <Text style={styles.label}>Projects: </Text>
        {total} total • {completed} completed
      </Text>

      {latest?.updatedAt && (
        <Text style={styles.meta}>
          <Text style={styles.label}>Updated: </Text>
          {formatDate(latest.updatedAt)}
        </Text>
      )}

      {expanded && (
        <View style={styles.projectList}>
          {sorted.map((p, index) => (
            <View key={index} style={styles.projectItem}>
              <Text style={styles.projectTitle}>{p.title}</Text>
              <Text style={styles.projectStatus}>{p.status}</Text>
              {p.updatedAt && (
                <Text style={styles.projectDate}>Updated: {formatDate(p.updatedAt)}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1F36',
  },
  email: {
    fontSize: 14,
    color: '#AAB2BD',
    marginTop: 4,
  },
  phone: {
    fontSize: 14,
    color: '#AAB2BD',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  label: {
    fontWeight: '600',
    color: '#1A1F36',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  badge_Open: { backgroundColor: '#3498db' },
  badge_Quoted: { backgroundColor: '#f1c40f' },
  badge_Scheduled: { backgroundColor: '#9b59b6' },
  badge_JobComplete: { backgroundColor: '#2ecc71' },
  projectList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  projectItem: {
    marginBottom: 10,
  },
  projectTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  projectStatus: {
    fontSize: 13,
    color: '#00B3E6',
  },
  projectDate: {
    fontSize: 12,
    color: '#999',
  },
});
