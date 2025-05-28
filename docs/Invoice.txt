1. Update Signature Screen - Add Payment Preference Step
After the success checkmarks, add a payment preference section:
javascript// In SignatureScreen.tsx, update the renderCompleteStep function:

const [showPaymentOptions, setShowPaymentOptions] = useState(false);
const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
const [savingPaymentPreference, setSavingPaymentPreference] = useState(false);

const handlePaymentMethodSelect = async (method) => {
  setSelectedPaymentMethod(method);
  setSavingPaymentPreference(true);
  
  try {
    // Save payment preference to project
    await api.patch(`/api/projects/${quote.projectId}?locationId=${user.locationId}`, {
      paymentPreference: method,
      depositExpected: quote.depositAmount > 0,
      depositAmount: quote.depositAmount || 0
    });
    
    console.log('Payment preference saved:', method);
  } catch (error) {
    console.error('Failed to save payment preference:', error);
  } finally {
    setSavingPaymentPreference(false);
  }
};

// In the renderCompleteStep, after the completed items:

{/* Payment Preference Section */}
{!showPaymentOptions && quote?.depositAmount > 0 && (
  <TouchableOpacity 
    style={[styles.paymentButton, { backgroundColor: template?.styling?.primaryColor || '#2E86AB' }]}
    onPress={() => setShowPaymentOptions(true)}
  >
    <Ionicons name="card-outline" size={24} color="#fff" />
    <Text style={styles.paymentButtonText}>
      Select Payment Method for ${quote.depositAmount} Deposit
    </Text>
  </TouchableOpacity>
)}

