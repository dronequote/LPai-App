// pages/api/quotes/[id]/create-revision.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { locationId, userId, revisionData, notifyCustomer = false } = req.body;

  // Validation
  if (!id || typeof id !== 'string' || !locationId || !userId) {
    return res.status(400).json({ 
      error: 'Missing required fields: id, locationId, userId' 
    });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    const quotesCollection = db.collection('quotes');

    // Find the original quote
    const originalQuote = await quotesCollection.findOne({
      _id: new ObjectId(id),
      locationId: locationId
    });

    if (!originalQuote) {
      return res.status(404).json({ error: 'Original quote not found' });
    }

    // Check if quote can be revised (must be published or viewed)
    const revisableStatuses = ['published', 'viewed'];
    if (!revisableStatuses.includes(originalQuote.status)) {
      return res.status(400).json({ 
        error: `Quote cannot be revised. Current status: ${originalQuote.status}. Only published or viewed quotes can be revised.` 
      });
    }

    const now = new Date().toISOString();

    // Determine next version number
    const nextVersion = (originalQuote.version || 1) + 1;

    // Generate new quote number for revision
    const revisionQuoteNumber = `${originalQuote.quoteNumber}-R${nextVersion}`;

    // Create revision quote (starts as draft)
    const revisionQuote = {
      ...originalQuote,
      _id: new ObjectId(), // New ID
      quoteNumber: revisionQuoteNumber,
      version: nextVersion,
      parentQuoteId: originalQuote._id.toString(),
      status: 'published', // Revision inherits published status with same link
      
      // Inherit publication data from original (keep same web link)
      publishedAt: originalQuote.publishedAt,
      publishedBy: originalQuote.publishedBy,
      viewedAt: originalQuote.viewedAt,
      lastViewedAt: originalQuote.lastViewedAt,
      webLinkToken: originalQuote.webLinkToken, // SAME WEB LINK!
      webLinkExpiry: originalQuote.webLinkExpiry,
      
      // Clear signature data
      signatures: null,
      signedPdfUrl: null,
      
      // Update with revision data if provided
      ...revisionData,
      
      // Reset timestamps
      createdAt: now,
      updatedAt: now,
      
      // Create activity feed for revision
      activityFeed: [{
        id: crypto.randomUUID(),
        action: 'revised',
        timestamp: now,
        userId: userId,
        metadata: {
          originalQuoteId: originalQuote._id.toString(),
          originalQuoteNumber: originalQuote.quoteNumber,
          version: nextVersion,
          notifyCustomer: notifyCustomer
        }
      }]
    };

    // Insert revision quote
    const insertResult = await quotesCollection.insertOne(revisionQuote);

    if (!insertResult.insertedId) {
      return res.status(500).json({ error: 'Failed to create revision quote' });
    }

    // Update original quote to point to the new revision
    // The original web link will now resolve to the revision
    const originalUpdateResult = await quotesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'superseded',
          supersededBy: insertResult.insertedId.toString(), // Points to active revision
          updatedAt: now
        },
        $push: {
          activityFeed: {
            id: crypto.randomUUID(),
            action: 'superseded',
            timestamp: now,
            userId: userId,
            metadata: {
              revisionQuoteId: insertResult.insertedId.toString(),
              revisionQuoteNumber: revisionQuoteNumber,
              version: nextVersion
            }
          }
        }
      }
    );

    // Fetch the created revision
    const createdRevision = await quotesCollection.findOne({
      _id: insertResult.insertedId
    });

    console.log(`[API] Quote revision ${revisionQuoteNumber} created from ${originalQuote.quoteNumber} by user ${userId}`);

    // TODO: If notifyCustomer is true, trigger email notification
    // This would integrate with your GHL email system

    return res.status(201).json({
      success: true,
      message: 'Quote revision created successfully',
      originalQuote: {
        _id: originalQuote._id,
        quoteNumber: originalQuote.quoteNumber,
        status: 'superseded'
      },
      revisionQuote: createdRevision,
      revisionInfo: {
        version: nextVersion,
        isRevision: true,
        parentQuoteId: originalQuote._id.toString()
      }
    });

  } catch (error) {
    console.error('[API] Failed to create quote revision:', error);
    return res.status(500).json({ 
      error: 'Failed to create quote revision',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}