// src/screens/PaymentWebView.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentWebView() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const webViewRef = useRef(null);
  
  const { paymentUrl, paymentId, amount, onSuccess, onCancel } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [payButtonClicked, setPayButtonClicked] = useState(false);

  // Inject JavaScript to auto-click pay button and monitor payment
  const injectedJavaScript = `
    (function() {
      let attempts = 0;
      const maxAttempts = 30; // 15 seconds max
      
      function clickPayButton() {
        attempts++;
        
        // Try multiple selectors for the pay button
        const selectors = [
          'button[class*="Pay"]',
          'button:contains("Pay $")',
          '[class*="pay-button"]',
          'button[class*="btn"]:contains("$")',
          'button:has(span:contains("Pay"))',
          // Look for button with specific text
          ...Array.from(document.querySelectorAll('button')).filter(btn => 
            btn.textContent.includes('Pay $') || 
            btn.textContent.includes('${amount.toFixed(2)}')
          )
        ];
        
        let payButton = null;
        
        // Try each selector
        for (const selector of selectors) {
          if (typeof selector === 'string') {
            payButton = document.querySelector(selector);
          } else {
            payButton = selector; // Already an element
          }
          
          if (payButton) break;
        }
        
        // If we found the button, click it
        if (payButton && !payButton.disabled) {
          console.log('Found pay button, clicking...');
          payButton.click();
          
          // Also try dispatching events in case click doesn't work
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          payButton.dispatchEvent(clickEvent);
          
          // Notify React Native that we clicked
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pay_button_clicked',
            success: true
          }));
          
          return true;
        }
        
        // If not found and we haven't exceeded attempts, try again
        if (attempts < maxAttempts) {
          setTimeout(clickPayButton, 500);
        } else {
          console.log('Could not find pay button after ' + attempts + ' attempts');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pay_button_not_found',
            attempts: attempts
          }));
        }
      }
      
      // Start looking for the button after a brief delay
      setTimeout(clickPayButton, 1000);
      
      // Also listen for any Stripe events
      window.addEventListener('message', function(e) {
        if (e.origin && e.origin.includes('stripe.com')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'stripe_event',
            data: e.data
          }));
        }
      });
      
      // In the injectedJavaScript, update the success detection logic:
        const observer = new MutationObserver((mutations) => {
        // Look for success indicators - but only after payment form interaction
        const successTexts = ['payment complete', 'payment successful', 'thank you for your payment'];
        const bodyText = document.body.innerText.toLowerCase();
        
        // Check if we're on a success page (URL change) or see success message
        const isSuccessUrl = window.location.href.includes('success') || 
                            window.location.href.includes('thank-you') ||
                            window.location.href.includes('confirmation');
        
        for (const text of successTexts) {
            if (bodyText.includes(text) && isSuccessUrl) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'payment_success_detected',
                text: text
            }));
            observer.disconnect();
            break;
            }
        }
});
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Also check URL changes
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'url_changed',
            url: lastUrl
          }));
        }
      }, 500);
    })();
    true;
  `;

  // Handle WebView navigation state changes
  const handleNavigationStateChange = async (navState) => {
    setCanGoBack(navState.canGoBack);
    
    console.log('[PaymentWebView] URL changed to:', navState.url);
    
    // Check for GHL success/cancel URLs
    if (navState.url.includes('success') || 
        navState.url.includes('thank-you') || 
        navState.url.includes('payment-success') ||
        navState.url.includes('order-confirmed') ||
        navState.url.includes('paid')) {
      
      if (!paymentCompleted) {
        setPaymentCompleted(true);
        await handlePaymentSuccess();
      }
      
    } else if (navState.url.includes('cancel') || 
               navState.url.includes('declined') || 
               navState.url.includes('payment-failed')) {
      
      await handlePaymentCancelled();
    }
  };

  // Handle messages from injected JavaScript
  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[PaymentWebView] Message from WebView:', message);
      
      switch (message.type) {
        case 'pay_button_clicked':
          setPayButtonClicked(true);
          console.log('[PaymentWebView] Pay button was clicked');
          break;
          
        case 'pay_button_not_found':
          console.warn('[PaymentWebView] Could not auto-click pay button');
          // Don't show error - user can still click manually
          break;
          
        case 'payment_success_detected':
          if (!paymentCompleted) {
            setPaymentCompleted(true);
            handlePaymentSuccess();
          }
          break;
          
        case 'url_changed':
          if (message.url.includes('success') || message.url.includes('paid')) {
            if (!paymentCompleted) {
              setPaymentCompleted(true);
              handlePaymentSuccess();
            }
          }
          break;
          
        case 'stripe_event':
          console.log('[PaymentWebView] Stripe event:', message.data);
          break;
      }
    } catch (error) {
      console.log('[PaymentWebView] Non-JSON message:', event.nativeEvent.data);
    }
  };

  const handlePaymentSuccess = async () => {
    console.log('[PaymentWebView] Payment successful, updating status...');
    
    try {
      // Update payment status in database
      if (paymentId && user?.locationId) {
        await api.patch(`/api/payments/${paymentId}`, {
          locationId: user.locationId,
          status: 'completed',
          completedAt: new Date().toISOString()
        });
      }
      
      Alert.alert(
        'Payment Successful! 🎉',
        `Your payment of $${amount.toFixed(2)} has been processed successfully.`,
        [
          {
            text: 'Continue',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else {
                navigation.goBack();
              }
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('[PaymentWebView] Failed to update payment status:', error);
      // Still show success to user even if our update failed
      Alert.alert(
        'Payment Successful!',
        `Your payment of $${amount.toFixed(2)} has been processed.`,
        [
          {
            text: 'Continue',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
    }
  };

  const handlePaymentCancelled = async () => {
  console.log('[PaymentWebView] Payment cancelled');
  
  Alert.alert(
    'Payment Not Completed',
    'The payment was not processed. You can try again or select a different payment method.',
    [
      {
        text: 'Go Back',
        onPress: () => {
          if (onCancel) {
            onCancel();
          } else {
            navigation.goBack();
          }
        }
      }
    ],
    { cancelable: false } // Prevent dismissing without tapping button
  );
};

  const handleGoBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      Alert.alert(
        'Cancel Payment?',
        'Are you sure you want to cancel this payment?',
        [
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => {
                if (onCancel) {
                onCancel();
                } else {
                navigation.goBack();
                }
            }
            }
        ]
      );
    }
  };

  // Handle WebView errors
  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[PaymentWebView] WebView error:', nativeEvent);
    
    Alert.alert(
      'Payment Error',
      'There was an error loading the payment page. Please try again.',
      [
        {
          text: 'Go Back',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Payment</Text>
        <Ionicons name="lock-closed" size={20} color={COLORS.textGray} />
      </View>

      {/* Payment Amount */}
      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Amount Due</Text>
        <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
        {payButtonClicked && (
          <Text style={styles.processingText}>Processing payment form...</Text>
        )}
      </View>

      {/* WebView */}
      <View style={styles.webViewContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading secure payment page...</Text>
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          onError={handleError}
          onMessage={handleMessage}
          injectedJavaScript={injectedJavaScript}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          // Allow cookies for payment processing
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          // Allow mixed content for payment iframes
          mixedContentMode="always"
          // Disable hardware acceleration if payment form has issues
          androidHardwareAccelerationDisabled={false}
          // Set user agent if needed
          userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        />
      </View>

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
        <Text style={styles.securityText}>
          Your payment information is secure and encrypted
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOW.card,
  },
  headerTitle: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  amountContainer: {
    backgroundColor: COLORS.accentMuted,
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  amountLabel: {
    fontSize: FONT.input,
    color: COLORS.textGray,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.accent,
  },
  processingText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginTop: 8,
    fontStyle: 'italic',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: FONT.input,
    color: COLORS.textGray,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  securityText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    marginLeft: 8,
  },
});