// /api/invoices/create.ts
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