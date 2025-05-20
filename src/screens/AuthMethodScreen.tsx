import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/StackNavigator';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as AuthSession from 'expo-auth-session';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AuthMethodScreen'>;

WebBrowser.maybeCompleteAuthSession();

export default function AuthMethodScreen() {
  const navigation = useNavigation<NavProp>();

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '1066063483841-3j0m045kbht6dc5smp6263tv0j16pnei.apps.googleusercontent.com',
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    prompt: 'select_account' as any,
  });

  useEffect(() => {
    const handleGoogleLogin = async () => {
      if (response?.type === 'success' && response.authentication?.accessToken) {
        try {
          const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.authentication.accessToken}` },
          });

          const email = userInfo.data.email;
          console.log('👉 User email:', email);

          await AsyncStorage.setItem('token', 'mock_token');
          navigation.replace('Home');
        } catch (error) {
          console.error('👉 Error fetching user info:', error);
        }
      } else if (response?.type === 'error') {
        console.error('👉 Authentication error:', response.error);
      }
    };

    handleGoogleLogin();
  }, [response]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome to LPai</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TouchableOpacity onPress={() => promptAsync()} style={styles.socialButton}>
        <AntDesign name="google" size={20} color="#fff" style={styles.icon} />
        <Text style={styles.socialText}>Sign in with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.socialButton} onPress={() => console.log('TODO: Apple Auth')}>
        <Ionicons name="logo-apple" size={22} color="#fff" style={styles.icon} />
        <Text style={styles.socialText}>Sign in with Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.socialButton, styles.emailButton]}
        onPress={() => navigation.navigate('Login')}
      >
        <Ionicons name="mail-outline" size={20} color="#fff" style={styles.icon} />
        <Text style={styles.socialText}>Sign in with Email</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync('https://www.leadprospecting.ai')}>
        <Text style={styles.footerText}>New here? <Text style={styles.footerLink}>Create an account</Text></Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1F36',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAB2BD',
    marginBottom: 32,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F36',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  emailButton: {
    backgroundColor: '#00B3E6',
  },
  icon: {
    marginRight: 12,
  },
  socialText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 32,
    color: '#1A1F36',
    fontSize: 14,
  },
  footerLink: {
    color: '#00B3E6',
    textDecorationLine: 'underline',
  },
});
