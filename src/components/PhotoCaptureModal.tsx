// src/components/PhotoCaptureModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function PhotoCaptureModal({ 
  visible, 
  onClose, 
  paymentId,
  invoiceId,
  paymentMethod,
  amount,
  locationId,
  onSuccess 
}) {
  const { user } = useAuth();
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [checkNumber, setCheckNumber] = useState('');

const takePhoto = async () => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images, // Change back to MediaTypeOptions
    quality: 0.7,
    base64: true,
  });

  if (!result.canceled) {
    setPhoto(result.assets[0]);
  }
};

  const handleSubmit = async () => {
    console.log('PhotoCaptureModal - handleSubmit called');
    console.log('invoiceId:', invoiceId);
    console.log('paymentId:', paymentId);
    console.log('amount:', amount);
    console.log('locationId:', locationId);
    console.log('user._id:', user._id);
    console.log('paymentMethod:', paymentMethod);
    
    if (!photo) {
      Alert.alert('Error', 'Please take a photo of the payment');
      return;
    }

    setUploading(true);

    try {
      // First, upload photo to your system
      console.log('Uploading photo proof...');
      const photoResponse = await api.post('/api/payments/upload-proof', {
        paymentId,
        photo: photo.base64,
        locationId
      });
      console.log('Photo upload response:', photoResponse.data);

      // Record payment in GHL
      console.log('Recording payment in GHL...');
      console.log('Sending to record-manual with:', {
        invoiceId: invoiceId,
        locationId,
        amount,
        mode: paymentMethod === 'check' ? 'cheque' : paymentMethod,
        checkNumber: paymentMethod === 'check' ? checkNumber : undefined,
        userId: user._id
      });
      
      const recordResponse = await api.post('/api/payments/record-manual', {
        invoiceId: invoiceId, // Pass the GHL invoice ID
        locationId,
        amount,
        mode: paymentMethod === 'check' ? 'cheque' : paymentMethod, // GHL uses 'cheque'
        checkNumber: paymentMethod === 'check' ? checkNumber : undefined,
        notes: `${paymentMethod === 'check' ? 'Check' : 'Cash'} payment recorded. Photo proof uploaded.`,
        userId: user._id
      });
      
      console.log('Record payment response:', recordResponse.data);

      if (recordResponse.data.success) {
        Alert.alert(
          'Payment Recorded',
          `${paymentMethod === 'check' ? 'Check' : 'Cash'} payment of $${amount.toFixed(2)} has been recorded successfully.`,
          [{ text: 'OK', onPress: onSuccess }]
        );
      }
    } catch (error) {
      console.error('Failed to record payment:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      Alert.alert(
        'Error', 
        error.response?.data?.details || error.response?.data?.error || 'Failed to record payment'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>
            Record {paymentMethod === 'check' ? 'Check' : 'Cash'} Payment
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.instructions}>
            Please take a photo of the {paymentMethod} for verification
          </Text>

          <Text style={styles.amount}>${amount.toFixed(2)}</Text>

          {paymentMethod === 'check' && (
            <TextInput
              style={styles.input}
              placeholder="Check Number (optional)"
              value={checkNumber}
              onChangeText={setCheckNumber}
              keyboardType="numeric"
            />
          )}

          {photo ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <TouchableOpacity 
                style={styles.retakeButton}
                onPress={takePhoto}
              >
                <Text>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
              <Ionicons name="camera" size={48} color="#2E86AB" />
              <Text style={styles.cameraText}>Take Photo</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.submitButton, !photo && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={!photo || uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Record Payment</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  photo: {
    width: 300,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  retakeButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  cameraButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    padding: 40,
    borderRadius: 12,
    marginVertical: 20,
  },
  cameraText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2E86AB',
  },
  submitButton: {
    backgroundColor: '#2E86AB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});