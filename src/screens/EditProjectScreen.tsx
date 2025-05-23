import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../lib/api'; // ✅ Centralized axios instance

const schema = yup.object().shape({
  firstName: yup.string().required('Required'),
  lastName: yup.string().required('Required'),
  email: yup.string().email('Invalid email').required('Required'),
  phone: yup.string().required('Required'),
  notes: yup.string().optional(),
});

export default function EditContactScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { contactId } = route.params as { contactId: string };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const res = await api.get(`/api/contacts/${contactId}`);
        reset(res.data);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load contact.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [contactId]);

  const onSubmit = async (data: any) => {
    try {
      setSubmitting(true);
      await api.patch(`/api/contacts/${contactId}`, data);
      Alert.alert('Success', 'Contact updated');
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update contact');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Edit Contact</Text>

        {(['firstName', 'lastName', 'email', 'phone', 'notes'] as const).map((field) => (
          <View key={field}>
            <Text style={styles.label}>{field.replace(/^\w/, (c) => c.toUpperCase())}</Text>
            <Controller
              control={control}
              name={field}
              render={({ field: { value, onChange } }) => (
                <TextInput
                  style={[styles.input, field === 'notes' && styles.notesInput]}
                  value={value}
                  onChangeText={onChange}
                  placeholder={`Enter ${field}`}
                  multiline={field === 'notes'}
                />
              )}
            />
            {errors[field] && (
              <Text style={styles.error}>{(errors as any)[field]?.message}</Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit(onSubmit)}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 20, color: '#1A1F36' },
  label: { fontSize: 14, color: '#AAB2BD', fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1A1F36',
    backgroundColor: '#fff',
  },
  notesInput: { height: 100, textAlignVertical: 'top' },
  error: { color: '#E53935', fontSize: 12, marginTop: 4 },
  button: {
    marginTop: 32,
    backgroundColor: '#00B3E6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
