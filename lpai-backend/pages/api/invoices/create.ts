// /api/invoices/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

// @ts-ignore
export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db('lpai');
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
// @ts-ignore
export async function createPaymentLinkHandler(req, res) {    
    const client = await clientPromise;
    const db = client.db('lpai');
  const { invoiceId, amount, description, contactId, opportunityId } = req.body;
  const { locationId } = req.query;
  
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
        Authorization: `Bearer ${location?.apiKey}`,
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
        Authorization: `Bearer ${location?.apiKey}`,
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

function generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);

    return `INV-${year}-${random}`;
}