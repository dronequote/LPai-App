// /pages/api/reports/settings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    if (req.method === 'GET') {
      const settings = await db.collection('settings').findOne({ 
        type: 'reportRecipients' 
      });
      
      return res.status(200).json({
        recipients: settings?.recipients || []
      });
      
    } else if (req.method === 'POST') {
      const { recipients } = req.body;
      
      if (!Array.isArray(recipients)) {
        return res.status(400).json({ error: 'Recipients must be an array' });
      }
      
      await db.collection('settings').updateOne(
        { type: 'reportRecipients' },
        {
          $set: {
            recipients,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}