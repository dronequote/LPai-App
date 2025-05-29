// pages/api/payments/upload-proof.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { GridFSBucket } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  try {
    const { paymentId, photo, locationId } = req.body;

    if (!paymentId || !photo || !locationId) {
      return res.status(400).json({ 
        error: 'Missing required fields: paymentId, photo, locationId' 
      });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(photo, 'base64');
    
    // Store in GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'payment_proofs' });
    const filename = `payment_${paymentId}_proof_${Date.now()}.jpg`;
    
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        paymentId: new ObjectId(paymentId),
        locationId,
        uploadedAt: new Date()
      }
    });

    // Get the file ID from the upload stream
    const fileId = uploadStream.id;

    return new Promise((resolve, reject) => {
      uploadStream.on('finish', async () => {
        console.log('[Upload Proof API] Photo uploaded successfully:', fileId);
        
        // Update payment record with proof reference
        await db.collection('payments').updateOne(
          { _id: new ObjectId(paymentId) },
          {
            $set: {
              proofPhotoId: fileId,
              proofPhotoUrl: `/api/payments/${paymentId}/proof/${fileId}`,
              proofUploadedAt: new Date()
            }
          }
        );

        res.status(200).json({
          success: true,
          photoId: fileId,
          message: 'Photo proof uploaded successfully'
        });
        resolve(undefined);
      });

      uploadStream.on('error', (error) => {
        console.error('[Upload Proof API] Upload failed:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
        reject(error);
      });

      uploadStream.end(buffer);
    });

  } catch (error: any) {
    console.error('[Upload Proof API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to upload proof',
      details: error.message 
    });
  }
}