// src/screens/SignatureScreen.tsx - UPDATED with Opportunity Integration
// Updated: 2025-06-17
// Using services instead of direct API calls

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { locationService } from '../services/locationService';
import { signatureService } from '../services/signatureService';
import { projectService } from '../services/projectService';
import { paymentService } from '../services/paymentService';
import emailService from '../services/emailService';
import SignatureCanvas from '../components/SignatureCanvas';
import PhotoCaptureModal from '../components/PhotoCaptureModal'; // ADD THIS IMPORT
import { COLORS, FONT, RADIUS, SHADOW } from '../styles/theme';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/StackNavigator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Add type for navigation
type SignatureScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignatureScreen'>;

const STEPS = [
  { id: 1, title: 'Review', icon: 'document-text' },
  { id: 2, title: 'Consultant', icon: 'person' },
  { id: 3, title: 'Customer', icon: 'people' },
  { id: 4, title: 'Complete', icon: 'checkmark-circle' }
];

export default function SignatureScreen() {
  const route = useRoute();
  const navigation = useNavigation<SignatureScreenNavigationProp>();
  const { user } = useAuth();
  
  const { quote, template } = route.params || {};

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState({});
  const [signatures, setSignatures] = useState({
    consultant: null,
    customer: null
  });

  // Email automation state
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);

  // ✅ NEW: Opportunity update state
  const [opportunityUpdating, setOpportunityUpdating] = useState(false);
  const [opportunityUpdated, setOpportunityUpdated] = useState(false);
  const [opportunityError, setOpportunityError] = useState(null);

  // Payment state
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [savingPaymentPreference, setSavingPaymentPreference] = useState(false);

  // Add state for photo modal
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [manualPaymentId, setManualPaymentId] = useState(null);
  const [manualInvoiceId, setManualInvoiceId] = useState(null);
  
  // Load company data on mount
  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    if (!user?.locationId) return;
    
    try {
      const response = await locationService.getDetails(user.locationId);
      setCompanyData(response.companyInfo || {});
    } catch (error) {
      console.warn('[SignatureScreen] Failed to load company data:', error);
      setCompanyData({});
    }
  };

  const buildVariables = () => {
    const currentYear = new Date().getFullYear();
    const establishedYear = parseInt(
      template?.companyOverrides?.establishedYear || 
      companyData.establishedYear || 
      currentYear.toString()
    );

    return {
      companyName: template?.companyOverrides?.name || companyData.name || 'Your Company',
      phone: template?.companyOverrides?.phone || companyData.phone || '',
      email: template?.companyOverrides?.email || companyData.email || '',
      address: template?.companyOverrides?.address || companyData.address || '',
      warrantyYears: template?.companyOverrides?.warrantyYears || companyData.warrantyYears || '1',
      customerName: quote?.customerName || 'Customer',
      projectTitle: quote?.projectTitle || 'Project',
      totalAmount: quote?.total ? `$${quote.total.toLocaleString()}` : '$0',
    };
  };

  const replaceVariables = (text, variables) => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value || `{${key}}`);
    });
    return result;
  };

  const handleConsultantSignature = (signatureData) => {
    setSignatures(prev => ({ ...prev, consultant: signatureData }));
    setCurrentStep(3);
  };

  const handleCustomerSignature = (signatureData) => {
    setSignatures(prev => ({ ...prev, customer: signatureData }));
    completeSignatureProcess(signatureData);
  };

  // ✅ UPDATED: Complete signature process with opportunity integration
  const completeSignatureProcess = async (customerSignature) => {
    console.log('[SignatureScreen] ===== STARTING COMPLETE SIGNATURE PROCESS =====');
    
    if (!user?.locationId || !quote?._id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    try {
      setLoading(true);
      setCurrentStep(4);

      // Step 1: Save both signatures to MongoDB
      console.log('[SignatureScreen] Saving signatures to MongoDB...');
      
      // Save consultant signature first
      const consultantResponse = await signatureService.submitSignatures(
        quote._id,
        user.locationId,
        {
          consultant: {
            type: 'consultant',
            signature: signatures.consultant.signature,
            signedAt: new Date().toISOString(),
            name: user.name,
          }
        }
      );

      if (!consultantResponse.success) {
        throw new Error('Failed to save consultant signature');
      }

      // Save customer signature
      const customerResponse = await signatureService.submitSignatures(
        quote._id,
        user.locationId,
        {
          customer: {
            type: 'customer',
            signature: customerSignature.signature,
            signedAt: new Date().toISOString(),
            name: quote.customerName,
          }
        }
      );

      if (!customerResponse.success) {
        throw new Error('Failed to save customer signature');
      }

      console.log('[SignatureScreen] Signatures saved successfully');

      // Step 2: Generate PDF with embedded signatures
      console.log('[SignatureScreen] Generating signed PDF...');
      const pdfResponse = await signatureService.generateSignedPDF(quote._id, user.locationId);

      if (!pdfResponse.success) {
        throw new Error('Failed to generate PDF');
      }

      // ✅ FIX: Get the fileId from the correct path in the response
      const pdfFileId = pdfResponse.pdfUrl || pdfResponse.fileId;
      console.log('[SignatureScreen] PDF generated successfully:', pdfFileId);

      if (!pdfFileId) {
        console.error('[SignatureScreen] PDF fileId not found in response:', pdfResponse);
        throw new Error('PDF generated but fileId not returned');
      }

      // ✅ Step 3: NEW - Update GHL Opportunity with signed date
      console.log('[SignatureScreen] Updating GHL opportunity...');
      await updateOpportunityFields();

      // Step 4: Send contract email automatically
      console.log('[SignatureScreen] Starting email automation...');
      setEmailSending(true);
      
      try {
        // Call the email service to send contract
        const emailResponse = await emailService.sendSignedQuote(
          quote._id,
          user.locationId,
          {
            recipientEmail: quote.contact?.email || quote.customerEmail,
            includePDF: true,
          }
        );

        setEmailSending(false);

        if (emailResponse.success) {
          setEmailSent(true);
          console.log('[SignatureScreen] Email sent successfully:', {
            messageId: emailResponse.messageId,
          });
        } else {
          setEmailError('Email failed to send');
          console.warn('[SignatureScreen] Email failed:', emailResponse);
        }
      } catch (emailError) {
        setEmailSending(false);
        setEmailError(emailError.message);
        console.error('[SignatureScreen] Email service error:', emailError);
      }

      console.log('[SignatureScreen] ===== SIGNATURE PROCESS COMPLETE =====');

    } catch (error) {
      console.error('[SignatureScreen] Failed to complete signature process:', error);
      Alert.alert('Error', 'Failed to complete signature process. Please try again.');
      setCurrentStep(3); // Go back to customer signature step
      setEmailSending(false);
      setEmailError(error.message);
      setOpportunityUpdating(false);
      setOpportunityError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Update GHL opportunity with contract signed data
  const updateOpportunityFields = async () => {
    if (!quote?.projectId) {
      console.warn('[SignatureScreen] No project ID found for opportunity update');
      return;
    }

    try {
      setOpportunityUpdating(true);
      setOpportunityError(null);

      const signedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit'
      });

      console.log('[SignatureScreen] Making project update request');
      
      // Update project with signed date using signatureService
      const updateResponse = await signatureService.updateProjectAfterSigning(
        quote.projectId,
        user.locationId,
        {
          signedDate: signedDate,
          status: 'won',
        }
      );

      console.log('[SignatureScreen] Project update response:', updateResponse);

      if (updateResponse) {
        setOpportunityUpdated(true);
        console.log('[SignatureScreen] Opportunity updated successfully');
        
        // Add note to project about the update
        await addProjectNote(
          `GHL opportunity updated: Contract signed on ${signedDate}. Custom fields synchronized with opportunity data.`
        );
      } else {
        throw new Error('Failed to update opportunity fields');
      }

    } catch (error) {
      console.error('[SignatureScreen] Failed to update opportunity:', error);
      console.error('[SignatureScreen] Error response:', error.response?.data);
      setOpportunityError(error.message);
      // Don't throw - email can still work even if opportunity update fails
    } finally {
      setOpportunityUpdating(false);
    }
  };

  // ✅ NEW: Add audit trail note to project
  const addProjectNote = async (noteText) => {
    if (!quote?.projectId) return;
    
    try {
      // Update project notes using projectService
      await projectService.update(
        quote.projectId,
        user.locationId,
        {
          notes: noteText,
        }
      );
      console.log('[SignatureScreen] Project note added successfully');
    } catch (error) {
      console.warn('[SignatureScreen] Failed to add project note:', error);
    }
  };

  const handleContinue = () => {
    if (quote?.project?._id) {
      navigation.navigate('ProjectDetailScreen', { project: quote.project });
    } else {
      navigation.navigate('Projects');
    }
  };

  // Add card payment handler
  const handleCardPayment = async () => {
    try {
      setLoading(true);
      
      // Create payment link via payment service
      const response = await paymentService.createPaymentLink({
        projectId: quote.projectId || quote.project?._id,
        quoteId: quote._id,
        contactId: quote.contactId || quote.contact?._id,
        locationId: user.locationId,
        amount: quote.depositAmount,
        description: `Deposit for ${quote.quoteNumber}`,
        type: 'deposit',
        userId: user._id
      });
      
      if (response.success && response.paymentUrl) {
        // Navigate to payment WebView
        navigation.navigate('PaymentWebView', {
          paymentUrl: response.paymentUrl,
          paymentId: response.paymentId,
          amount: response.amount,
          onSuccess: () => {
            // Payment completed successfully
            if (quote.project) {
              navigation.navigate('ProjectDetailScreen', { 
                project: quote.project 
              });
            } else {
              navigation.navigate('Projects');
            }
          },
          onCancel: () => {
            // Payment was cancelled
            Alert.alert('Payment Cancelled', 'The payment was not completed.');
          }
        });
      } else {
        throw new Error('Failed to create payment link');
      }
      
    } catch (error) {
      console.error('[SignatureScreen] Failed to create payment link:', error);
      Alert.alert('Error', 'Failed to create payment link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle payment method selection
  const handlePaymentMethodSelect = async (method: string) => {
    setSelectedPaymentMethod(method);
    setSavingPaymentPreference(true);
    
    try {
      // Save payment preference to project
      const projectId = quote.projectId || quote.project?._id;
      
      if (projectId) {
        await projectService.update(
          projectId,
          user.locationId,
          {
            paymentPreference: method,
            depositExpected: quote.depositAmount > 0,
            depositAmount: quote.depositAmount || 0
          }
        );
      }
      
      console.log('Payment preference saved:', method);
      
      if (method === 'card') {
        // Existing card payment flow
        await handleCardPayment();
      } else if (method === 'check' || method === 'cash') {
        // Create invoice using payment service
        const response = await paymentService.createPaymentLink({
          projectId: quote.projectId || quote.project?._id,
          quoteId: quote._id,
          contactId: quote.contactId || quote.contact?._id,
          locationId: user.locationId,
          amount: quote.depositAmount,
          description: `Deposit for ${quote.quoteNumber}`,
          type: 'deposit',
          userId: user._id
        });
        
        if (response.success) {
          // Handle both new and existing invoices
          console.log('Invoice response:', response);
          
          // Extract the GHL invoice ID from the URL if not provided directly
          let ghlInvoiceId = response.ghlInvoiceId;
          if (!ghlInvoiceId && response.paymentUrl) {
            // Extract from URL: https://updates.leadprospecting.ai/invoice/[ID]
            const match = response.paymentUrl.match(/\/invoice\/([a-f0-9]+)$/);
            if (match) {
              ghlInvoiceId = match[1];
            }
          }
          
          // Store invoice info for photo capture
          setManualPaymentId(response.paymentId);
          setManualInvoiceId(ghlInvoiceId);
          setShowPhotoModal(true);
        } else {
          throw new Error(response.error || 'Failed to create invoice');
        }
      }
      
    } catch (error) {
      console.error('Failed to process payment:', error);
      Alert.alert('Error', error.message || 'Failed to process payment selection');
    } finally {
      setSavingPaymentPreference(false);
    }
  };

  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      {STEPS.map((step, index) => (
        <View key={step.id} style={styles.stepContainer}>
          <View style={[
            styles.stepCircle,
            currentStep >= step.id && styles.stepCircleActive,
            { borderColor: template?.styling?.primaryColor || '#2E86AB' }
          ]}>
            <Ionicons 
              name={step.icon as any} 
              size={20} 
              color={currentStep >= step.id ? '#fff' : (template?.styling?.primaryColor || '#2E86AB')}
            />
          </View>
          <Text style={[
            styles.stepLabel,
            currentStep >= step.id && styles.stepLabelActive
          ]}>
            {step.title}
          </Text>
          {index < STEPS.length - 1 && (
            <View style={[
              styles.stepLine,
              currentStep > step.id && styles.stepLineActive,
              { backgroundColor: template?.styling?.primaryColor || '#2E86AB' }
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderReviewStep = () => {
    const variables = buildVariables();
    const termsText = companyData.termsAndConditions || 
      "By signing this agreement, both parties agree to the terms and conditions outlined in this proposal.";

    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Quote Summary</Text>
          <Text style={styles.reviewSubtitle}>Please review before signing</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Quote Number:</Text>
            <Text style={styles.summaryValue}>{quote?.quoteNumber}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customer:</Text>
            <Text style={styles.summaryValue}>{variables.customerName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Project:</Text>
            <Text style={styles.summaryValue}>{variables.projectTitle}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={[styles.totalValue, { color: template?.styling?.primaryColor || '#2E86AB' }]}>
              {variables.totalAmount}
            </Text>
          </View>
        </View>

        <View style={styles.termsCard}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsText}>
            {replaceVariables(termsText, variables)}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.proceedButton, { backgroundColor: template?.styling?.primaryColor || '#2E86AB' }]}
          onPress={() => setCurrentStep(2)}
        >
          <Text style={styles.proceedButtonText}>Proceed to Signing</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderSignatureStep = (isConsultant = true) => {
    const title = isConsultant ? 'Consultant Signature' : 'Customer Signature';
    const subtitle = isConsultant 
      ? 'Please sign to approve this quote'
      : 'Please sign to accept this agreement';

    return (
      <View style={styles.stepContent}>
        <View style={styles.signatureHeader}>
          <Text style={styles.signatureTitle}>{title}</Text>
          <Text style={styles.signatureSubtitle}>{subtitle}</Text>
        </View>

        <SignatureCanvas
          onSignatureComplete={isConsultant ? handleConsultantSignature : handleCustomerSignature}
          signerName={isConsultant ? user?.name || 'Consultant' : quote?.customerName || 'Customer'}
          signerRole={isConsultant ? 'Consultant' : 'Customer'}
          confirmButtonText={isConsultant ? "Approve Quote" : "Accept Agreement"}
          confirmButtonColor={template?.styling?.primaryColor || '#2E86AB'}
          disabled={false}
        />
      </View>
    );
  };

  // ✅ UPDATED: Complete step with opportunity and email status
  const renderCompleteStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.completeContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color="#27ae60" />
        </View>
        
        <Text style={styles.successTitle}>Let's Get to Work!</Text>
        <Text style={styles.successSubtitle}>
          Your agreement has been signed and is ready to go.
        </Text>

        <View style={styles.completedItems}>
          <View style={styles.completedItem}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#27ae60" />
            <Text style={styles.completedText}>Consultant signature captured</Text>
          </View>
          <View style={styles.completedItem}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#27ae60" />
            <Text style={styles.completedText}>Customer signature captured</Text>
          </View>
          <View style={styles.completedItem}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#27ae60" />
            <Text style={styles.completedText}>Professional contract generated</Text>
          </View>
          
          {/* ✅ NEW: Opportunity update status */}
          <View style={styles.completedItem}>
            {opportunityUpdating ? (
              <>
                <ActivityIndicator size="small" color="#f39c12" />
                <Text style={[styles.completedText, { color: '#f39c12' }]}>Updating opportunity...</Text>
              </>
            ) : opportunityUpdated ? (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color="#27ae60" />
                <Text style={styles.completedText}>Project Updating</Text>
              </>
            ) : opportunityError ? (
              <>
                <Ionicons name="warning-outline" size={24} color="#e74c3c" />
                <Text style={[styles.completedText, { color: '#e74c3c' }]}>Opportunity sync failed</Text>
              </>
            ) : (
              <>
                <Ionicons name="sync-outline" size={24} color="#6b7280" />
                <Text style={[styles.completedText, { color: '#6b7280' }]}>Processing opportunity...</Text>
              </>
            )}
          </View>
          
          {/* Email status indicator */}
          <View style={styles.completedItem}>
            {emailSending ? (
              <>
                <ActivityIndicator size="small" color="#f39c12" />
                <Text style={[styles.completedText, { color: '#f39c12' }]}>Sending contract email...</Text>
              </>
            ) : emailSent ? (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color="#27ae60" />
                <Text style={styles.completedText}>Contract emailed to customer</Text>
              </>
            ) : emailError ? (
              <>
                <Ionicons name="warning-outline" size={24} color="#e74c3c" />
                <Text style={[styles.completedText, { color: '#e74c3c' }]}>Email failed - will retry later</Text>
              </>
            ) : (
              <>
                <Ionicons name="mail-outline" size={24} color="#6b7280" />
                <Text style={[styles.completedText, { color: '#6b7280' }]}>Processing email...</Text>
              </>
            )}
          </View>
        </View>

        {/* Conditionally show either What's Next or Payment Card/Options */}
        {quote?.depositAmount > 0 ? (
          // Has deposit requirement
          <>
            {!showPaymentOptions && !selectedPaymentMethod ? (
              // Show payment required card
              <TouchableOpacity 
                style={styles.paymentRequiredCard}
                onPress={() => setShowPaymentOptions(true)}
                activeOpacity={0.9}
              >
                <View style={styles.paymentCardHeader}>
                  <View style={styles.paymentCardMain}>
                    <Text style={styles.paymentCardAmount}>${quote.depositAmount.toFixed(2)} Deposit Required</Text>
                    <Text style={styles.paymentCardSubtext}>Select payment method to continue</Text>
                  </View>
                  <Ionicons name="card-outline" size={32} color={template?.styling?.primaryColor || '#2E86AB'} />
                </View>
              </TouchableOpacity>
            ) : showPaymentOptions ? (
              // Show payment options
              <View style={styles.paymentOptionsContainer}>
                <Text style={styles.paymentOptionsTitle}>
                  How would you like to collect the ${quote.depositAmount.toFixed(2)} deposit?
                </Text>
                
                <TouchableOpacity 
                  style={[
                    styles.paymentOption,
                    selectedPaymentMethod === 'card' && styles.selectedPaymentOption
                  ]}
                  onPress={() => handlePaymentMethodSelect('card')}
                  disabled={savingPaymentPreference}
                >
                  <Ionicons name="card-outline" size={24} color="#2E86AB" />
                  <Text style={styles.paymentOptionText}>Pay with Card</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.paymentOption,
                    selectedPaymentMethod === 'check' && styles.selectedPaymentOption
                  ]}
                  onPress={() => handlePaymentMethodSelect('check')}
                  disabled={savingPaymentPreference}
                >
                  <Ionicons name="document-text-outline" size={24} color="#2E86AB" />
                  <Text style={styles.paymentOptionText}>Pay by Check</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.paymentOption,
                    selectedPaymentMethod === 'cash' && styles.selectedPaymentOption
                  ]}
                  onPress={() => handlePaymentMethodSelect('cash')}
                  disabled={savingPaymentPreference}
                >
                  <Ionicons name="cash-outline" size={24} color="#2E86AB" />
                  <Text style={styles.paymentOptionText}>Pay with Cash</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Payment method selected, show What's Next
              <View style={styles.nextSteps}>
                <Text style={styles.nextStepsTitle}>What's Next?</Text>
                <Text style={styles.nextStepsText}>
                  {emailSent 
                    ? `Your customer will receive a copy of the signed contract via email. ${opportunityUpdated ? 'The project details have been synchronized with your CRM. ' : ''}You can now begin work on ${quote?.projectTitle || 'the project'}.`
                    : `The signed contract is ready and will be emailed to your customer. ${opportunityUpdated ? 'Project details have been updated in your CRM. ' : ''}You can now begin work on ${quote?.projectTitle || 'the project'}.`
                  }
                </Text>
              </View>
            )}
          </>
        ) : (
          // No deposit required - show What's Next
          <View style={styles.nextSteps}>
            <Text style={styles.nextStepsTitle}>What's Next?</Text>
            <Text style={styles.nextStepsText}>
              {emailSent 
                ? `Your customer will receive a copy of the signed contract via email. ${opportunityUpdated ? 'The project details have been synchronized with your CRM. ' : ''}You can now begin work on ${quote?.projectTitle || 'the project'}.`
                : `The signed contract is ready and will be emailed to your customer. ${opportunityUpdated ? 'Project details have been updated in your CRM. ' : ''}You can now begin work on ${quote?.projectTitle || 'the project'}.`
              }
            </Text>
          </View>
        )}

        {/* Continue button - show when no deposit required OR payment method selected */}
        {(!quote?.depositAmount || selectedPaymentMethod) && (
          <TouchableOpacity 
            style={[styles.continueButton, { backgroundColor: template?.styling?.primaryColor || '#2E86AB' }]}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue to Project</Text>
          </TouchableOpacity>
        )}

        {/* ADD THE PHOTO CAPTURE MODAL HERE */}
        {showPhotoModal && (
          <PhotoCaptureModal
            visible={showPhotoModal}
            onClose={() => setShowPhotoModal(false)}
            paymentId={manualPaymentId}
            invoiceId={manualInvoiceId}
            paymentMethod={selectedPaymentMethod}
            amount={quote.depositAmount}
            locationId={user.locationId}
            onSuccess={() => {
              setShowPhotoModal(false);
              if (quote.project) {
                navigation.navigate('ProjectDetailScreen', { 
                  project: quote.project 
                });
              } else {
                navigation.navigate('Projects');
              }
            }}
          />
        )}
      </View>
    </ScrollView>
  );

  if (loading && currentStep !== 4) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={template?.styling?.primaryColor || '#2E86AB'} />
          <Text style={styles.loadingText}>Processing signatures...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: template?.styling?.primaryColor || '#2E86AB' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Digital Signature</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Step Content */}
      <View style={styles.content}>
        {currentStep === 1 && renderReviewStep()}
        {currentStep === 2 && renderSignatureStep(true)}
        {currentStep === 3 && renderSignatureStep(false)}
        {currentStep === 4 && renderCompleteStep()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: FONT.input,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: FONT.sectionTitle,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  stepCircleActive: {
    backgroundColor: '#2E86AB',
  },
  stepLabel: {
    fontSize: FONT.meta,
    color: '#6b7280',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#2E86AB',
    fontWeight: '600',
  },
  stepLine: {
    position: 'absolute',
    top: 20,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: '#e5e7eb',
    zIndex: -1,
  },
  stepLineActive: {
    backgroundColor: '#2E86AB',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  
  // Review Step Styles
  reviewHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  reviewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  reviewSubtitle: {
    fontSize: FONT.input,
    color: '#6b7280',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    padding: 20,
    marginBottom: 20,
    ...SHADOW.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: FONT.input,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: FONT.input,
    fontWeight: '500',
    color: '#1f2937',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  termsCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    padding: 20,
    marginBottom: 20,
    ...SHADOW.card,
  },
  termsTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  termsText: {
    fontSize: FONT.meta,
    color: '#6b7280',
    lineHeight: 20,
  },
  proceedButton: {
    backgroundColor: '#2E86AB',
    borderRadius: RADIUS.button,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  proceedButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
  
  // Signature Step Styles
  signatureHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  signatureTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  signatureSubtitle: {
    fontSize: FONT.input,
    color: '#6b7280',
  },
  
  // Complete Step Styles
  completeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: FONT.input,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  completedItems: {
    width: '100%',
    marginBottom: 30,
  },
  completedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  completedText: {
    fontSize: FONT.input,
    color: '#1f2937',
    marginLeft: 12,
  },
  nextSteps: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    padding: 20,
    marginBottom: 30,
    width: '100%',
    ...SHADOW.card,
  },
  nextStepsTitle: {
    fontSize: FONT.input,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  nextStepsText: {
    fontSize: FONT.input,
    color: '#6b7280',
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: '#2E86AB',
    borderRadius: RADIUS.button,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: FONT.input,
    fontWeight: '600',
  },
  paymentOptionsContainer: {
    marginVertical: 20,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  paymentOptionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedPaymentOption: {
    borderColor: '#2E86AB',
    backgroundColor: '#f0f8ff',
  },
  paymentOptionText: {
    marginLeft: 10,
    fontSize: 16,
  },
  // Add these to the styles object:
  paymentRequiredCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    padding: 20,
    marginBottom: 30,
    width: '100%',
    ...SHADOW.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentCardMain: {
    flex: 1,
    paddingRight: 16,
  },
  paymentCardAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  paymentCardSubtext: {
    fontSize: FONT.input,
    color: '#6b7280',
  },
});