// pages/api/quotes/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper for environment-aware logging
const isDev = process.env.NODE_ENV === 'development';
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getQuotes(db, req.query, res);
    case 'POST':
      return await createQuote(db, req.body, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// 📋 GET: Fetch quotes with filters
async function getQuotes(db: any, query: any, res: NextApiResponse) {
  try {
    const { locationId, projectId, contactId, status, userId } = query;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    // Build filter query
    const filter: any = { locationId };
    if (projectId) filter.projectId = projectId;
    if (contactId) filter.contactId = contactId;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    
    log(`[QUOTES API] Fetching quotes with filter:`, filter);
    
    const quotes = await db.collection('quotes')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    
    // Enrich quotes with contact and project info
    const enrichedQuotes = await Promise.all(
      quotes.map(async (quote) => {
        try {
          // Fetch contact info
          const contact = await db.collection('contacts').findOne({ 
            _id: new ObjectId(quote.contactId) 
          });
          
          // Fetch project info
          const project = await db.collection('projects').findOne({ 
            _id: new ObjectId(quote.projectId) 
          });
          
          return {
            ...quote,
            contact,
            project,
            contactName: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact',
            projectTitle: project?.title || 'Unknown Project',
          };
        } catch (err) {
          log(`[QUOTES API] Failed to enrich quote ${quote._id}:`, err);
          return {
            ...quote,
            contactName: 'Unknown Contact',
            projectTitle: 'Unknown Project',
          };
        }
      })
    );
    
    log(`[QUOTES API] Found ${enrichedQuotes.length} quotes`);
    return res.status(200).json(enrichedQuotes);
    
  } catch (error) {
    console.error('[QUOTES API] Error fetching quotes:', error);
    return res.status(500).json({ error: 'Failed to fetch quotes' });
  }
}

// 🆕 POST: Create new quote
async function createQuote(db: any, body: any, res: NextApiResponse) {
  try {
    const {
      projectId,
      contactId,
      locationId,
      userId,
      title,
      sections = [],
      taxRate = 0,
      discountAmount = 0,
      discountPercentage = 0,
      termsAndConditions = '',
      paymentTerms = '',
      notes = '',
      validUntil,
      // ADD DEPOSIT FIELDS
      depositType = 'percentage',
      depositValue = 0,
      depositAmount = 0
    } = body;
    
    // Validate required fields
    if (!projectId || !contactId || !locationId || !userId || !title) {
      return res.status(400).json({ 
        error: 'Missing required fields: projectId, contactId, locationId, userId, title' 
      });
    }
    
    // Verify project and contact exist
    try {
      const project = await db.collection('projects').findOne({ 
        _id: new ObjectId(projectId),
        locationId 
      });
      
      const contact = await db.collection('contacts').findOne({ 
        _id: new ObjectId(contactId),
        locationId 
      });
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid projectId or contactId format' });
    }
    
    // Generate quote number
    const currentYear = new Date().getFullYear();
    const quoteCount = await db.collection('quotes').countDocuments({ 
      locationId,
      createdAt: { 
        $gte: new Date(`${currentYear}-01-01`),
        $lt: new Date(`${currentYear + 1}-01-01`)
      }
    });
    
    const quoteNumber = `Q-${currentYear}-${String(quoteCount + 1).padStart(3, '0')}`;
    
    // Calculate totals
    const sectionsWithTotals = sections.map((section: any) => {
      const lineItems = section.lineItems || [];
      const sectionSubtotal = lineItems.reduce((sum: number, item: any) => {
        return sum + (item.totalPrice || 0);
      }, 0);
      
      return {
        id: section.id || new ObjectId().toString(),
        name: section.name || 'Untitled Section',
        lineItems: lineItems.map((item: any) => ({
          id: item.id || new ObjectId().toString(),
          libraryItemId: item.libraryItemId,
          categoryId: item.categoryId,
          name: item.name || '',
          description: item.description || '',
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          totalPrice: parseFloat(item.totalPrice) || (parseFloat(item.quantity) * parseFloat(item.unitPrice)),
          unit: item.unit || 'each',
          sku: item.sku || '',
          isCustomItem: item.isCustomItem || false,
        })),
        subtotal: sectionSubtotal,
        isCollapsed: section.isCollapsed || false,
      };
    });
    
    const subtotal = sectionsWithTotals.reduce((sum, section) => sum + section.subtotal, 0);
    const discountTotal = discountPercentage > 0 
      ? subtotal * (discountPercentage / 100)
      : discountAmount || 0;
    const taxableAmount = subtotal - discountTotal;
    const taxAmount = taxableAmount * taxRate;
    const total = taxableAmount + taxAmount;
    
    // ADD: Calculate deposit amount if not provided
    let calculatedDepositAmount = depositAmount;
    if (depositType === 'percentage' && depositValue > 0) {
      calculatedDepositAmount = (total * depositValue) / 100;
    } else if (depositType === 'fixed' && depositValue > 0) {
      calculatedDepositAmount = depositValue;
    }
    
    const newQuote = {
      quoteNumber,
      projectId,
      contactId,
      locationId,
      userId,
      title,
      description: body.description || '',
      sections: sectionsWithTotals,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount: discountTotal,
      discountPercentage: discountPercentage || 0,
      total,
      // ADD DEPOSIT FIELDS
      depositType,
      depositValue,
      depositAmount: calculatedDepositAmount,
      // Initialize payment summary
      paymentSummary: {
        totalRequired: total,
        depositRequired: calculatedDepositAmount,
        depositPaid: 0,
        totalPaid: 0,
        balance: total,
        paymentIds: [],
        lastPaymentAt: null
      },
      status: 'draft' as const,
      version: 1,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      termsAndConditions,
      paymentTerms,
      notes,
      activityFeed: [{
        action: 'created',
        timestamp: new Date().toISOString(),
        userId,
        metadata: {
          quoteNumber,
          total,
          depositAmount: calculatedDepositAmount
        }
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const result = await db.collection('quotes').insertOne(newQuote);
    const createdQuote = { ...newQuote, _id: result.insertedId };
    
    // ✅ NEW: Update the project with the quote ID and timeline
    if (projectId) {
      try {
        await db.collection('projects').updateOne(
          { _id: new ObjectId(projectId) },
          { 
            $set: { 
              quoteId: result.insertedId.toString(),
              activeQuoteId: result.insertedId.toString(),
              hasQuote: true,
              updatedAt: new Date()
            },
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: 'quote_created',
                description: `Quote ${quoteNumber} created for $${total.toFixed(2)}`,
                timestamp: new Date().toISOString(),
                userId,
                metadata: {
                  quoteId: result.insertedId.toString(),
                  quoteNumber,
                  total,
                  depositAmount: calculatedDepositAmount
                }
              }
            }
          }
        );
        log(`[QUOTES API] Updated project ${projectId} with quote ID ${result.insertedId}`);
      } catch (err) {
        console.error(`[QUOTES API] Failed to update project with quote ID:`, err);
        // Don't fail the quote creation if this update fails
      }
    }
    
    log(`[QUOTES API] Created quote ${quoteNumber} for project ${projectId}`);
    return res.status(201).json(createdQuote);
    
  } catch (error) {
    console.error('[QUOTES API] Error creating quote:', error);
    return res.status(500).json({ error: 'Failed to create quote' });
  }
}