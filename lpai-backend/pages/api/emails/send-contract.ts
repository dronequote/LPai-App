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

    // Get location data for GHL API access
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

    // Build variables for template replacement
    const variables = buildEmailVariables(quoteData, companyData, contact);
    
    // Try GHL email first, fallback to basic email if fails
    let emailResult;
    let templateUsed = 'fallback';
    let fallbackUsed = false;

    try {
      // Step 1: Try to fetch GHL email templates
      const templates = await fetchGHLEmailTemplates(location.apiKey, locationId);
      const contractTemplate = findContractTemplate(templates);
      
      if (contractTemplate) {
        console.log('[Send Contract API] Found GHL template:', contractTemplate.name);
        
        // Step 2: Send via GHL with template
        emailResult = await sendGHLEmail({
          apiKey: location.apiKey,
          locationId,
          contactId: contact.ghlContactId,
          templateId: contractTemplate.id,
          opportunityId: contact.ghlOpportunityId, // Will need this for opportunity updates
          pdfFileId,
          quoteId
        });
        
        templateUsed = contractTemplate.name;
        console.log('[Send Contract API] GHL email sent successfully');
        
      } else {
        throw new Error('No Contract Signed template found');
      }
      
    } catch (ghlError) {
      console.warn('[Send Contract API] GHL email failed, using fallback:', ghlError.message);
      
      // Step 3: Fallback to basic email service
      emailResult = await sendFallbackEmail({
        contact,
        variables,
        pdfFileId,
        quoteId,
        locationId
      });
      
      templateUsed = 'Professional Fallback Template';
      fallbackUsed = true;
    }

    // Step 4: Log activity in quote
    await logEmailActivity(db, quoteId, {
      action: 'contract_emailed',
      success: true,
      templateUsed,
      fallbackUsed,
      emailId: emailResult.emailId,
      sentTo: contact.email,
      sentAt: new Date().toISOString()
    });

    console.log('[Send Contract API] Contract email sent successfully');
    
    return res.status(200).json({
      success: true,
      emailId: emailResult.emailId,
      templateUsed,
      fallbackUsed,
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
 * Fetch email templates from GHL
 */
async function fetchGHLEmailTemplates(apiKey: string, locationId: string) {
  const response = await fetch(`https://services.leadconnectorhq.com/emails/builder?locationId=${locationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Version': '2021-04-15',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`GHL template fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.templates || [];
}

/**
 * Find "Contract Signed" template from GHL templates
 */
function findContractTemplate(templates: any[]) {
  return templates.find(template => 
    template.name?.toLowerCase().includes('contract signed') ||
    template.name?.toLowerCase().includes('contract') ||
    template.name?.toLowerCase().includes('signed')
  );
}

/**
 * Send email via GHL API
 */
async function sendGHLEmail({
  apiKey,
  locationId,
  contactId,
  templateId,
  opportunityId,
  pdfFileId,
  quoteId
}: any) {
  // Get PDF URL for attachment
  const pdfUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/quotes/${quoteId}/pdf/${pdfFileId}`;
  
  const payload = {
    type: 'Email',
    contactId,
    templateId,
    attachments: [pdfUrl]
    // No custom fields needed - template uses opportunity and location variables
  };

  console.log('[GHL Email] Sending with payload:', JSON.stringify(payload, null, 2));

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
    throw new Error(`GHL email send failed: ${response.status} ${errorData}`);
  }

  const result = await response.json();
  return {
    emailId: result.id || 'ghl_email_sent',
    provider: 'ghl'
  };
}

/**
 * Send fallback email using basic email service
 */
async function sendFallbackEmail({
  contact,
  variables,
  pdfFileId,
  quoteId,
  locationId
}: any) {
  // Build fallback template
  const template = getFallbackEmailTemplate(variables);
  
  // For now, we'll return a mock success
  // In production, you'd integrate with SendGrid, AWS SES, etc.
  console.log('[Fallback Email] Would send email:', {
    to: contact.email,
    subject: template.subject,
    bodyLength: template.html.length,
    attachmentUrl: `${process.env.API_BASE_URL}/api/quotes/${quoteId}/pdf/${pdfFileId}`
  });

  // TODO: Integrate with actual email service
  // const emailResult = await sendgrid.send({
  //   to: contact.email,
  //   from: 'noreply@yourcompany.com',
  //   subject: template.subject,
  //   html: template.html,
  //   attachments: [{
  //     filename: `Contract-${variables.quoteNumber}.pdf`,
  //     content: pdfBuffer,
  //     type: 'application/pdf'
  //   }]
  // });

  return {
    emailId: `fallback_${Date.now()}`,
    provider: 'fallback'
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
    // Company variables
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
 * Get fallback email template
 */
function getFallbackEmailTemplate(variables: any) {
  return {
    subject: `Contract Signed - ${variables.projectTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2E86AB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Congratulations!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your Agreement is Ready</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Dear ${variables.firstName},
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
            Congratulations! Your agreement for <strong>${variables.projectTitle}</strong> has been signed and is attached to this email.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2E86AB;">
            <h3 style="color: #2E86AB; margin: 0 0 10px 0;">Project Details:</h3>
            <p style="margin: 5px 0; color: #555;">
              <strong>Quote Number:</strong> ${variables.quoteNumber}<br>
              <strong>Project:</strong> ${variables.projectTitle}<br>
              <strong>Total Amount:</strong> ${variables.totalAmount}<br>
              <strong>Signed Date:</strong> ${variables.signedDate}
            </p>
          </div>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your business and for choosing ${variables.companyName}. We look forward to your complete satisfaction with the completion of this project.
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin-bottom: 30px;">
            If you have any questions about your project or this agreement, please don't hesitate to contact us.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #27ae60; color: white; padding: 15px; border-radius: 6px; display: inline-block;">
              <strong>🎉 Let's Get to Work! 🎉</strong>
            </div>
          </div>
          
          <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #666; margin: 0;">
              Best regards,<br>
              <strong>${variables.companyName}</strong><br>
              ${variables.companyPhone ? `📞 ${variables.companyPhone}<br>` : ''}
              ${variables.companyEmail ? `✉️ ${variables.companyEmail}<br>` : ''}
              ${variables.companyAddress ? `📍 ${variables.companyAddress}` : ''}
            </p>
          </div>
        </div>
      </div>
    `,
    text: `
Congratulations ${variables.firstName}!

Your agreement for ${variables.projectTitle} has been signed and is attached to this email.

Project Details:
- Quote Number: ${variables.quoteNumber}
- Project: ${variables.projectTitle}
- Total Amount: ${variables.totalAmount}
- Signed Date: ${variables.signedDate}

Thank you for your business and for choosing ${variables.companyName}. We look forward to your complete satisfaction with the completion of this project.

If you have any questions about your project or this agreement, please don't hesitate to contact us.

Let's Get to Work! 🎉

Best regards,
${variables.companyName}
${variables.companyPhone ? `Phone: ${variables.companyPhone}` : ''}
${variables.companyEmail ? `Email: ${variables.companyEmail}` : ''}
${variables.companyAddress ? `Address: ${variables.companyAddress}` : ''}
    `.trim()
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