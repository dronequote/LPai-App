// lpai-backend/pages/api/sms/templates.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

// Universal default templates using ACTUAL available variables
const UNIVERSAL_TEMPLATES = {
  'on-way': {
    name: 'On My Way',
    message: 'Hi {contactFirstName}, this is {userName} from {locationName}. I\'m on my way to your appointment and should arrive in approximately {eta} minutes.',
    description: 'Sent when technician starts navigation',
    variables: ['contactFirstName', 'userName', 'locationName', 'eta'],
    category: 'appointment'
  },
  'running-late': {
    name: 'Running Late',
    message: 'Hi {contactFirstName}, this is {userName} from {locationName}. I\'m running about {lateMinutes} minutes behind schedule. My new arrival time is approximately {newTime}. Sorry for the delay!',
    description: 'Sent when technician is running late',
    variables: ['contactFirstName', 'userName', 'locationName', 'lateMinutes', 'newTime'],
    category: 'appointment'
  },
  'arrived': {
    name: 'Arrived',
    message: 'Hi {contactFirstName}, this is {userName} from {locationName}. I\'ve arrived at your location for our {appointmentTitle} appointment.',
    description: 'Sent when technician arrives',
    variables: ['contactFirstName', 'userName', 'locationName', 'appointmentTitle'],
    category: 'appointment'
  },
  'appointment-reminder': {
    name: 'Appointment Reminder',
    message: 'Hi {contactFirstName}, this is a reminder about your {appointmentTitle} appointment tomorrow at {appointmentTime} with {locationName}.',
    description: '24-hour appointment reminder',
    variables: ['contactFirstName', 'appointmentTitle', 'appointmentTime', 'locationName'],
    category: 'reminder'
  },
  'quote-sent': {
    name: 'Quote Sent',
    message: 'Hi {contactFirstName}, your quote for {projectTitle} is ready! View it here: {quoteLink}',
    description: 'Sent when quote is sent to customer',
    variables: ['contactFirstName', 'projectTitle', 'quoteLink'],
    category: 'sales'
  },
  'payment-received': {
    name: 'Payment Received',
    message: 'Hi {contactFirstName}, we\'ve received your payment of {amount}. Thank you for your business!',
    description: 'Payment confirmation',
    variables: ['contactFirstName', 'amount'],
    category: 'billing'
  },
  'job-complete': {
    name: 'Job Complete',
    message: 'Hi {contactFirstName}, we\'ve completed the work on your {projectTitle}. Thank you for choosing {locationName}!',
    description: 'Sent when job is marked complete',
    variables: ['contactFirstName', 'projectTitle', 'locationName'],
    category: 'completion'
  }
};

// Available variables reference (for admin UI)
const AVAILABLE_VARIABLES = {
  user: [
    { key: 'userName', description: 'Technician/User full name', example: 'John Smith' },
    { key: 'userEmail', description: 'User email', example: 'john@company.com' },
    { key: 'userRole', description: 'User role', example: 'admin' }
  ],
  location: [
    { key: 'locationName', description: 'Company/Location name', example: 'ABC Plumbing' },
    { key: 'locationId', description: 'Location ID', example: 'JMtlZzwrNOUmLpJk2eCE' },
    { key: 'termsAndConditions', description: 'Terms text', example: 'Terms and conditions...' }
  ],
  contact: [
    { key: 'contactFirstName', description: 'Customer first name', example: 'Sarah' },
    { key: 'contactLastName', description: 'Customer last name', example: 'Johnson' },
    { key: 'contactEmail', description: 'Customer email', example: 'sarah@email.com' },
    { key: 'contactPhone', description: 'Customer phone', example: '(555) 123-4567' },
    { key: 'contactAddress', description: 'Customer address', example: '123 Main St' }
  ],
  appointment: [
    { key: 'appointmentTitle', description: 'Appointment type/title', example: 'Plumbing Repair' },
    { key: 'appointmentTime', description: 'Appointment time', example: '2:30 PM' },
    { key: 'appointmentDate', description: 'Appointment date', example: 'May 30, 2025' },
    { key: 'appointmentNotes', description: 'Appointment notes', example: 'Check kitchen sink' }
  ],
  project: [
    { key: 'projectTitle', description: 'Project name', example: 'Kitchen Remodel' },
    { key: 'projectStatus', description: 'Project status', example: 'In Progress' },
    { key: 'quoteNumber', description: 'Quote number', example: 'Q-2025-001' }
  ],
  dynamic: [
    { key: 'eta', description: 'Estimated arrival time in minutes', example: '15' },
    { key: 'lateMinutes', description: 'How many minutes late', example: '10' },
    { key: 'newTime', description: 'New arrival time', example: '3:45 PM' },
    { key: 'amount', description: 'Payment amount', example: '$250.00' },
    { key: 'quoteLink', description: 'Link to view quote', example: 'https://...' }
  ]
};

// Template processing function
export function processTemplate(template: string, data: any): string {
  let processed = template;
  
  const variables: Record<string, string> = {
    // User variables
    userName: data.user?.name || '',
    userEmail: data.user?.email || '',
    userRole: data.user?.role || '',
    
    // Location variables
    locationName: data.location?.name || '',
    locationId: data.location?.locationId || '',
    
    // Contact variables
    contactFirstName: data.contact?.firstName || '',
    contactLastName: data.contact?.lastName || '',
    contactEmail: data.contact?.email || '',
    contactPhone: data.contact?.phone || '',
    contactAddress: data.contact?.address || '',
    
    // Appointment variables
    appointmentTitle: data.appointment?.title || '',
    appointmentTime: data.appointment ? new Date(data.appointment.start || data.appointment.time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }) : '',
    
    // Project variables
    projectTitle: data.project?.title || '',
    projectStatus: data.project?.status || '',
    
    // Dynamic variables
    ...(data.dynamic || {})
  };
  
  // Replace all {variable} with actual values
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    processed = processed.replace(regex, value);
  });
  
  return processed.trim();
}

