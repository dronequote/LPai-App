// pages/api/quotes/[id]/sign.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { id } = req.query;
  const { locationId, signatureType, signature, signedBy, deviceInfo } = req.body;

  // Validation
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid quote ID' });
  }

  if (!locationId || !signatureType || !signature || !signedBy) {
    return res.status(400).json({ 
      error: 'Missing required fields: locationId, signatureType, signature, signedBy' 
    });
  }

  if (!['consultant', 'customer'].includes(signatureType)) {
    return res.status(400).json({ 
      error: 'Invalid signatureType. Must be "consultant" or "customer"' 
    });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Verify quote exists and belongs to location
    const quote = await db.collection('quotes').findOne({
      _id: new ObjectId(id),
      locationId
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    console.log(`✅ [SIGN API] Adding ${signatureType} signature to quote ${quote.quoteNumber}`);
    console.log(`✅ [SIGN API] Current signatures state:`, quote.signatures);

    // Prepare signature data
    const signatureData = {
      signature: signature, // base64 signature image
      signedAt: new Date().toISOString(),
      signedBy: signedBy,
      deviceInfo: deviceInfo || 'iPad App'
    };

    // Create activity log entry
    const activityEntry = {
      action: `${signatureType}_signed`,
      timestamp: new Date().toISOString(),
      userId: signatureType === 'consultant' ? signedBy : null,
      metadata: {
        signatureType,
        signedBy,
        deviceInfo: deviceInfo || 'iPad App'
      }
    };

    // ✅ FIX: Initialize signatures object if it's null or doesn't exist
    let updateData;
    
    if (!quote.signatures || quote.signatures === null) {
      // Initialize signatures object and add first signature
      updateData = {
        $set: {
          signatures: {
            [signatureType]: signatureData
          },
          updatedAt: new Date().toISOString()
        },
        $push: {
          activityFeed: activityEntry
        }
      };
    } else {
      // Signatures object exists, add to it
      updateData = {
        $set: {
          [`signatures.${signatureType}`]: signatureData,
          updatedAt: new Date().toISOString()
        },
        $push: {
          activityFeed: activityEntry
        }
      };
    }

    console.log(`✅ [SIGN API] Update data:`, JSON.stringify(updateData, null, 2));

    // Update quote with signature
    const result = await db.collection('quotes').updateOne(
      { _id: new ObjectId(id), locationId },
      updateData
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Quote not found or update failed' });
    }

    console.log(`✅ [SIGN API] Update result:`, result);

    // Get updated quote to check if both signatures are complete
    const updatedQuote = await db.collection('quotes').findOne({
      _id: new ObjectId(id),
      locationId
    });

    const signatures = updatedQuote?.signatures || {};
    const hasConsultantSignature = !!signatures.consultant;
    const hasCustomerSignature = !!signatures.customer;
    const fullySignedCompleted = hasConsultantSignature && hasCustomerSignature;

    console.log(`✅ [SIGN API] Signatures status:`, {
      hasConsultantSignature,
      hasCustomerSignature,
      fullySignedCompleted
    });

    // If both signatures are now complete, update status to 'signed'
    if (fullySignedCompleted && updatedQuote?.status !== 'signed') {
      await db.collection('quotes').updateOne(
        { _id: new ObjectId(id), locationId },
        {
          $set: {
            status: 'signed',
            signedAt: new Date().toISOString()
          },
          $push: {
            activityFeed: {
              action: 'quote_fully_signed',
              timestamp: new Date().toISOString(),
              userId: signatureType === 'consultant' ? signedBy : null,
              metadata: {
                bothSignaturesComplete: true
              }
            }
          }
        }
      );

      console.log(`🎉 [SIGN API] Quote ${quote.quoteNumber} is now fully signed!`);
    }

    console.log(`✅ [SIGN API] Successfully added ${signatureType} signature`);
    
    // Return success response
    return res.status(200).json({
      success: true,
      signatureType,
      fullySignedCompleted,
      quote: {
        _id: updatedQuote?._id,
        quoteNumber: updatedQuote?.quoteNumber,
        status: fullySignedCompleted ? 'signed' : updatedQuote?.status,
        signatures: updatedQuote?.signatures
      }
    });

  } catch (error) {
    console.error('❌ [SIGN API] Error adding signature to quote:', error);
    return res.status(500).json({ error: 'Failed to add signature' });
  }
}