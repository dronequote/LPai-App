// pages/api/payments/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid payment ID' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getPayment(db, id, req.query, res);
    case 'PATCH':
      return await updatePayment(db, id, req.body, res);
    default:
      res.setHeader('Allow', ['GET', 'PATCH']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// GET: Fetch payment details
async function getPayment(db: any, id: string, query: any, res: NextApiResponse) {
  try {
    const { locationId } = query;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID format' });
    }
    
    const payment = await db.collection('payments').findOne({
      _id: new ObjectId(id),
      locationId
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    console.log(`[Payment API] Retrieved payment ${id}`);
    return res.status(200).json(payment);
    
  } catch (error) {
    console.error('[Payment API] Error fetching payment:', error);
    return res.status(500).json({ error: 'Failed to fetch payment' });
  }
}

// PATCH: Update payment status
async function updatePayment(db: any, id: string, body: any, res: NextApiResponse) {
  try {
    const { locationId, status, completedAt, failureReason, ghlTransactionId } = body;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID format' });
    }
    
    // Get existing payment
    const existingPayment = await db.collection('payments').findOne({
      _id: new ObjectId(id),
      locationId
    });
    
    if (!existingPayment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    console.log(`[Payment API] Updating payment ${id} status from ${existingPayment.status} to ${status}`);
    
    // Build update object
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (status) updateData.status = status;
    if (completedAt) updateData.completedAt = new Date(completedAt);
    if (failureReason) updateData.failureReason = failureReason;
    if (ghlTransactionId) updateData.ghlTransactionId = ghlTransactionId;
    
    // Update payment
    const result = await db.collection('payments').updateOne(
      { _id: new ObjectId(id), locationId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // If payment is completed, update related records
    if (status === 'completed' && existingPayment.status !== 'completed') {
      console.log('[Payment API] Payment completed, updating related records...');
      
      // Update project timeline
      if (existingPayment.projectId) {
        await db.collection('projects').updateOne(
          { _id: new ObjectId(existingPayment.projectId) },
          {
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: 'payment_completed',
                description: `${existingPayment.type} payment of $${existingPayment.amount} completed`,
                timestamp: new Date().toISOString(),
                userId: 'system',
                metadata: {
                  paymentId: id,
                  amount: existingPayment.amount,
                  type: existingPayment.type,
                  method: existingPayment.method
                }
              }
            }
          }
        );
      }
      
      // Update quote activity
      if (existingPayment.quoteId) {
        await db.collection('quotes').updateOne(
          { _id: new ObjectId(existingPayment.quoteId) },
          {
            $push: {
              activityFeed: {
                id: new ObjectId().toString(),
                action: 'payment_completed',
                timestamp: new Date().toISOString(),
                metadata: {
                  paymentId: id,
                  amount: existingPayment.amount,
                  type: existingPayment.type,
                  method: existingPayment.method
                }
              }
            }
          }
        );
        
        // If this was a deposit payment, update quote status
        if (existingPayment.type === 'deposit') {
          await db.collection('quotes').updateOne(
            { _id: new ObjectId(existingPayment.quoteId) },
            { 
              $set: { 
                status: 'paid',
                paidAt: new Date().toISOString()
              } 
            }
          );
        }
      }
      
      // Check if there's an invoice associated
      if (existingPayment.invoiceId) {
        // Get invoice to check total payments
        const invoice = await db.collection('invoices').findOne({
          _id: new ObjectId(existingPayment.invoiceId)
        });
        
        if (invoice) {
          // Calculate total paid for this invoice
          const payments = await db.collection('payments').find({
            invoiceId: new ObjectId(existingPayment.invoiceId),
            status: 'completed'
          }).toArray();
          
          const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
          const balance = invoice.total - totalPaid;
          
          // Update invoice
          await db.collection('invoices').updateOne(
            { _id: new ObjectId(existingPayment.invoiceId) },
            {
              $set: {
                amountPaid: totalPaid,
                balance: balance,
                status: balance <= 0 ? 'paid' : 'partial',
                ...(balance <= 0 && { paidAt: new Date() })
              },
              $addToSet: {
                payments: new ObjectId(id)
              }
            }
          );
        }
      }
    }
    
    console.log(`[Payment API] Successfully updated payment ${id}`);
    return res.status(200).json({ 
      success: true,
      message: 'Payment updated successfully'
    });
    
  } catch (error) {
    console.error('[Payment API] Error updating payment:', error);
    return res.status(500).json({ error: 'Failed to update payment' });
  }
}