// Export for use in other files
export { UNIVERSAL_TEMPLATES, AVAILABLE_VARIABLES };

// API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locationId } = req.query;

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Missing locationId' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      try {
        // Get location settings
        const location = await db.collection('locations').findOne({ locationId });
        
        // Check if location has SMS template editing enabled
        const canEditTemplates = location?.settings?.smsTemplates?.allowCustomization ?? true;
        
        // Start with universal templates
        let templates = { ...UNIVERSAL_TEMPLATES };
        
        // Check for location-specific custom templates
        const locationTemplates = await db.collection('sms_templates').findOne({ 
          locationId,
          isActive: true 
        });
        
        // Apply location overrides if they exist
        if (locationTemplates?.templates) {
          Object.keys(locationTemplates.templates).forEach(key => {
            if (templates[key]) {
              // Keep metadata but use custom message
              templates[key] = {
                ...templates[key],
                message: locationTemplates.templates[key].message,
                isCustomized: true,
                customizedAt: locationTemplates.templates[key].lastModified,
                customizedBy: locationTemplates.templates[key].modifiedBy
              };
            }
          });
        }
        
        // Check for user-specific templates (if admin allows)
        if (req.query.userId) {
          const userTemplates = await db.collection('user_sms_templates').findOne({
            userId: req.query.userId,
            locationId,
            isActive: true
          });
          
          if (userTemplates?.templates) {
            Object.keys(userTemplates.templates).forEach(key => {
              if (templates[key]) {
                templates[key] = {
                  ...templates[key],
                  message: userTemplates.templates[key].message,
                  isUserCustomized: true,
                  userCustomizedAt: userTemplates.templates[key].lastModified
                };
              }
            });
          }
        }

        return res.status(200).json({
          templates,
          canEditTemplates,
          hasLocationCustomTemplates: !!locationTemplates,
          hasUserCustomTemplates: req.query.userId ? !!(await db.collection('user_sms_templates').findOne({
            userId: req.query.userId,
            locationId,
            isActive: true
          })) : false,
          availableVariables: AVAILABLE_VARIABLES,
          categories: ['appointment', 'reminder', 'sales', 'billing', 'completion']
        });

      } catch (error) {
        console.error('[SMS Templates] Error fetching templates:', error);
        return res.status(500).json({ error: 'Failed to fetch templates' });
      }

    case 'PUT':
      try {
        const { templateKey, message, userId, scope } = req.body; // scope: 'location' or 'user'

        if (!templateKey || !message) {
          return res.status(400).json({ error: 'Missing templateKey or message' });
        }

        // Check if template exists
        if (!UNIVERSAL_TEMPLATES[templateKey]) {
          return res.status(404).json({ error: 'Template not found' });
        }

        // Check if location can edit templates
        const location = await db.collection('locations').findOne({ locationId });
        const canEditTemplates = location?.settings?.smsTemplates?.allowCustomization ?? true;

        if (!canEditTemplates) {
          return res.status(403).json({ error: 'Template customization is disabled for this location' });
        }

        if (scope === 'user' && userId) {
          // Save user-specific template
          await db.collection('user_sms_templates').findOneAndUpdate(
            { userId, locationId },
            {
              $set: {
                [`templates.${templateKey}`]: {
                  message,
                  lastModified: new Date(),
                  modifiedBy: userId
                },
                isActive: true,
                updatedAt: new Date()
              },
              $setOnInsert: {
                userId,
                locationId,
                createdAt: new Date()
              }
            },
            { upsert: true }
          );
        } else {
          // Save location-wide template
          await db.collection('sms_templates').findOneAndUpdate(
            { locationId },
            {
              $set: {
                [`templates.${templateKey}`]: {
                  message,
                  lastModified: new Date(),
                  modifiedBy: userId
                },
                isActive: true,
                updatedAt: new Date()
              },
              $setOnInsert: {
                locationId,
                createdAt: new Date()
              }
            },
            { upsert: true }
          );
        }

        return res.status(200).json({
          success: true,
          template: {
            ...UNIVERSAL_TEMPLATES[templateKey],
            message,
            isCustomized: true
          }
        });

      } catch (error) {
        console.error('[SMS Templates] Error updating template:', error);
        return res.status(500).json({ error: 'Failed to update template' });
      }

    case 'POST':
      // Reset template to universal default
      try {
        const { templateKey, scope, userId } = req.body;

        if (!templateKey || !UNIVERSAL_TEMPLATES[templateKey]) {
          return res.status(400).json({ error: 'Invalid templateKey' });
        }

        if (scope === 'user' && userId) {
          // Remove user custom template
          await db.collection('user_sms_templates').updateOne(
            { userId, locationId },
            { $unset: { [`templates.${templateKey}`]: '' } }
          );
        } else {
          // Remove location custom template
          await db.collection('sms_templates').updateOne(
            { locationId },
            { $unset: { [`templates.${templateKey}`]: '' } }
          );
        }

        return res.status(200).json({
          success: true,
          template: UNIVERSAL_TEMPLATES[templateKey]
        });

      } catch (error) {
        console.error('[SMS Templates] Error resetting template:', error);
        return res.status(500).json({ error: 'Failed to reset template' });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'POST']);
      return res.status(405).json({ error: 'Method not allowed' });
  }
}