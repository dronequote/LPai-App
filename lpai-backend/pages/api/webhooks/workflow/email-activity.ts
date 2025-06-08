// pages/api/webhooks/workflow/email-activity.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventType, locationId, contactId, timestamp, data } = req.body;

  // Validate required fields
  if (!eventType || !locationId || !contactId) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['eventType', 'locationId', 'contactId']
    });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    console.log(`[Email Activity] Processing ${eventType} for contact ${contactId}`);

    // Store email activity event
    const activityRecord = {
      _id: new ObjectId(),
      eventType,
      locationId,
      contactId,
      timestamp: new Date(timestamp || Date.now()),
      processedAt: new Date(),
      
      // Email-specific data
      emailId: data?.emailId,
      emailSubject: data?.emailSubject,
      campaignId: data?.campaignId,
      campaignName: data?.campaignName,
      emailType: data?.emailType, // marketing, transactional, etc.
      
      // Additional metadata
      metadata: data,
      source: 'workflow'
    };

    await db.collection('email_activity').insertOne(activityRecord);

    // Update contact based on event type
    const contactUpdate: any = {
      lastActivityDate: new Date(),
      lastActivityType: `email_${eventType}`
    };

    switch (eventType) {
      case 'email_opened':
        contactUpdate.lastEmailOpenedAt = new Date();
        contactUpdate.$inc = { emailOpens: 1 };
        break;
        
      case 'email_clicked':
        contactUpdate.lastEmailClickedAt = new Date();
        contactUpdate.$inc = { emailClicks: 1 };
        if (data?.linkUrl) {
          contactUpdate.lastClickedLink = data.linkUrl;
        }
        break;
        
      case 'email_bounced':
        contactUpdate.emailBounced = true;
        contactUpdate.emailBouncedAt = new Date();
        contactUpdate.emailBounceReason = data?.bounceReason;
        break;
        
      case 'email_unsubscribed':
        contactUpdate.emailUnsubscribed = true;
        contactUpdate.emailUnsubscribedAt = new Date();
        break;
        
      case 'email_complained':
        contactUpdate.emailComplained = true;
        contactUpdate.emailComplainedAt = new Date();
        break;
    }

    // Update contact
    await db.collection('contacts').updateOne(
      { ghlContactId: contactId, locationId },
      { $set: contactUpdate }
    );

    // If this is related to a quote email, update quote activity
    if (data?.quoteId) {
      await db.collection('quotes').updateOne(
        { _id: new ObjectId(data.quoteId) },
        {
          $push: {
            activityFeed: {
              id: new ObjectId().toString(),
              action: eventType === 'email_opened' ? 'viewed' : 'email_activity',
              timestamp: new Date().toISOString(),
              metadata: {
                emailEvent: eventType,
                emailId: data.emailId,
                ipAddress: data.ipAddress,
                deviceInfo: data.deviceInfo
              }
            }
          },
          $set: {
            lastViewedAt: eventType === 'email_opened' ? new Date() : undefined
          }
        }
      );
    }

    console.log(`[Email Activity] Successfully processed ${eventType}`);

    return res.status(200).json({ 
      success: true,
      activityId: activityRecord._id,
      eventType,
      contactId
    });

  } catch (error: any) {
    console.error('[Email Activity] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process email activity',
      message: error.message 
    });
  }
}