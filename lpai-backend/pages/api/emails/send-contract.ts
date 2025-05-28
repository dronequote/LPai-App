// pages/api/emails/send-contract.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  try {
    const {
      quoteId,
      locationId,
      contactId,
      pdfFileId,
      quoteData,
      companyData
    } = req.body;

    console.log('[Send Contract API] Starting email send:', {
      quoteId,
      locationId,
      contactId,
      pdfFileId,
      hasQuoteData: !!quoteData,
      hasCompanyData: !!companyData
    });

    // Validate required fields
    if (!quoteId || !locationId || !contactId || !pdfFileId) {
      return res.status(400).json({ 
        error: 'Missing required fields: quoteId, locationId, contactId, pdfFileId' 
      });
    }

    // Get location data for GHL API access AND company info
    const location = await db.collection('locations').findOne({ locationId });
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get contact data
    const contact = await db.collection('contacts').findOne({ 
      _id: new ObjectId(contactId),
      locationId 
    });
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Make sure we have the GHL contact ID
    if (!contact.ghlContactId) {
      return res.status(400).json({ error: 'Contact missing GHL ID' });
    }

    // Build company data from location
    const locationCompanyData = {
      name: location.name || '',
      phone: location.branding?.phone || location.phone || '',
      email: location.branding?.email || location.email || '',
      address: location.branding?.address || location.address || '',
      ...location.companyInfo // If additional company info stored here
    };

    // Build variables for template replacement - use location data
    const variables = buildEmailVariables(quoteData, locationCompanyData, contact);
    
    // Get the email template
    const template = await getEmailTemplate(db, locationId, 'Contract Signed');
    
    if (!template) {
      return res.status(500).json({ error: 'No email template found' });
    }

    // Build PDF URL for attachment
    const pdfUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/quotes/${quoteId}/pdf?locationId=${locationId}&fileId=${pdfFileId}`;

    // Send email with local template and PDF attachment
    let emailResult;
    
    try {
      emailResult = await sendGHLEmailWithLocalTemplate({
        apiKey: location.apiKey,
        contactId: contact.ghlContactId,
        template,
        variables,
        attachments: [{
          url: pdfUrl,
          filename: `Contract-${quoteData.quoteNumber}.pdf`
        }]
      });
      
      console.log('[Send Contract API] Email sent successfully using template:', template.name);
      
    } catch (error) {
      console.error('[Send Contract API] Failed to send email:', error);
      throw error;
    }

    // Log activity in quote
    await logEmailActivity(db, quoteId, {
      action: 'contract_emailed',
      success: true,
      templateUsed: template.name,
      templateId: template._id,
      isGlobalTemplate: template.isGlobal || false,
      emailId: emailResult.emailId,
      sentTo: contact.email,
      sentAt: new Date().toISOString()
    });

    console.log('[Send Contract API] Contract email sent successfully');
    
    return res.status(200).json({
      success: true,
      emailId: emailResult.emailId,
      templateUsed: template.name,
      sentAt: new Date().toISOString(),
      sentTo: contact.email
    });

  } catch (error) {
    console.error('[Send Contract API] Error sending contract email:', error);
    
    // Log failed activity
    if (req.body.quoteId) {
      try {
        await logEmailActivity(db, req.body.quoteId, {
          action: 'contract_email_failed',
          success: false,
          error: error.message,
          attemptedAt: new Date().toISOString()
        });
      } catch (logError) {
        console.error('[Send Contract API] Failed to log error activity:', logError);
      }
    }
    
    return res.status(500).json({ 
      error: 'Failed to send contract email',
      details: error.message 
    });
  }
}

/**
 * Get email template - checks location first, then falls back to global
 */
async function getEmailTemplate(db: any, locationId: string, templateName: string) {
  console.log('[Email Template] Looking for template:', templateName, 'for location:', locationId);
  
  // First, check if location has a custom template assigned
  const location = await db.collection('locations').findOne({ locationId });
  
  // Map template names to field names
  const templateFieldMap = {
    'Contract Signed': 'contractSigned',
    'Quote Sent': 'quoteSent',
    'Invoice Sent': 'invoiceSent'
  };
  
  const templateField = templateFieldMap[templateName];
  const customTemplateId = location?.emailTemplates?.[templateField];
  
  // If location has a custom template ID, fetch it
  if (customTemplateId) {
    console.log('[Email Template] Location has custom template ID:', customTemplateId);
    const customTemplate = await db.collection('emailTemplates').findOne({
      _id: new ObjectId(customTemplateId),
      isActive: true
    });
    
    if (customTemplate) {
      console.log('[Email Template] Using location custom template');
      return customTemplate;
    }
  }
  
  // Otherwise, use the global template
  console.log('[Email Template] Using global template');
  const globalTemplate = await db.collection('emailTemplates').findOne({
    locationId: 'global',
    name: templateName,
    isGlobal: true,
    isActive: true
  });
  
  return globalTemplate;
}

/**
 * Send email via GHL using local template with attachments
 */
async function sendGHLEmailWithLocalTemplate({
  apiKey,
  contactId,
  template,
  variables,
  attachments = []
}: any) {
  // Replace variables in subject and HTML
  let subject = template.subject;
  let html = template.html;
  
  // Replace all variables
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    subject = subject.replace(regex, value || '');
    html = html.replace(regex, value || '');
  });

  const payload = {
    type: 'Email',
    contactId: contactId,
    subject: subject,
    html: html,
    attachments: attachments // Add attachments array
  };

  console.log('[GHL Email] Sending email with local template');
  console.log('[GHL Email] Subject:', subject);
  console.log('[GHL Email] Attachments:', attachments);

  const response = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-04-15',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('[GHL Email] Failed response:', errorData);
    throw new Error(`GHL email send failed: ${response.status} ${errorData}`);
  }

  const result = await response.json();
  console.log('[GHL Email] Success response:', result);
  
  return {
    emailId: result.messageId || result.conversationId || result.id || 'ghl_email_sent',
    provider: 'ghl_local_template'
  };
}

/**
 * Build variables for email template
 */
function buildEmailVariables(quoteData: any, companyData: any, contact: any) {
  const currentYear = new Date().getFullYear();
  const establishedYear = parseInt(companyData?.establishedYear || currentYear.toString());
  const experienceYears = currentYear - establishedYear;

  return {
    // Company variables - now from location/company data
    companyName: companyData?.name || 'Your Company',
    companyPhone: companyData?.phone || '',
    companyEmail: companyData?.email || '',
    companyAddress: companyData?.address || '',
    establishedYear: companyData?.establishedYear || currentYear.toString(),
    warrantyYears: companyData?.warrantyYears || '1',
    experienceYears: experienceYears.toString(),
    
    // Contact variables
    firstName: contact?.firstName || quoteData?.customerName?.split(' ')[0] || 'Valued Customer',
    lastName: contact?.lastName || '',
    fullName: `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || quoteData?.customerName || 'Valued Customer',
    email: contact?.email || '',
    phone: contact?.phone || '',
    
    // Quote variables
    quoteNumber: quoteData?.quoteNumber || 'Q-XXXX-XXX',
    customerName: quoteData?.customerName || `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || 'Valued Customer',
    projectTitle: quoteData?.projectTitle || quoteData?.title || 'Your Project',
    totalAmount: quoteData?.total ? `$${quoteData.total.toLocaleString()}` : '$0',
    
    // Date variables
    currentDate: new Date().toLocaleDateString(),
    signedDate: new Date().toLocaleDateString(),
    
    // Custom variables
    projectDescription: quoteData?.description || quoteData?.projectTitle || 'Your Project'
  };
}

/**
 * Log email activity to quote
 */
async function logEmailActivity(db: any, quoteId: string, activityData: any) {
  await db.collection('quotes').updateOne(
    { _id: new ObjectId(quoteId) },
    {
      $push: {
        activityFeed: {
          ...activityData,
          timestamp: new Date().toISOString(),
          id: new ObjectId().toString()
        }
      }
    }
  );
}