// screens/SetupAccountScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function SetupAccountScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  
  const navigation = useNavigation();
  const route = useRoute();
  const { login } = useAuth();

  useEffect(() => {
    // Get token from deep link or route params
    const setupToken = route.params?.token || getTokenFromDeepLink();
    if (!setupToken) {
      Alert.alert('Error', 'Invalid setup link');
      navigation.navigate('Login');
      return;
    }
    setToken(setupToken);
  }, []);

  const handleSetup = async () => {
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/users/setup-account', {
        token,
        password
      });

      if (response.data.success) {
        // Auto-login the user
        await login(response.data.user.email, password);
        
        Alert.alert(
          'Welcome!',
          'Your account has been set up successfully.',
          [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }]
        );
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Ionicons name="shield-checkmark" size={80} color="#4CAF50" />
          <Text style={{ fontSize: 28, fontWeight: 'bold', marginTop: 20 }}>
            Set Up Your Account
          </Text>
          <Text style={{ fontSize: 16, color: '#666', marginTop: 10, textAlign: 'center' }}>
            Create a secure password for your LPai account
          </Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>
            Password
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                padding: 15,
                fontSize: 16
              }}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ padding: 10, marginLeft: -45 }}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={24} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>
            Confirm Password
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 8,
              padding: 15,
              fontSize: 16
            }}
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
          />
        </View>

        <TouchableOpacity
          onPress={handleSetup}
          disabled={loading}
          style={{
            backgroundColor: '#4CAF50',
            borderRadius: 8,
            padding: 15,
            alignItems: 'center',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
              Set Up Account
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 12, color: '#666' }}>
            Password Requirements:
          </Text>
          <Text style={{ fontSize: 12, color: '#666' }}>
            • At least 8 characters
          </Text>
          <Text style={{ fontSize: 12, color: '#666' }}>
            • Mix of letters and numbers recommended
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}