// InvoiceCreationModal.tsx
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