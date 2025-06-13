// pages/api/sms/batch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { processTemplate } from '../../../src/utils/smsTemplates';
import { 
  sendSuccess, 
  sendError, 
  sendValidationError,
  sendServerError,
  sendMethodNotAllowed 
} from '../../../src/utils/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }
  
  const client = await clientPromise;
  const db = client.db('lpai');
  
  return await processBatchSMS(db, req.body, res);
}

async function processBatchSMS(db: any, body: any, res: NextApiResponse) {
  try {
    const { 
      recipients, 
      locationId, 
      templateKey,
      customMessage,
      userId,
      campaignName,
      options = {} 
    } = body;
    
    if (!recipients || !locationId || (!templateKey && !customMessage)) {
      return sendValidationError(res, {
        recipients: !recipients ? 'Required' : undefined,
        locationId: !locationId ? 'Required' : undefined,
        message: !templateKey && !customMessage ? 'Template or custom message required' : undefined
      });
    }
    
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return sendValidationError(res, { recipients: 'Must be a non-empty array' });
    }
    
    // Get location and user
    const [location, user] = await Promise.all([
      db.collection('locations').findOne({ locationId }),
      userId ? db.collection('users').findOne({ _id: new ObjectId(userId) }) : null
    ]);
    
    if (!location?.ghlOAuth?.accessToken) {
      return sendError(res, 'Location not found or missing API key', 400);
    }
    
    // Create campaign record
    const campaign = {
      _id: new ObjectId(),
      name: campaignName || `SMS Campaign ${new Date().toLocaleDateString()}`,
      locationId,
      createdBy: userId,
      templateKey,
      customMessage,
      recipientCount: recipients.length,
      status: 'processing',
      createdAt: new Date(),
      stats: {
        sent: 0,
        failed: 0,
        delivered: 0,
        opened: 0
      }
    };
    
    await db.collection('sms_campaigns').insertOne(campaign);
    
    const results = {
      success: [] as any[],
      failed: [] as any[],
      total: recipients.length
    };
    
    // Process in batches to avoid rate limits
    const BATCH_SIZE = options.batchSize || 10;
    const DELAY_MS = options.delayMs || 1000;
    
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (recipient) => {
          try {
            let contactId, contact;
            
            // Handle different recipient formats
            if (typeof recipient === 'string') {
              // Assume it's a contact ID
              contact = await db.collection('contacts').findOne({
                _id: new ObjectId(recipient),
                locationId
              });
              contactId = recipient;
            } else if (recipient.contactId) {
              contact = await db.collection('contacts').findOne({
                _id: new ObjectId(recipient.contactId),
                locationId
              });
              contactId = recipient.contactId;
            } else if (recipient.phone) {
              // Create temporary contact
              contact = {
                firstName: recipient.firstName || '',
                lastName: recipient.lastName || '',
                phone: formatPhoneToE164(recipient.phone),
                ghlContactId: null
              };
              contactId = null;
            } else {
              throw new Error('Invalid recipient format');
            }
            
            if (!contact || !contact.phone) {
              throw new Error('Contact not found or missing phone number');
            }
            
            // Build message
            let message = customMessage || '';
            
            if (templateKey) {
              // Get template
              const templatesResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/sms/templates?locationId=${locationId}&userId=${userId}`
              );
              const { templates } = await templatesResponse.json();
              
              const template = templates[templateKey];
              if (!template) {
                throw new Error('Template not found');
              }
              
              // Process template
              message = processTemplate(template.message, {
                user,
                location,
                contact,
                dynamic: recipient.dynamicData || {}
              });
            }
            
            // Send SMS via internal endpoint
            const smsResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/sms/send`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contactId: contactId || 'temp',
                  locationId,
                  templateKey,
                  customMessage: message,
                  toNumber: contact.phone,
                  userId,
                  campaignId: campaign._id.toString(),
                  dynamicData: recipient.dynamicData
                })
              }
            );
            
            if (smsResponse.ok) {
              results.success.push({
                contactId,
                phone: contact.phone,
                name: `${contact.firstName} ${contact.lastName}`.trim()
              });
              
              // Update campaign stats
              await db.collection('sms_campaigns').updateOne(
                { _id: campaign._id },
                { $inc: { 'stats.sent': 1 } }
              );
            } else {
              const error = await smsResponse.json();
              throw new Error(error.error || 'Failed to send SMS');
            }
            
          } catch (error: any) {
            results.failed.push({
              recipient,
              error: error.message
            });
            
            // Update campaign stats
            await db.collection('sms_campaigns').updateOne(
              { _id: campaign._id },
              { $inc: { 'stats.failed': 1 } }
            );
          }
        })
      );
      
      // Delay between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    // Update campaign status
    await db.collection('sms_campaigns').updateOne(
      { _id: campaign._id },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          results: {
            successful: results.success.length,
            failed: results.failed.length,
            total: results.total
          }
        }
      }
    );
    
    return sendSuccess(res, {
      campaignId: campaign._id,
      campaignName: campaign.name,
      results: {
        successful: results.success.length,
        failed: results.failed.length,
        total: results.total,
        details: options.includeDetails ? results : undefined
      }
    }, 'SMS campaign completed');
    
  } catch (error) {
    console.error('[SMS BATCH] Campaign error:', error);
    return sendServerError(res, error, 'SMS campaign failed');
  }
}

// Helper function
function formatPhoneToE164(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (phone.startsWith('+')) return phone;
  
  return `+1${cleaned}`;
}