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

    // Get the payment record to get project and quote info
    const paymentRecord = await db.collection('payments').findOne({
      ghlInvoiceId: invoiceId,
      locationId
    });

    if (!paymentRecord) {
      return res.status(404).json({ error: 'Payment record not found for this invoice' });
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

    // Now update the quote if there's a quoteId
    if (paymentRecord.quoteId) {
      const quote = await db.collection('quotes').findOne({
        _id: new ObjectId(paymentRecord.quoteId)
      });
      
      if (quote) {
        const isDeposit = paymentRecord.type === 'deposit';
        const currentPaid = quote.paymentSummary?.totalPaid || 0;
        const newTotalPaid = currentPaid + paymentRecord.amount;
        const balance = quote.total - newTotalPaid;
        
        // Initialize payment summary if it doesn't exist
        const paymentSummary = quote.paymentSummary || {
          totalRequired: quote.total,
          depositRequired: quote.depositAmount || 0,
          depositPaid: 0,
          totalPaid: 0,
          balance: quote.total,
          paymentIds: []
        };
        
        const updateData: any = {
          paymentSummary: {
            ...paymentSummary,
            totalPaid: newTotalPaid,
            balance: balance,
            lastPaymentAt: new Date()
          },
          updatedAt: new Date()
        };
        
        // If this is a deposit payment
        if (isDeposit) {
          updateData.paymentSummary.depositPaid = paymentRecord.amount;
          updateData.paymentSummary.depositPaidAt = new Date();
          updateData.status = 'deposit_paid';
        }
        
        // If fully paid
        if (balance <= 0) {
          updateData.status = 'paid';
          updateData.paidAt = new Date();
        }
        
        // Add payment ID to the array if not already there
        if (!updateData.paymentSummary.paymentIds) {
          updateData.paymentSummary.paymentIds = [];
        }
        if (!updateData.paymentSummary.paymentIds.includes(paymentRecord._id.toString())) {
          updateData.paymentSummary.paymentIds.push(paymentRecord._id);
        }
        
        await db.collection('quotes').updateOne(
          { _id: new ObjectId(paymentRecord.quoteId) },
          {
            $set: updateData,
            $push: {
              activityFeed: {
                id: new ObjectId().toString(),
                action: isDeposit ? 'deposit_payment_completed' : 'payment_completed',
                timestamp: new Date().toISOString(),
                userId,
                metadata: {
                  paymentId: paymentRecord._id.toString(),
                  amount: paymentRecord.amount,
                  type: paymentRecord.type,
                  method: mode,
                  checkNumber: mode === 'cheque' ? checkNumber : undefined,
                  balance: balance
                }
              }
            }
          }
        );
        
        console.log(`[Record Payment API] Updated quote ${paymentRecord.quoteId} with manual payment completion`);
      }
    }

    // Update the project if there's a projectId
    if (paymentRecord.projectId) {
      const isDeposit = paymentRecord.type === 'deposit';
      
      // Get current project to check payment status
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(paymentRecord.projectId)
      });
      
      if (project) {
        const projectUpdateData: any = {
          updatedAt: new Date()
        };
        
        // If this is a deposit payment
        if (isDeposit) {
          projectUpdateData.depositPaid = true;
          projectUpdateData.depositPaidAt = new Date();
          projectUpdateData.depositAmount = paymentRecord.amount;
          
          // Update status if needed
          if (project.status === 'won') {
            projectUpdateData.status = 'in_progress';
          }
        }
        
        await db.collection('projects').updateOne(
          { _id: new ObjectId(paymentRecord.projectId) },
          {
            $set: projectUpdateData,
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: isDeposit ? 'deposit_payment_completed' : 'payment_completed',
                description: `${paymentRecord.type} payment of $${paymentRecord.amount} completed (${mode})`,
                timestamp: new Date().toISOString(),
                userId,
                metadata: {
                  paymentId: paymentRecord._id.toString(),
                  amount: paymentRecord.amount,
                  type: paymentRecord.type,
                  method: mode,
                  checkNumber: mode === 'cheque' ? checkNumber : undefined
                }
              }
            }
          }
        );
        
        console.log(`[Record Payment API] Updated project ${paymentRecord.projectId} with manual payment completion`);
      }
    }

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