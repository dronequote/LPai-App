import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '../styles/theme';
import type { Appointment, Contact, Calendar } from '../../packages/types/dist';

interface Props {
  appointment: Appointment;
  contact?: Contact | null;
  calendar?: Calendar | null;
  onPress?: () => void;
}

export default function CompactAppointmentCard({
  appointment,
  contact,
  calendar,
  onPress,
}: Props) {
  const calColor = calendar?.eventColor || calendar?.color || COLORS.accent;
  const calIcon = calendar?.icon;

  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, { borderLeftColor: calColor }]}>
      <View style={styles.row}>
        {calIcon && (
          <Ionicons
            name={calIcon}
            size={18}
            color={calColor}
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={styles.title}>
          {contact
            ? `${contact.firstName} ${contact.lastName} – ${appointment.title}`
            : appointment.title}
        </Text>
      </View>
      <Text style={styles.time}>
        {new Date(appointment.start || appointment.time).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderLeftWidth: 6,
    borderLeftColor: COLORS.accent,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: COLORS.textDark, flex: 1 },
  time: { fontSize: 13, color: COLORS.textGray, marginTop: 2, marginLeft: 26 },
});
