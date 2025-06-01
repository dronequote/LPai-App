// src/utils/sync/setupDefaults.ts
import { Db, ObjectId } from 'mongodb';

export async function setupDefaults(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Setup Defaults] Starting for ${location.locationId}`);

  try {
    const updates: any = {};
    const results: any = {
      termsAndConditions: false,
      emailTemplates: false,
      defaultLibrary: false
    };

    // 1. Set up default terms and conditions if not present
    if (!location.termsAndConditions) {
      updates.termsAndConditions = DEFAULT_TERMS_AND_CONDITIONS;
      results.termsAndConditions = true;
      console.log(`[Setup Defaults] Added default terms and conditions`);
    }

    // 2. Create default email templates if not present
    if (!location.emailTemplates?.contractSigned) {
      // Check if global template exists
      let contractSignedTemplate = await db.collection('emailTemplates').findOne({
        locationId: 'global',
        trigger: 'contract_signed'
      });

      if (!contractSignedTemplate) {
        // Create global template
        const result = await db.collection('emailTemplates').insertOne({
          _id: new ObjectId(),
          locationId: 'global',
          name: 'Contract Signed Notification',
          trigger: 'contract_signed',
          category: 'transactional',
          subject: 'Contract Signed - {projectTitle}',
          previewText: 'Your signed contract for {projectTitle} is attached',
          html: CONTRACT_SIGNED_EMAIL_TEMPLATE,
          variables: ['customerName', 'projectTitle', 'companyName', 'companyPhone', 'signedDate'],
          requiredVariables: ['customerName', 'projectTitle', 'companyName'],
          isActive: true,
          isGlobal: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        contractSignedTemplate = { _id: result.insertedId };
      }

      if (!updates.emailTemplates) updates.emailTemplates = {};
      updates.emailTemplates.contractSigned = contractSignedTemplate._id.toString();
      results.emailTemplates = true;
      console.log(`[Setup Defaults] Added contract signed email template`);
    }

    // 3. Create default library if none exists
    const libraryCount = await db.collection('libraries').countDocuments({
      locationId: location.locationId
    });

    if (libraryCount === 0) {
      const defaultLibrary = {
        _id: new ObjectId(),
        locationId: location.locationId,
        name: 'Default Product Library',
        isDefault: true,
        isShared: true,
        categories: [
          {
            id: new ObjectId().toString(),
            name: 'Materials',
            description: 'Construction materials and supplies',
            icon: 'construct-outline',
            sortOrder: 1,
            isActive: true,
            items: [
              {
                id: new ObjectId().toString(),
                name: 'Standard Service Call',
                description: 'Minimum service call charge',
                basePrice: 95,
                markup: 1.0,
                unit: 'each',
                sku: 'SVC-001',
                isActive: true,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: new ObjectId().toString(),
            name: 'Labor',
            description: 'Labor and installation services',
            icon: 'people-outline',
            sortOrder: 2,
            isActive: true,
            items: [
              {
                id: new ObjectId().toString(),
                name: 'Standard Labor Rate',
                description: 'Per hour labor charge',
                basePrice: 75,
                markup: 1.0,
                unit: 'hour',
                sku: 'LBR-001',
                isActive: true,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('libraries').insertOne(defaultLibrary);
      results.defaultLibrary = true;
      console.log(`[Setup Defaults] Created default product library`);
    }

    // 4. Apply updates to location
    if (Object.keys(updates).length > 0) {
      await db.collection('locations').updateOne(
        { _id: location._id },
        { 
          $set: {
            ...updates,
            defaultsSetup: true,
            defaultsSetupAt: new Date()
          }
        }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[Setup Defaults] Completed in ${duration}ms`);

    return {
      success: true,
      termsAndConditionsAdded: results.termsAndConditions,
      emailTemplatesAdded: results.emailTemplates,
      defaultLibraryCreated: results.defaultLibrary,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Setup Defaults] Error:`, error.message);
    throw error;
  }
}

// Default Terms and Conditions Template
const DEFAULT_TERMS_AND_CONDITIONS = `Terms and Conditions:
1. Acceptance of Estimate:
By signing this Agreement, Customer acknowledges acceptance of the terms, scope of work, and pricing as detailed in the estimate provided by {companyName}.

2. Deposit and Scheduling:
Scheduling and commencement of the project are contingent upon full payment of the determined deposit amount. No work will be scheduled or initiated until the deposit has been received in full by {companyName}.

3. Final Payment:
Full payment of the remaining project balance is due immediately upon project completion and receipt of the final invoice. Payment must be made on site.

4. Payment Terms:
{companyName} does not offer billing and does not finance projects. Customer is responsible for ensuring that full payment is available at the time of project completion.

5. Changes to Scope:
Any changes to the agreed-upon scope of work, whether additions or deletions, must be documented in writing and may require a revised estimate or a change order.

6. Removal of Line Items:
If any line item from the estimate is not desired by the Customer, it may be deducted from the final scope. The deduction will apply only to the direct cost of the removed item and will not alter the overall pricing structure or affect discounts on the remaining work.

7. Unknown Site Conditions:
Pricing for tie-ins to existing systems is subject to revision pending discovery of existing conditions. Any necessary adjustments will be documented and approved through a change order.

8. Warranty:
{companyName} provides a warranty on workmanship for a period specified in the contract. This warranty does not cover issues arising from customer misuse, normal wear and tear, or acts of nature.

9. Liability:
{companyName} maintains appropriate insurance coverage. However, {companyName} is not responsible for any pre-existing conditions or damages not caused by our work.

10. Cancellation:
If Customer cancels the project after signing, the deposit is non-refundable as it covers administrative costs and reserved scheduling.

Acknowledgment and Acceptance:
By signing below, Customer agrees to the terms of this Agreement and authorizes {companyName} to proceed with the work as outlined.`;

// Default Email Template for Contract Signed
const CONTRACT_SIGNED_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Signed</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
    <h2 style="color: #2E86AB; margin-bottom: 20px;">Contract Signed Successfully!</h2>
    
    <p>Dear {customerName},</p>
    
    <p>Thank you for signing the contract for <strong>{projectTitle}</strong>. Your signed contract is attached to this email for your records.</p>
    
    <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Project:</strong> {projectTitle}</p>
      <p style="margin: 5px 0;"><strong>Signed Date:</strong> {signedDate}</p>
    </div>
    
    <p>We're excited to work with you on this project. Our team will be in touch shortly to schedule the next steps.</p>
    
    <p>If you have any questions, please don't hesitate to contact us at {companyPhone}.</p>
    
    <p style="margin-top: 30px;">Best regards,<br>
    The {companyName} Team</p>
  </div>
  
  <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
    <p>This is an automated message from {companyName}</p>
  </div>
</body>
</html>`;