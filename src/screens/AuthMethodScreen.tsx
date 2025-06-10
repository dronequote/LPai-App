import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/StackNavigator';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import * as AuthSession from 'expo-auth-session';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AuthMethodScreen'>;

WebBrowser.maybeCompleteAuthSession();

export default function AuthMethodScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      if (__DEV__) {
        console.log('🔐 [AuthMethodScreen] User already authenticated, redirecting to Main');
      }
      navigation.replace('Main');
    }
  }, [user, navigation]);

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  // Google OAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '1066063483841-3j0m045kbht6dc5smp6263tv0j16pnei.apps.googleusercontent.com',
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    prompt: 'select_account' as any,
  });

  useEffect(() => {
    handleGoogleResponse();
  }, [response]);

  const handleGoogleResponse = async () => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      try {
        if (__DEV__) {
          console.log('🔐 [AuthMethodScreen] Google auth successful, fetching user info...');
        }

        // For now, we'll show a message that OAuth is not fully implemented
        Alert.alert(
          'Coming Soon',
          'Google sign-in is being configured. Please use email login for now.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );

        // When backend OAuth is ready, uncomment this:
        /*
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.authentication.accessToken}` },
        });
        
        const userInfo = await userInfoResponse.json();
        const email = userInfo.email;
        
        if (__DEV__) {
          console.log('🔐 [AuthMethodScreen] Google user email:', email);
        }

        // Use authService for OAuth login
        const loginResponse = await authService.oauthLogin(email);
        
        if (loginResponse.noEmailFound) {
          Alert.alert(
            'Account Not Found',
            'No account found with this email. Please sign up first at leadprospecting.ai',
            [{ text: 'OK' }]
          );
        } else {
          navigation.replace('Main');
        }
        */
      } catch (error) {
        console.error('❌ [AuthMethodScreen] OAuth error:', error);
        Alert.alert(
          'Sign In Failed',
          'Unable to sign in with Google. Please try email login.',
          [{ text: 'OK' }]
        );
      }
    } else if (response?.type === 'error') {
      console.error('❌ [AuthMethodScreen] Google auth error:', response.error);
    }
  };

  const handleGoogleSignIn = () => {
    if (__DEV__) {
      console.log('📱 [AuthMethodScreen] Google sign-in pressed');
    }
    
    // For now, show coming soon message
    Alert.alert(
      'Coming Soon',
      'Google sign-in will be available soon! Please use email login for now.',
      [
        {
          text: 'Use Email Login',
          onPress: () => navigation.navigate('Login'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );

    // When ready, uncomment this:
    // promptAsync();
  };

  const handleAppleSignIn = () => {
    if (__DEV__) {
      console.log('📱 [AuthMethodScreen] Apple sign-in pressed');
    }
    
    Alert.alert(
      'Coming Soon',
      'Apple sign-in will be available soon! Please use email login for now.',
      [
        {
          text: 'OK',
        },
      ]
    );
  };

  const handleEmailSignIn = () => {
    if (__DEV__) {
      console.log('📱 [AuthMethodScreen] Email sign-in pressed');
    }
    navigation.navigate('Login');
  };

  const handleCreateAccount = async () => {
    if (__DEV__) {
      console.log('📱 [AuthMethodScreen] Create account pressed');
    }
    
    try {
      await WebBrowser.openBrowserAsync('https://www.leadprospecting.ai');
    } catch (error) {
      Alert.alert('Error', 'Could not open sign up page');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <Ionicons name="briefcase" size={48} color="#00B3E6" />
          </View>
        </View>

        <Text style={styles.title}>Welcome to LPai</Text>
        <Text style={styles.subtitle}>Your business management companion</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={handleGoogleSignIn} 
            style={styles.socialButton}
            activeOpacity={0.8}
          >
            <AntDesign name="google" size={20} color="#fff" style={styles.icon} />
            <Text style={styles.socialText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity 
              style={styles.socialButton} 
              onPress={handleAppleSignIn}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={22} color="#fff" style={styles.icon} />
              <Text style={styles.socialText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, styles.emailButton]}
            onPress={handleEmailSignIn}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={20} color="#fff" style={styles.icon} />
            <Text style={styles.socialText}>Continue with Email</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={handleCreateAccount}>
            <Text style={styles.footerLink}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1F36',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAB2BD',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#AAB2BD',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#1A1F36',
    fontSize: 14,
    marginRight: 4,
  },
  footerLink: {
    color: '#00B3E6',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});