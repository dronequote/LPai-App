import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';

interface FilterModalProps {
  isVisible: boolean;
  onClose: () => void;
  statusFilter: string | null;
  setStatusFilter: (value: string | null) => void;
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  phoneFilter: string;
  setPhoneFilter: (value: string) => void;
  onClear: () => void;
}

const allStatuses = ['Open', 'Quoted', 'Scheduled', 'Job Complete'];

const FilterModal = ({
  isVisible,
  onClose,
  statusFilter,
  setStatusFilter,
  projectFilter,
  setProjectFilter,
  phoneFilter,
  setPhoneFilter,
  onClear,
}: FilterModalProps) => {
  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modal}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Filter Contacts</Text>

        <Text style={styles.label}>Status</Text>
        <View style={styles.row}>
          {allStatuses.map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() =>
                setStatusFilter((prev) => (prev === status ? null : status))
              }
              style={[
                styles.pill,
                statusFilter === status && styles.pillActive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  statusFilter === status && styles.pillTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Project</Text>
        <TextInput
          style={styles.input}
          placeholder="Project name..."
          value={projectFilter}
          onChangeText={setProjectFilter}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone number..."
          value={phoneFilter}
          onChangeText={setPhoneFilter}
        />

        <View style={styles.footer}>
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default FilterModal;

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  content: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F1F2F6',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    color: '#1A1F36',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    backgroundColor: '#F1F2F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: {
    backgroundColor: '#00B3E6',
  },
  pillText: {
    fontSize: 14,
    color: '#1A1F36',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clearText: { color: '#E53935', fontWeight: '600' },
  doneText: { color: '#00B3E6', fontWeight: '600' },
});
