// pages/api/webhooks/workflow/contact-milestones.ts
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

    console.log(`[Contact Milestones] Processing ${eventType} for contact ${contactId}`);

    // Store milestone event
    const milestoneRecord = {
      _id: new ObjectId(),
      eventType,
      locationId,
      contactId,
      timestamp: new Date(timestamp || Date.now()),
      processedAt: new Date(),
      
      // Event-specific data
      milestoneDate: data?.date,
      milestoneType: data?.type,
      customFieldName: data?.customFieldName,
      customFieldValue: data?.customFieldValue,
      
      // Scoring data
      previousScore: data?.previousScore,
      newScore: data?.newScore,
      scoreChange: data?.scoreChange,
      
      // Task data
      taskId: data?.taskId,
      taskTitle: data?.taskTitle,
      daysOverdue: data?.daysOverdue,
      
      // Additional metadata
      metadata: data,
      source: 'workflow'
    };

    await db.collection('contact_milestones').insertOne(milestoneRecord);

    // Update contact based on milestone type
    switch (eventType) {
      case 'birthday_reminder':
        await db.collection('contacts').updateOne(
          { ghlContactId: contactId, locationId },
          {
            $set: {
              lastBirthdayReminder: new Date(),
              lastActivityDate: new Date(),
              lastActivityType: 'birthday_reminder'
            },
            $inc: { birthdayRemindersSent: 1 }
          }
        );
        
        // Create a note for birthday
        await db.collection('notes').insertOne({
          _id: new ObjectId(),
          locationId,
          contactId,
          body: `Birthday reminder sent on ${new Date().toLocaleDateString()}`,
          createdBy: 'system',
          createdAt: new Date(),
          type: 'milestone'
        });
        break;
        
      case 'custom_date_reminder':
        const reminderType = data?.type || 'custom';
        await db.collection('contacts').updateOne(
          { ghlContactId: contactId, locationId },
          {
            $set: {
              [`lastReminder_${reminderType}`]: new Date(),
              lastActivityDate: new Date(),
              lastActivityType: 'custom_reminder'
            }
          }
        );
        
        // Track specific reminder types (warranty, contract renewal, etc.)
        if (data?.projectId) {
          await db.collection('projects').updateOne(
            { _id: new ObjectId(data.projectId) },
            {
              $push: {
                timeline: {
                  id: new ObjectId().toString(),
                  event: 'reminder_sent',
                  description: `${reminderType} reminder sent`,
                  timestamp: new Date().toISOString(),
                  metadata: { reminderType, customFieldName: data.customFieldName }
                }
              }
            }
          );
        }
        break;
        
      case 'engagement_score_changed':
        await db.collection('contacts').updateOne(
          { ghlContactId: contactId, locationId },
          {
            $set: {
              engagementScore: data.newScore,
              lastEngagementScoreUpdate: new Date(),
              engagementTrend: data.scoreChange > 0 ? 'increasing' : 'decreasing'
            }
          }
        );
        
        // Track significant score changes
        if (Math.abs(data.scoreChange) >= 10) {
          await db.collection('engagement_alerts').insertOne({
            _id: new ObjectId(),
            locationId,
            contactId,
            alertType: data.scoreChange > 0 ? 'engagement_increase' : 'engagement_decrease',
            previousScore: data.previousScore,
            newScore: data.newScore,
            change: data.scoreChange,
            createdAt: new Date()
          });
        }
        break;
        
      case 'task_reminder':
      case 'task_overdue':
        await db.collection('tasks').updateOne(
          { ghlTaskId: data.taskId },
          {
            $set: {
              reminderSent: true,
              reminderSentAt: new Date(),
              isOverdue: eventType === 'task_overdue',
              daysOverdue: data.daysOverdue || 0
            }
          }
        );
        break;
        
      case 'stale_opportunity':
        await db.collection('projects').updateOne(
          { ghlOpportunityId: data.opportunityId },
          {
            $set: {
              isStale: true,
              staleSince: new Date(),
              daysInStage: data.daysInStage,
              staleReason: `Stuck in ${data.stageName} for ${data.daysInStage} days`
            },
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: 'marked_stale',
                description: `Marked as stale after ${data.daysInStage} days in ${data.stageName}`,
                timestamp: new Date().toISOString()
              }
            }
          }
        );
        break;
    }

    console.log(`[Contact Milestones] Successfully processed ${eventType}`);

    return res.status(200).json({ 
      success: true,
      milestoneId: milestoneRecord._id,
      eventType,
      contactId
    });

  } catch (error: any) {
    console.error('[Contact Milestones] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process contact milestone',
      message: error.message 
    });
  }
}