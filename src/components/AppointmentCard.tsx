import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import type { Appointment, Contact, Calendar } from '../../packages/types/dist';

interface Props {
  appointment: Appointment;
  contact?: Contact | null;
  calendar?: Calendar | null;
  onContactPress?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}

export default function AppointmentCard({
  appointment,
  contact,
  calendar,
  onContactPress,
  onEdit,
  onCancel,
}: Props) {
  const isCancelled = appointment.status === 'cancelled';
  const calColor = calendar?.eventColor || calendar?.color || COLORS.accent;
  const calIcon = calendar?.icon && typeof calendar.icon === 'string' ? calendar.icon : 'calendar-outline';

  return (
    <View style={[
      styles.card,
      { borderLeftColor: calColor, shadowColor: calColor },
      isCancelled && { backgroundColor: COLORS.background, opacity: 0.65 }
    ]}>
      {/* Title and Icon (top row) */}
      <View style={styles.topRow}>
        <Text style={isCancelled ? styles.titleCancelled : styles.title}>
          {appointment.title}
        </Text>
        {/* Icon in top-right */}
        <Ionicons
          name={calIcon}
          size={24}
          color={calColor}
          style={styles.calendarIcon}
        />
      </View>
      {/* Contact Name */}
      {contact && (
        <TouchableOpacity onPress={onContactPress} disabled={!onContactPress}>
          <Text style={styles.contactName}>
            {contact.firstName} {contact.lastName}
          </Text>
        </TouchableOpacity>
      )}
      {/* Phone */}
      {contact?.phone && (
        <Text style={styles.infoRow}>
          <Ionicons name="call" size={15} color={COLORS.textGray} /> {contact.phone}
        </Text>
      )}
      {/* Address */}
      {contact?.address && (
        <Text style={styles.infoRow}>
          <Ionicons name="location-outline" size={15} color={COLORS.textGray} /> {contact.address}
        </Text>
      )}
      {/* Time */}
      <Text style={[
        styles.time,
        isCancelled && { color: COLORS.textLight, textDecorationLine: 'line-through' }
      ]}>
        {new Date(appointment.start || appointment.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      {/* Cancelled badge */}
      {isCancelled && (
        <Text style={styles.cancelled}>CANCELLED</Text>
      )}
      {/* Actions */}
      {!isCancelled && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={onEdit}>
              <Ionicons name="pencil" size={20} color={COLORS.accent} />
            </TouchableOpacity>
          )}
          {onCancel && (
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="trash" size={20} color={COLORS.textRed} style={{ marginLeft: 16 }} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 8,
    borderLeftWidth: 7,
    borderLeftColor: COLORS.accent,
    ...SHADOW.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Icon to top-right
    marginBottom: 3,
  },
  calendarIcon: {
    marginLeft: 8,
    opacity: 0.85,
  },
  title: {
    fontSize: FONT.appointmentTitle,
    fontWeight: '600',
    color: COLORS.textDark,
    flex: 1,
  },
  titleCancelled: {
    fontSize: FONT.appointmentTitle,
    fontWeight: '600',
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
    flex: 1,
  },
  contactName: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
    marginVertical: 2,
    marginBottom: 1,
  },
  infoRow: {
    color: COLORS.textDark,
    fontSize: FONT.meta,
    marginVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginVertical: 2,
  },
  cancelled: {
    color: COLORS.textRed,
    fontWeight: 'bold',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
