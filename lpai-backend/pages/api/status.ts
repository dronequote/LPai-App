// pages/api/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    const [
      locations,
      webhookQueue,
      agencies
    ] = await Promise.all([
      db.collection('locations').countDocuments(),
      db.collection('webhook_queue').countDocuments({ status: 'pending' }),
      db.collection('agencies').countDocuments()
    ]);

    return res.status(200).json({
      status: 'healthy',
      database: 'connected',
      counts: {
        locations,
        pendingWebhooks: webhookQueue,
        agencies
      },
      timestamp: new Date()
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
}