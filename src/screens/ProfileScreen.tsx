import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const navigation = useNavigation();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.patch(`http://192.168.0.62:3000/api/users/${user?.userId}`, {
        name,
        email,
        phone,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      console.error('Failed to update user:', err);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={styles.label}>Role</Text>
      <Text style={styles.readOnly}>{user?.role || '—'}</Text>

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </TouchableOpacity>

      <Text style={styles.locationId}>Location ID: {user?.locationId}</Text>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'AuthMethodScreen' }],
          });
        }}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24, color: '#1A1F36' },
  label: { fontSize: 14, color: '#666', marginBottom: 4, marginTop: 16 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 10, fontSize: 16 },
  readOnly: { fontSize: 16, color: '#1A1F36', marginTop: 8 },
  button: {
    backgroundColor: '#00B3E6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  locationId: {
    fontSize: 12,
    color: '#AAB2BD',
    textAlign: 'center',
    marginTop: 20,
  },
  logoutButton: {
    backgroundColor: '#E53935',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
