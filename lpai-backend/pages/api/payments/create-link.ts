// pages/api/payments/create-link.ts - Updated with invoice sending and fixes
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
      projectId,
      quoteId,
      contactId,
      locationId,
      amount,
      description,
      type = 'deposit',
      userId
    } = req.body;

    console.log('[Payment Link API] Creating invoice for payment:', {
      projectId,
      quoteId,
      amount,
      type,
      description
    });

    // Validate required fields
    if (!projectId || !contactId || !locationId || !amount || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: projectId, contactId, locationId, amount, userId' 
      });
    }

    // Get location data for GHL API access
    const location = await db.collection('locations').findOne({ locationId });
    if (!location?.ghlOAuth?.accessToken) {
      return res.status(404).json({ error: 'Location not found or API key missing' });
    }

    // Get the user's GHL ID
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(userId),
      locationId 
    });

    if (!user?.ghlUserId) {
      return res.status(400).json({ error: 'User missing GHL ID' });
    }

    // Get contact for GHL ID
    const contact = await db.collection('contacts').findOne({ 
      _id: new ObjectId(contactId),
      locationId 
    });
    
    if (!contact?.ghlContactId) {
      return res.status(400).json({ error: 'Contact missing GHL ID' });
    }

    // Get project for naming
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      locationId
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // ========== ADD SAFETY CHECK HERE ==========
    // Check if a payment/invoice already exists for this quote
    if (quoteId) {
      const existingPayment = await db.collection('payments').findOne({
        quoteId: new ObjectId(quoteId),
        type: type,
        status: { $ne: 'failed' } // Ignore failed payments
      });
      
      if (existingPayment) {
        console.log('[Payment Link API] Payment already exists for this quote:', existingPayment._id);
        
        // Return the existing payment info
        return res.status(200).json({
          success: true,
          paymentId: existingPayment._id,
          paymentUrl: existingPayment.ghlInvoiceUrl,
          ghlInvoiceId: existingPayment.ghlInvoiceId, // ADD THIS
          amount: existingPayment.amount,
          invoiceNumber: existingPayment.ghlInvoiceNumber,
          message: 'Using existing invoice',
          existing: true
        });
      }
    }

    // Also check by project + type to prevent duplicates even without quoteId
    const recentPayment = await db.collection('payments').findOne({
      projectId: new ObjectId(projectId),
      type: type,
      status: { $ne: 'failed' },
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
    });

    if (recentPayment) {
      console.log('[Payment Link API] Recent payment found for this project:', recentPayment._id);
      
      return res.status(200).json({
        success: true,
        paymentId: recentPayment._id,
        paymentUrl: recentPayment.ghlInvoiceUrl,
        amount: recentPayment.amount,
        invoiceNumber: recentPayment.ghlInvoiceNumber,
        message: 'Using recent invoice',
        existing: true
      });
    }
    // ========== END OF SAFETY CHECK ==========

    // Generate unique invoice number using counter collection
    const counterKey = `${locationId}-${type}-invoice`;
    const counter = await db.collection('counters').findOneAndUpdate(
      { _id: counterKey },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    
    const invoiceNumber = counter.seq ? counter.seq.toString() : '1';
    console.log('[Payment Link API] Generated invoice number:', invoiceNumber, 'for counter:', counterKey);

    // Create invoice in GHL - EXACTLY matching the working API structure
    console.log('[Payment Link API] Creating GHL invoice...');
    
    const itemName = type === 'deposit' 
      ? 'Deposit'
      : type === 'progress'
      ? 'Progress Payment'
      : 'Final Payment';
    
    const invoicePayload = {
      altId: locationId,
      altType: 'location',
      name: `${itemName} - ${project.title}`,
      businessDetails: {
        name: location.name || 'Your Business',
        website: location.website || 'www.example.com'
      },
      currency: 'USD',
      items: [{
        name: itemName,
        description: `${itemName} for ${project.title}`,
        currency: 'USD',
        amount: Math.round(amount * 100) / 100, // Ensure exactly 2 decimals
        qty: 1
      }],
      discount: {
        value: 0,
        type: 'percentage'
      },
      contactDetails: {
        id: contact.ghlContactId,
        name: `${contact.firstName} ${contact.lastName}`,
        phoneNo: contact.phone || '',
        email: contact.email
      },
      invoiceNumber: invoiceNumber,
      issueDate: new Date().toISOString().split('T')[0], // Format: YYYY-MM-DD
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      sentTo: {
        email: [contact.email]
      },
      liveMode: true,
      invoiceNumberPrefix: type === 'deposit' ? 'DEP-' : 'INV-',
      paymentMethods: {
        stripe: {
          enableBankDebitOnly: false
        }
      }
    };

    console.log('[Payment Link API] Invoice payload:', JSON.stringify(invoicePayload, null, 2));
    
    // Log EXACT request for debugging
    console.log('[Payment Link API] EXACT GHL REQUEST:', {
      url: 'https://services.leadconnectorhq.com/invoices/',
      headers: {
        Authorization: `Bearer ${location.ghlOAuth.accessToken}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      data: invoicePayload
    });

    let invoice;
    try {
      const invoiceResponse = await axios.post(
        'https://services.leadconnectorhq.com/invoices/',
        invoicePayload,
        {
          headers: {
            Authorization: `Bearer ${location.ghlOAuth.accessToken}`,
            Version: '2021-07-28',
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        }
      );
      
      invoice = invoiceResponse.data;
      console.log('[Payment Link API] Invoice created successfully:', invoice._id);
      
    } catch (error: any) {
      console.error('[Payment Link API] Failed to create invoice:', error.response?.data);
      
      // If invoice number already exists, increment counter and retry once
      if (error.response?.data?.message?.includes('Invoice number already exists')) {
        console.log('[Payment Link API] Invoice number conflict, incrementing and retrying...');
        
        // Increment counter again
        const newCounter = await db.collection('counters').findOneAndUpdate(
          { _id: counterKey },
          { $inc: { seq: 1 } },
          { returnDocument: 'after' }
        );
        
        invoicePayload.invoiceNumber = newCounter.seq.toString();
        
        try {
          const retryResponse = await axios.post(
            'https://services.leadconnectorhq.com/invoices/',
            invoicePayload,
            {
              headers: {
                Authorization: `Bearer ${location.ghlOAuth.accessToken}`,
                Version: '2021-07-28',
                'Content-Type': 'application/json',
                Accept: 'application/json'
              }
            }
          );
          
          invoice = retryResponse.data;
          console.log('[Payment Link API] Invoice created successfully on retry:', invoice._id);
          
        } catch (retryError: any) {
          console.error('[Payment Link API] Failed to create invoice on retry:', retryError.response?.data);
          return res.status(500).json({ 
            error: 'Failed to create invoice after retry',
            details: retryError.response?.data 
          });
        }
      } else {
        return res.status(500).json({ 
          error: 'Failed to create invoice',
          details: error.response?.data 
        });
      }
    }

    // Now send the invoice to make it payable
    console.log('[Payment Link API] Sending invoice to make it payable...');

    try {
      const sendPayload = {
        altId: locationId,
        altType: 'location',
        userId: user.ghlUserId,
        action: 'send_manually',
        liveMode: true,
        autoPayment: {
          enable: false
        }
      };

      const sendResponse = await axios.post(
        `https://services.leadconnectorhq.com/invoices/${invoice._id}/send`,
        sendPayload,
        {
          headers: {
            Authorization: `Bearer ${location.ghlOAuth.accessToken}`,
            Version: '2021-07-28',
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        }
      );

      console.log('[Payment Link API] Invoice sent successfully:', sendResponse.data);
      
    } catch (sendError: any) {
      console.error('[Payment Link API] Failed to send invoice:', sendError.response?.data);
      // Don't fail completely - invoice exists, just not sent
      console.warn('[Payment Link API] Invoice created but not sent, continuing...');
    }

    // Create payment record in MongoDB
    const paymentRecord = {
      _id: new ObjectId(),
      projectId: new ObjectId(projectId),
      quoteId: quoteId ? new ObjectId(quoteId) : undefined,
      contactId: new ObjectId(contactId),
      locationId,
      
      amount: Math.round(amount * 100) / 100, // Store with 2 decimals
      type,
      method: 'card',
      description: description || `${itemName} for ${project.title}`,
      
      status: 'pending',
      
      // GHL invoice references
      ghlInvoiceId: invoice._id,
      ghlInvoiceNumber: invoice.invoiceNumber,
      ghlInvoiceUrl: `https://updates.leadprospecting.ai/invoice/${invoice._id}`,
      
      createdAt: new Date(),
      createdBy: new ObjectId(userId)
    };

    await db.collection('payments').insertOne(paymentRecord);
    
    console.log('[Payment Link API] Payment record created:', paymentRecord._id);

    // Update quote activity and initialize payment summary
    if (quoteId) {
      // Get the quote to initialize payment summary if needed
      const quote = await db.collection('quotes').findOne({
        _id: new ObjectId(quoteId)
      });
      
      if (quote) {
        // Initialize payment summary if it doesn't exist
        if (!quote.paymentSummary) {
          await db.collection('quotes').updateOne(
            { _id: new ObjectId(quoteId) },
            {
              $set: {
                'paymentSummary': {
                  totalRequired: quote.total,
                  depositRequired: quote.depositAmount || 0,
                  depositPaid: 0,
                  totalPaid: 0,
                  balance: quote.total,
                  paymentIds: [],
                  lastPaymentAt: null
                }
              }
            }
          );
          console.log('[Payment Link API] Initialized payment summary on quote');
        }
        
        // Add activity
        await db.collection('quotes').updateOne(
          { _id: new ObjectId(quoteId) },
          {
            $push: {
              activityFeed: {
                id: new ObjectId().toString(),
                action: 'invoice_created',
                timestamp: new Date().toISOString(),
                userId,
                metadata: {
                  paymentId: paymentRecord._id.toString(),
                  invoiceId: invoice._id,
                  invoiceNumber: invoice.invoiceNumber,
                  amount: Math.round(amount * 100) / 100,
                  type
                }
              }
            }
          }
        );
      }
    }

    // Add to project timeline
    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      {
        $push: {
          timeline: {
            id: new ObjectId().toString(),
            event: 'invoice_created',
            description: `${itemName} invoice created for $${Math.round(amount * 100) / 100}`,
            timestamp: new Date().toISOString(),
            userId,
            metadata: {
              paymentId: paymentRecord._id.toString(),
              invoiceId: invoice._id,
              invoiceNumber: invoice.invoiceNumber,
              amount: Math.round(amount * 100) / 100,
              type
            }
          }
        }
      }
    );

    return res.status(200).json({
      success: true,
      paymentId: paymentRecord._id,
      paymentUrl: paymentRecord.ghlInvoiceUrl,
      amount: Math.round(amount * 100) / 100,
      invoiceNumber: invoice.invoiceNumber,
      message: 'Invoice created successfully'
    });

  } catch (error: any) {
    console.error('[Payment Link API] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Failed to create payment link',
      details: error.message 
    });
  }
}