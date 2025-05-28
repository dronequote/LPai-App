// pages/api/quotes/[id]/publish.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { locationId, userId } = req.body;

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

    // Find the quote
    const quote = await quotesCollection.findOne({
      _id: new ObjectId(id),
      locationId: locationId
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Check if quote is in draft status
    if (quote.status !== 'draft') {
      return res.status(400).json({ 
        error: `Quote cannot be published. Current status: ${quote.status}. Use revision workflow for published quotes.` 
      });
    }

    // Generate secure web link token
    const webLinkToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiry to 30 days from now (configurable)
    const webLinkExpiry = new Date();
    webLinkExpiry.setDate(webLinkExpiry.getDate() + 30);

    const now = new Date().toISOString();

    // Create activity entry
    const activityEntry = {
      id: crypto.randomUUID(),
      action: 'published',
      timestamp: now,
      userId: userId,
      metadata: {
        webLinkToken: webLinkToken,
        expiryDate: webLinkExpiry.toISOString()
      }
    };

    // Update the quote
    const updateResult = await quotesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'published',
          publishedAt: now,
          publishedBy: userId,
          webLinkToken: webLinkToken,
          webLinkExpiry: webLinkExpiry.toISOString(),
          updatedAt: now
        },
        $push: {
          activityFeed: activityEntry
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Fetch the updated quote
    const updatedQuote = await quotesCollection.findOne({
      _id: new ObjectId(id)
    });

    console.log(`[API] Quote ${quote.quoteNumber} published successfully by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Quote published successfully',
      quote: updatedQuote,
      webLink: {
        token: webLinkToken,
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/quote/${webLinkToken}`,
        expiresAt: webLinkExpiry.toISOString()
      }
    });

  } catch (error) {
    console.error('[API] Failed to publish quote:', error);
    return res.status(500).json({ 
      error: 'Failed to publish quote',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}