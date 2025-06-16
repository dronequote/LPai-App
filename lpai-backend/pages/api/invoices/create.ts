// /api/invoices/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { createInvoiceSchema } from '../../../schemas/invoice.schema'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    try {
      const data = await createInvoiceSchema.validate(req.body, {
        abortEarly: false,
      });
  
      const client = await clientPromise;
      const db = client.db('lpai');
  
      const invoice = {
        _id: new ObjectId(),
        ...data,
        invoiceNumber: generateInvoiceNumber(),
        createdAt: new Date(),
        createdBy: ''
      };
  
      await db.collection('invoices').insertOne(invoice);
      return res.status(201).json({ success: true, invoice });
    } catch (err: any) {
      console.error('Validation failed', err);
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
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
        Authorization: `Bearer ${location?.ghlOAuth?.accessToken}`,
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
        Authorization: `Bearer ${location?.ghlOAuth?.accessToken}`,
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