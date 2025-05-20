import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

interface Props {
  title: string;
  name: string;
  email?: string;
  phone?: string;
  status?: string;
  onPress: () => void;
}

const statusColor = (status?: string) => {
  switch (status) {
    case 'Open':
      return '#00B3E6';
    case 'Quoted':
      return '#FF9500';
    case 'Scheduled':
      return '#8E44AD';
    case 'In Progress':
      return '#2980B9';
    case 'Job Complete':
      return '#27AE60';
    default:
      return '#AAB2BD';
  }
};

export default function ProjectCard({ title, name, email, phone, status, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}><Text style={styles.label}>Client:</Text> {name}</Text>
      {phone && <Text style={styles.meta}><Text style={styles.label}>Phone:</Text> {phone}</Text>}
      {email && <Text style={styles.meta}><Text style={styles.label}>Email:</Text> {email}</Text>}
      {status && (
        <View style={[styles.statusPill, { backgroundColor: statusColor(status) }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1A1F36',
  },
  meta: {
    color: '#4F5665',
    fontSize: 14,
    marginBottom: 2,
  },
  label: {
    fontWeight: '600',
    color: '#1A1F36',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
