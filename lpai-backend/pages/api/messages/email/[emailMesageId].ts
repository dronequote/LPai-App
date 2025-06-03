// pages/api/messages/email/[emailMessageId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import axios from 'axios';
import { getAuthHeader } from '../../../../src/utils/ghlAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { emailMessageId, locationId } = req.query;

  if (!emailMessageId || typeof emailMessageId !== 'string') {
    return res.status(400).json({ error: 'Missing emailMessageId' });
  }

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get location for auth
    const location = await db.collection('locations').findOne({ locationId });
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get auth header
    const auth = await getAuthHeader(location);

    // Fetch email content from GHL - matching your exact request
    console.log(`[Email Content API] Fetching email ${emailMessageId}`);
    
    const response = await axios.get(
      `https://services.leadconnectorhq.com/conversations/messages/email/${emailMessageId}`,
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-04-15',
          'Accept': 'application/json'
        }
      }
    );

    const emailData = response.data.emailMessage;
    
    if (!emailData) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Update the message in our database with the fetched content
    const message = await db.collection('messages').findOne({
      emailMessageId: emailMessageId
    });

    if (message) {
      await db.collection('messages').updateOne(
        { _id: message._id },
        {
          $set: {
            subject: emailData.subject,
            body: emailData.body, // HTML content
            from: emailData.from,
            to: emailData.to,
            cc: emailData.cc || [],
            bcc: emailData.bcc || [],
            provider: emailData.provider,
            needsContentFetch: false,
            contentFetchedAt: new Date()
          }
        }
      );
    }

    // Return the email content
    return res.status(200).json({
      success: true,
      email: {
        id: emailData.id,
        subject: emailData.subject,
        body: emailData.body,
        from: emailData.from,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        dateAdded: emailData.dateAdded,
        status: emailData.status,
        direction: emailData.direction,
        provider: emailData.provider,
        threadId: emailData.threadId
      }
    });

  } catch (error: any) {
    console.error('[Email Content API] Error:', error.response?.data || error);
    return res.status(500).json({ 
      error: 'Failed to fetch email content',
      message: error.response?.data || error.message 
    });
  }
}