{showPaymentOptions && (
  <View style={styles.paymentOptionsContainer}>
    <Text style={styles.paymentOptionsTitle}>How would you like to pay the deposit?</Text>
    <Text style={styles.depositAmount}>${quote.depositAmount}</Text>
    
    <TouchableOpacity 
      style={[styles.paymentOption, selectedPaymentMethod === 'card' && styles.selectedOption]}
      onPress={() => handlePaymentMethodSelect('card')}
      disabled={savingPaymentPreference}
    >
      <Ionicons name="card-outline" size={32} color={template?.styling?.primaryColor || '#2E86AB'} />
      <Text style={styles.paymentOptionTitle}>Pay with Card</Text>
      <Text style={styles.paymentOptionSubtitle}>Quick & Secure</Text>
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[styles.paymentOption, selectedPaymentMethod === 'check' && styles.selectedOption]}
      onPress={() => handlePaymentMethodSelect('check')}
      disabled={savingPaymentPreference}
    >
      <Ionicons name="document-text-outline" size={32} color={template?.styling?.primaryColor || '#2E86AB'} />
      <Text style={styles.paymentOptionTitle}>Pay by Check</Text>
      <Text style={styles.paymentOptionSubtitle}>We'll collect later</Text>
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[styles.paymentOption, selectedPaymentMethod === 'cash' && styles.selectedOption]}
      onPress={() => handlePaymentMethodSelect('cash')}
      disabled={savingPaymentPreference}
    >
      <Ionicons name="cash-outline" size={32} color={template?.styling?.primaryColor || '#2E86AB'} />
      <Text style={styles.paymentOptionTitle}>Pay with Cash</Text>
      <Text style={styles.paymentOptionSubtitle}>We'll collect later</Text>
    </TouchableOpacity>
  </View>
)}
2. Update Quote Schema for Flexible Deposits
In your quote creation/editing:
javascript// Quote schema update
{
  // ... existing fields
  depositAmount: Number,        // Calculated amount
  depositType: 'percentage' | 'fixed',
  depositValue: Number,         // Either % (like 50) or fixed $ amount
  paymentTerms: String,
  
  // Calculate deposit amount
  getDepositAmount() {
    if (this.depositType === 'percentage') {
      return (this.total * this.depositValue) / 100;
    }
    return this.depositValue || 0;
  }
}
3. Project Details - Invoice Creation
For the Invoice button on Project Details, create a modal/screen:
javascript// InvoiceCreationModal.tsx
const InvoiceCreationModal = ({ project, isVisible, onClose }) => {
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [amountType, setAmountType] = useState('percentage'); // or 'fixed'
  const [amountValue, setAmountValue] = useState('');
  const [creating, setCreating] = useState(false);

  const calculateAmount = () => {
    if (amountType === 'percentage') {
      return (project.totalAmount * parseFloat(amountValue)) / 100;
    }
    return parseFloat(amountValue);
  };

  const handleCreateInvoice = async () => {
    setCreating(true);
    
    try {
      const amount = calculateAmount();
      
      // Create invoice in your system
      const invoice = await api.post('/api/invoices/create', {
        projectId: project._id,
        locationId: project.locationId,
        title: invoiceTitle,
        amount: amount,
        type: 'progress',
        amountType: amountType,
        amountValue: parseFloat(amountValue)
      });

      // Create GHL product and payment link
      const paymentLink = await api.post('/api/payments/create-link', {
        invoiceId: invoice._id,
        amount: amount,
        description: invoiceTitle,
        contactId: project.contactId,
        opportunityId: project.ghlOpportunityId
      });

      console.log('Invoice created with payment link:', paymentLink.url);
      onClose(invoice);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Invoice</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.label}>Invoice Title</Text>
          <TextInput
            style={styles.input}
            value={invoiceTitle}
            onChangeText={setInvoiceTitle}
            placeholder="e.g., Progress Payment 1"
          />

          <Text style={styles.label}>Amount Type</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggle, amountType === 'percentage' && styles.activeToggle]}
              onPress={() => setAmountType('percentage')}
            >
              <Text>Percentage %</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggle, amountType === 'fixed' && styles.activeToggle]}
              onPress={() => setAmountType('fixed')}
            >
              <Text>Fixed Amount $</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            {amountType === 'percentage' ? 'Percentage of Total' : 'Amount'}
          </Text>
          <TextInput
            style={styles.input}
            value={amountValue}
            onChangeText={setAmountValue}
            keyboardType="numeric"
            placeholder={amountType === 'percentage' ? "30" : "1500"}
          />

          {amountValue && (
            <Text style={styles.preview}>
              Invoice Amount: ${calculateAmount().toFixed(2)}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.createButton, !invoiceTitle && styles.disabledButton]}
            onPress={handleCreateInvoice}
            disabled={!invoiceTitle || !amountValue || creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Invoice</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
4. API Endpoints
javascript// /api/invoices/create.ts
export default async function handler(req, res) {
  const { projectId, locationId, title, amount, type, amountType, amountValue } = req.body;
  
  const invoice = {
    _id: new ObjectId(),
    projectId,
    locationId,
    invoiceNumber: generateInvoiceNumber(), // INV-2025-XXX
    title,
    amount,
    type, // 'deposit', 'progress', 'final'
    amountType, // 'percentage', 'fixed'
    amountValue,
    status: 'pending',
    createdAt: new Date(),
    createdBy: req.user._id
  };
  
  await db.collection('invoices').insertOne(invoice);
  
  return res.json({ success: true, invoice });
}

// /api/payments/create-link.ts
export default async function handler(req, res) {
  const { invoiceId, amount, description, contactId, opportunityId } = req.body;
  
  // Get GHL API key
  const location = await db.collection('locations').findOne({ locationId });
  
  // Create product in GHL
  const product = await axios.post(
    'https://services.leadconnectorhq.com/products',
    {
      name: description,
      price: amount,
      currency: 'USD'
    },
    {
      headers: {
        Authorization: `Bearer ${location.apiKey}`,
        Version: '2021-07-28'
      }
    }
  );
  
  // Create payment link
  const paymentLink = await axios.post(
    'https://services.leadconnectorhq.com/payments/orders',
    {
      contactId: contactId,
      currency: 'USD',
      amount: amount * 100, // Convert to cents
      items: [{
        productId: product.data.id,
        quantity: 1
      }]
    },
    {
      headers: {
        Authorization: `Bearer ${location.apiKey}`,
        Version: '2021-07-28'
      }
    }
  );
  
  // Save payment record
  await db.collection('payments').insertOne({
    invoiceId,
    ghlProductId: product.data.id,
    ghlPaymentLinkId: paymentLink.data.id,
    url: paymentLink.data.url,
    amount,
    status: 'pending',
    createdAt: new Date()
  });
  
  return res.json({ 
    success: true, 
    url: paymentLink.data.url 
  });
}