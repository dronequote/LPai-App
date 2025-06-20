// screens/AdminPasswordReset.js
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';

export default function AdminPasswordReset() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');

  const handleReset = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          newPassword: password,
          adminToken
        })
      });

      if (response.ok) {
        Alert.alert('Success', 'Password updated!');
      } else {
        Alert.alert('Error', 'Failed to update password');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="User Email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <TextInput
        placeholder="New Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <TextInput
        placeholder="Admin Token"
        value={adminToken}
        onChangeText={setAdminToken}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />
      <Button title="Reset Password" onPress={handleReset} />
    </View>
  );
}