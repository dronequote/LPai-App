// pages/api/webhooks/workflow/form-submission.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventType, locationId, contactId, timestamp, data } = req.body;

  // Validate required fields
  if (!eventType || !locationId || !data?.formId) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['eventType', 'locationId', 'data.formId']
    });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    console.log(`[Form Submission] Processing ${eventType} for form ${data.formId}`);

    // Store form submission
    const submissionRecord = {
      _id: new ObjectId(),
      eventType,
      locationId,
      contactId: contactId || null,
      timestamp: new Date(timestamp || Date.now()),
      processedAt: new Date(),
      
      // Form data
      formId: data.formId,
      formName: data.formName,
      formType: data.formType, // contact, survey, quiz, etc.
      
      // Submission data
      submissionData: data.fields || {},
      
      // Quiz/Survey specific
      quizScore: data.quizScore,
      surveyResponses: data.surveyResponses,
      
      // Source tracking
      source: data.source || 'website',
      pageUrl: data.pageUrl,
      referrer: data.referrer,
      
      // Additional metadata
      metadata: data,
      workflowSource: 'form_submission'
    };

    await db.collection('form_submissions').insertOne(submissionRecord);

    // If it's a new lead (no contactId), create or find contact
    if (!contactId && data.fields) {
      const email = data.fields.email || data.fields.Email;
      const phone = data.fields.phone || data.fields.Phone;
      
      if (email || phone) {
        // Try to find existing contact
        const query: any = { locationId };
        if (email) query.email = email;
        else if (phone) query.phone = phone;
        
        let contact = await db.collection('contacts').findOne(query);
        
        if (!contact) {
          // Create new contact from form data
          const newContact = {
            _id: new ObjectId(),
            locationId,
            firstName: data.fields.firstName || data.fields.first_name || '',
            lastName: data.fields.lastName || data.fields.last_name || '',
            fullName: `${data.fields.firstName || ''} ${data.fields.lastName || ''}`.trim(),
            email: email || '',
            phone: phone || '',
            source: `form_${data.formName || data.formId}`,
            tags: ['form-submission', data.formName].filter(Boolean),
            createdAt: new Date(),
            createdByForm: data.formId,
            formSubmissions: [submissionRecord._id]
          };
          
          await db.collection('contacts').insertOne(newContact);
          contact = newContact;
        } else {
          // Update existing contact
          await db.collection('contacts').updateOne(
            { _id: contact._id },
            {
              $push: { formSubmissions: submissionRecord._id },
              $addToSet: { tags: 'form-submission' },
              $set: { lastFormSubmission: new Date() }
            }
          );
        }
        
        // Update submission with contact ID
        await db.collection('form_submissions').updateOne(
          { _id: submissionRecord._id },
          { $set: { contactId: contact._id.toString() } }
        );
      }
    } else if (contactId) {
      // Update existing contact
      await db.collection('contacts').updateOne(
        { ghlContactId: contactId, locationId },
        {
          $push: { formSubmissions: submissionRecord._id },
          $set: { 
            lastFormSubmission: new Date(),
            lastActivityDate: new Date(),
            lastActivityType: 'form_submission'
          }
        }
      );
    }

    // Handle specific form types
    switch (data.formType) {
      case 'quote_request':
        // Create a lead/project for quote requests
        if (contactId) {
          const project = {
            _id: new ObjectId(),
            locationId,
            contactId,
            title: `Quote Request - ${data.fields.service || 'General'}`,
            status: 'open',
            source: 'form_submission',
            notes: data.fields.message || data.fields.notes || '',
            createdAt: new Date(),
            createdByForm: data.formId
          };
          await db.collection('projects').insertOne(project);
        }
        break;
        
      case 'survey':
        // Store survey-specific data
        if (data.surveyResponses && contactId) {
          await db.collection('survey_responses').insertOne({
            _id: new ObjectId(),
            locationId,
            contactId,
            surveyId: data.formId,
            surveyName: data.formName,
            responses: data.surveyResponses,
            score: data.surveyScore,
            submittedAt: new Date()
          });
        }
        break;
    }

    console.log(`[Form Submission] Successfully processed ${data.formName}`);

    return res.status(200).json({ 
      success: true,
      submissionId: submissionRecord._id,
      formId: data.formId,
      contactId: submissionRecord.contactId
    });

  } catch (error: any) {
    console.error('[Form Submission] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process form submission',
      message: error.message 
    });
  }
}