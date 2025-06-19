// Create a new file: src/components/CalendarPicker.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '../styles/theme';

interface CalendarPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
  availableDates?: string[]; // Array of date strings with available slots
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarPicker({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  availableDates = []
}: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [dates, setDates] = useState<(Date | null)[]>([]);

  useEffect(() => {
    generateCalendarDates();
  }, [currentMonth]);

  const generateCalendarDates = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const calendarDates: (Date | null)[] = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      if (current.getMonth() === month) {
        calendarDates.push(new Date(current));
      } else {
        calendarDates.push(null);
      }
      current.setDate(current.getDate() + 1);
    }

    setDates(calendarDates);
  };

  const navigateMonth = (direction: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const hasAvailableSlots = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return availableDates.includes(dateStr);
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateSelect = (date: Date) => {
    if (!isPastDate(date)) {
      onSelectDate(date);
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigateMonth(-1)}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.monthYear}>
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth(1)}>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS.map((day, index) => (
              <Text key={index} style={styles.dayHeader}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
            <View style={styles.grid}>
            {dates.map((date, index) => {
                if (!date) {
                return <View key={index} style={styles.emptyCell} />;
                }

                const isPast = isPastDate(date);
                const isSelectedDate = isSelected(date);
                const isTodayDate = isToday(date);
                const hasSlots = hasAvailableSlots(date);

                return (
                <TouchableOpacity
                    key={index}
                    style={styles.dateCell}
                    onPress={() => handleDateSelect(date)}
                    disabled={isPast}
                >
                    <View style={[
                    styles.dateCellInner,
                    isSelectedDate && styles.selectedCell,
                    isTodayDate && styles.todayCell,
                    isPast && styles.pastCell,
                    ]}>
                    <Text
                        style={[
                        styles.dateText,
                        isSelectedDate && styles.selectedText,
                        isPast && styles.pastText,
                        ]}
                    >
                        {date.getDate()}
                    </Text>
                    {hasSlots && !isPast && (
                        <View style={styles.slotIndicator} />
                    )}
                    </View>
                </TouchableOpacity>
                );
            })}
            </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.todayButton} 
              onPress={() => {
                const today = new Date();
                setCurrentMonth(today);
                handleDateSelect(today);
              }}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.card * 2,
    padding: 24,
    width: '90%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textGray,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  dateCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 2,
  },
  emptyCell: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.textDark,
  },
  selectedCell: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  selectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 8,
  },
  pastCell: {
    opacity: 0.3,
  },
  pastText: {
    color: COLORS.textLight,
  },
  slotIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#27AE60',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textGray,
    fontWeight: '500',
  },
  todayButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
  },
  todayButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  dateCellInner: {
  width: '100%',
  height: '100%',
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 8,
},
});