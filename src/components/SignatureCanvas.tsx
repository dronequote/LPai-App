// src/components/SignatureCanvas.tsx
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import { COLORS, FONT, RADIUS } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 40;
const CANVAS_HEIGHT = 200;

interface SignatureCanvasProps {
  onSignatureComplete: (signatureData: { signature: string; timestamp: string }) => void;
  signerName: string;
  signerRole: 'Consultant' | 'Customer';
  confirmButtonText?: string;
  confirmButtonColor?: string;
  disabled?: boolean;
}

export default function SignatureCanvas({ 
  onSignatureComplete, 
  signerName, 
  signerRole,
  confirmButtonText = "Confirm Signature",
  confirmButtonColor = COLORS.accent,
  disabled = false 
}: SignatureCanvasProps) {
  const signatureRef = useRef<any>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Handle signature from the canvas
  const handleSignature = (signature: string) => {
    if (signature && signature.length > 100) { // Valid signature data
      setSignatureData(signature);
      setHasSignature(true);
      
      // Create signature object with timestamp
      const signatureObject = {
        signature: signature,
        timestamp: new Date().toISOString()
      };
      
      // Call the prop function with the complete object
      onSignatureComplete(signatureObject);
    }
  };

  // Clear signature
  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
      setHasSignature(false);
      setSignatureData(null);
    }
  };

  // Confirm signature - trigger the canvas to export
  const confirmSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else {
      Alert.alert('Error', 'Please draw your signature first.');
    }
  };

  // Handle when signature is ready from canvas
  const handleOK = (signature: string) => {
    handleSignature(signature);
  };

  // Handle empty signature
  const handleEmpty = () => {
    Alert.alert('Signature Required', 'Please draw your signature first.');
  };

  // Custom styles for the signature pad (hide default buttons)
  const webStyle = `
    .m-signature-pad {
      position: relative;
      font-size: 10px;
      width: 100%;
      height: 100%;
      border: 2px solid ${COLORS.border};
      border-radius: 8px;
      background-color: ${COLORS.card};
    }
    .m-signature-pad--body {
      position: absolute;
      left: 20px;
      right: 20px;
      top: 20px;
      bottom: 20px;
    }
    .m-signature-pad--body canvas {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      border-radius: 4px;
    }
    .m-signature-pad--footer {
      display: none !important;
    }
    .description {
      display: none !important;
    }
  `;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.signerRole}>{signerRole} Signature</Text>
        <Text style={styles.signerName}>{signerName}</Text>
      </View>

      {/* Signature Pad */}
      <View style={styles.signaturePadContainer}>
        <SignatureScreen
          ref={signatureRef}
          onOK={handleOK}
          onEmpty={handleEmpty}
          onClear={() => setHasSignature(false)}
          autoClear={false}
          descriptionText=""
          clearText=""
          confirmText=""
          webStyle={webStyle}
          imageType="image/png"
          style={styles.signaturePad}
          disabled={disabled}
        />
      </View>

      {/* Custom Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.clearButton, disabled && styles.buttonDisabled]}
          onPress={clearSignature}
          disabled={disabled}
        >
          <Ionicons name="refresh" size={16} color={COLORS.textGray} />
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.confirmButton, 
            { backgroundColor: confirmButtonColor },
            disabled && styles.buttonDisabled
          ]}
          onPress={confirmSignature}
          disabled={disabled}
        >
          <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
        </TouchableOpacity>
      </View>

      {/* Signature Status */}
      <View style={styles.signatureStatus}>
        {hasSignature ? (
          <View style={styles.signatureComplete}>
            <Ionicons name="checkmark-circle" size={20} color="#27ae60" />
            <Text style={styles.signatureCompleteText}>Signature Captured</Text>
          </View>
        ) : (
          <Text style={styles.signaturePending}>Draw your signature above, then tap "{confirmButtonText}"</Text>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          • Draw your signature using your finger or stylus
        </Text>
        <Text style={styles.instructionText}>
          • Tap "{confirmButtonText}" when finished or "Clear" to start over
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  signerRole: {
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 4,
  },
  signerName: {
    fontSize: FONT.input,
    color: COLORS.textDark,
    fontWeight: '500',
  },
  signaturePadContainer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    alignSelf: 'center',
    marginBottom: 16,
  },
  signaturePad: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearButtonText: {
    marginLeft: 8,
    fontSize: FONT.meta,
    color: COLORS.textGray,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  signatureStatus: {
    alignItems: 'center',
    marginBottom: 16,
  },
  signatureComplete: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signatureCompleteText: {
    marginLeft: 8,
    fontSize: FONT.meta,
    color: '#27ae60',
    fontWeight: '600',
  },
  signaturePending: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    fontStyle: 'italic',
  },
  instructions: {
    backgroundColor: COLORS.accentMuted,
    padding: 16,
    borderRadius: RADIUS.card,
    marginHorizontal: 20,
  },
  instructionText: {
    fontSize: FONT.meta,
    color: COLORS.textGray,
    lineHeight: 18,
    marginBottom: 4,
  },
});