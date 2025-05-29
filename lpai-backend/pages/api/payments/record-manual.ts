// pages/api/payments/record-manual.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  try {
    const {
      invoiceId,
      locationId,
      amount,
      mode, // 'cash' or 'cheque'
      checkNumber,
      notes,
      userId
    } = req.body;

    // Get location for API key
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.apiKey) {
      return res.status(404).json({ error: 'Location not found or API key missing' });
    }

    // Get user's GHL ID
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(userId),
      locationId 
    });

    if (!user?.ghlUserId) {
      return res.status(400).json({ error: 'User missing GHL ID' });
    }

    // Record payment in GHL
    const paymentPayload = {
      altId: locationId,
      altType: 'location',
      mode: mode,
      card: mode === 'cash' ? { brand: 'string', last4: 'string' } : undefined,
      cheque: mode === 'cheque' ? {
        number: checkNumber || `CHK-${Date.now()}`,
      } : undefined,
      amount: Math.round(amount * 100) / 100,
      meta: {},
      paymentScheduleIds: []
    };

    console.log('[Record Payment API] Recording payment for invoice:', invoiceId);
    console.log('[Record Payment API] Payload:', JSON.stringify(paymentPayload, null, 2));

    const response = await axios.post(
      `https://services.leadconnectorhq.com/invoices/${invoiceId}/record-payment`,
      paymentPayload,
      {
        headers: {
          Authorization: `Bearer ${location.apiKey}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    console.log('[Record Payment API] Payment recorded successfully');

    // Update payment record in MongoDB
    const updateResult = await db.collection('payments').updateOne(
      { ghlInvoiceId: invoiceId },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          paymentMethod: mode,
          checkNumber: mode === 'cheque' ? checkNumber : undefined,
          ghlPaymentId: response.data._id,
          updatedAt: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      paymentId: response.data._id
    });

  } catch (error: any) {
    console.error('[Record Payment API] Error:', error.response?.data || error);
    return res.status(500).json({ 
      error: 'Failed to record payment',
      details: error.response?.data 
    });
  }
}