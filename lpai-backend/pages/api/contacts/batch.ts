// pages/api/contacts/batch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
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
  
  return await processBatchOperation(db, req.body, res);
}

async function processBatchOperation(db: any, body: any, res: NextApiResponse) {
  try {
    const { action, contacts, locationId, options = {} } = body;
    
    if (!action || !contacts || !locationId) {
      return sendValidationError(res, {
        action: !action ? 'Required' : undefined,
        contacts: !contacts ? 'Required' : undefined,
        locationId: !locationId ? 'Required' : undefined
      });
    }
    
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return sendValidationError(res, { contacts: 'Must be a non-empty array' });
    }
    
    const validActions = ['create', 'update', 'delete', 'tag', 'merge'];
    if (!validActions.includes(action)) {
      return sendValidationError(res, { 
        action: `Invalid action. Must be one of: ${validActions.join(', ')}` 
      });
    }
    
    // Get location for GHL sync
    const location = await db.collection('locations').findOne({ locationId });
    const hasGHLSync = location?.apiKey ? true : false;
    
    const results = {
      success: [] as any[],
      failed: [] as any[],
      duplicates: [] as any[],
      total: contacts.length
    };
    
    switch (action) {
      case 'create':
        for (const contactData of contacts) {
          try {
            // Validate required fields
            if (!contactData.email && !contactData.phone) {
              results.failed.push({
                contact: contactData,
                error: 'Either email or phone is required'
              });
              continue;
            }
            
            // Check for duplicates if requested
            if (!options.skipDuplicates) {
              const existingQuery: any = { locationId };
              if (contactData.email) {
                existingQuery.email = contactData.email;
              } else if (contactData.phone) {
                existingQuery.phone = formatPhoneToE164(contactData.phone);
              }
              
              const existing = await db.collection('contacts').findOne(existingQuery);
              
              if (existing) {
                if (options.updateDuplicates) {
                  // Update existing contact
                  await db.collection('contacts').updateOne(
                    { _id: existing._id },
                    { 
                      $set: {
                        ...contactData,
                        phone: contactData.phone ? formatPhoneToE164(contactData.phone) : existing.phone,
                        updatedAt: new Date()
                      }
                    }
                  );
                  results.success.push({ ...existing, ...contactData, updated: true });
                } else {
                  results.duplicates.push({
                    contact: contactData,
                    existing: { 
                      id: existing._id, 
                      email: existing.email,
                      name: `${existing.firstName} ${existing.lastName}`
                    }
                  });
                }
                continue;
              }
            }
            
            // Create new contact
            const newContact = {
              firstName: contactData.firstName || '',
              lastName: contactData.lastName || '',
              email: contactData.email || '',
              phone: contactData.phone ? formatPhoneToE164(contactData.phone) : '',
              address: contactData.address || '',
              city: contactData.city || '',
              state: contactData.state || '',
              postalCode: contactData.postalCode || '',
              country: contactData.country || '',
              notes: contactData.notes || '',
              source: contactData.source || 'batch_import',
              tags: contactData.tags || [],
              locationId,
              status: 'active',
              type: 'lead',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            const result = await db.collection('contacts').insertOne(newContact);
            const createdContact = { ...newContact, _id: result.insertedId };
            
            // Sync to GHL if enabled
            if (hasGHLSync) {
              try {
                const ghlPayload = {
                  firstName: newContact.firstName,
                  lastName: newContact.lastName,
                  email: newContact.email,
                  phone: newContact.phone,
                  address1: newContact.address,
                  city: newContact.city,
                  state: newContact.state,
                  postalCode: newContact.postalCode,
                  country: newContact.country,
                  tags: newContact.tags,
                  source: newContact.source,
                  locationId
                };
                
                const ghlResponse = await axios.post(
                  'https://services.leadconnectorhq.com/contacts/',
                  ghlPayload,
                  {
                    headers: {
                      Authorization: `Bearer ${location.apiKey}`,
                      Version: '2021-07-28',
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                // Update with GHL ID
                if (ghlResponse.data?.contact?.id) {
                  await db.collection('contacts').updateOne(
                    { _id: result.insertedId },
                    { 
                      $set: { 
                        ghlContactId: ghlResponse.data.contact.id,
                        lastSyncedAt: new Date()
                      }
                    }
                  );
                  createdContact.ghlContactId = ghlResponse.data.contact.id;
                }
              } catch (ghlError: any) {
                console.error('[CONTACTS BATCH] GHL sync failed:', ghlError.response?.data);
                // Don't fail the contact creation
              }
            }
            
            results.success.push(createdContact);
            
          } catch (error: any) {
            results.failed.push({
              contact: contactData,
              error: error.message
            });
          }
        }
        break;
        
      case 'update':
        for (const updateData of contacts) {
          try {
            if (!updateData.id) {
              results.failed.push({
                contact: updateData,
                error: 'Missing contact ID'
              });
              continue;
            }
            
            const { id, ...updates } = updateData;
            updates.updatedAt = new Date();
            
            // Format phone if provided
            if (updates.phone) {
              updates.phone = formatPhoneToE164(updates.phone);
            }
            
            const result = await db.collection('contacts').updateOne(
              { _id: new ObjectId(id), locationId },
              { $set: updates }
            );
            
            if (result.matchedCount === 0) {
              results.failed.push({
                contact: updateData,
                error: 'Contact not found'
              });
            } else {
              results.success.push({ id, updated: true });
              
              // Sync to GHL if contact has GHL ID
              if (hasGHLSync) {
                const contact = await db.collection('contacts').findOne({ _id: new ObjectId(id) });
                if (contact?.ghlContactId) {
                  try {
                    await axios.put(
                      `https://services.leadconnectorhq.com/contacts/${contact.ghlContactId}`,
                      updates,
                      {
                        headers: {
                          Authorization: `Bearer ${location.apiKey}`,
                          Version: '2021-07-28',
                          'Content-Type': 'application/json'
                        }
                      }
                    );
                  } catch (ghlError) {
                    console.error('[CONTACTS BATCH] GHL update failed:', ghlError);
                  }
                }
              }
            }
            
          } catch (error: any) {
            results.failed.push({
              contact: updateData,
              error: error.message
            });
          }
        }
        break;
        
      case 'delete':
        const contactIds = contacts.map(c => new ObjectId(c.id || c));
        
        try {
          // Soft delete - set status to deleted
          const result = await db.collection('contacts').updateMany(
            { _id: { $in: contactIds }, locationId },
            {
              $set: {
                status: 'deleted',
                deletedAt: new Date(),
                updatedAt: new Date()
              }
            }
          );
          
          results.success.push({
            deletedCount: result.modifiedCount
          });
          
          // Note: We don't delete from GHL, just mark as deleted in our system
          
        } catch (error: any) {
          results.failed.push({
            error: error.message
          });
        }
        break;
        
      case 'tag':
        const { tagOperation = 'add', tags = [] } = options;
        
        if (!tags.length) {
          return sendValidationError(res, { tags: 'No tags provided' });
        }
        
        const tagContactIds = contacts.map(c => new ObjectId(c.id || c));
        
        try {
          let updateOperation;
          
          switch (tagOperation) {
            case 'add':
              updateOperation = { $addToSet: { tags: { $each: tags } } };
              break;
            case 'remove':
              updateOperation = { $pull: { tags: { $in: tags } } };
              break;
            case 'replace':
              updateOperation = { $set: { tags } };
              break;
            default:
              throw new Error('Invalid tag operation');
          }
          
          const result = await db.collection('contacts').updateMany(
            { _id: { $in: tagContactIds }, locationId },
            {
              ...updateOperation,
              $set: { updatedAt: new Date() }
            }
          );
          
          results.success.push({
            taggedCount: result.modifiedCount,
            operation: tagOperation,
            tags
          });
          
        } catch (error: any) {
          results.failed.push({
            error: error.message
          });
        }
        break;
        
      case 'merge':
        // Merge duplicate contacts
        const { primaryId, duplicateIds } = options;
        
        if (!primaryId || !duplicateIds || !duplicateIds.length) {
          return sendValidationError(res, { 
            merge: 'primaryId and duplicateIds required for merge operation' 
          });
        }
        
        try {
          // Get all contacts to merge
          const [primary, ...duplicates] = await Promise.all([
            db.collection('contacts').findOne({ _id: new ObjectId(primaryId), locationId }),
            ...duplicateIds.map((id: string) => 
              db.collection('contacts').findOne({ _id: new ObjectId(id), locationId })
            )
          ]);
          
          if (!primary) {
            throw new Error('Primary contact not found');
          }
          
          // Merge data (primary takes precedence)
          const mergedData: any = { ...primary };
          
          for (const duplicate of duplicates) {
            if (!duplicate) continue;
            
            // Merge fields where primary is empty
            Object.keys(duplicate).forEach(key => {
              if (!mergedData[key] && duplicate[key]) {
                mergedData[key] = duplicate[key];
              }
            });
            
            // Merge arrays
            if (duplicate.tags?.length) {
              mergedData.tags = [...new Set([...(mergedData.tags || []), ...duplicate.tags])];
            }
          }
          
          // Update primary contact
          await db.collection('contacts').updateOne(
            { _id: new ObjectId(primaryId) },
            { $set: { ...mergedData, updatedAt: new Date() } }
          );
          
          // Update all references from duplicates to primary
          const duplicateObjectIds = duplicateIds.map((id: string) => new ObjectId(id));
          
          await Promise.all([
            // Update projects
            db.collection('projects').updateMany(
              { contactId: { $in: duplicateObjectIds } },
              { $set: { contactId: new ObjectId(primaryId) } }
            ),
            // Update appointments
            db.collection('appointments').updateMany(
              { contactId: { $in: duplicateObjectIds.map(id => id.toString()) } },
              { $set: { contactId: primaryId } }
            ),
            // Update quotes
            db.collection('quotes').updateMany(
              { contactId: { $in: duplicateObjectIds } },
              { $set: { contactId: new ObjectId(primaryId) } }
            ),
            // Update conversations
            db.collection('conversations').updateMany(
              { contactId: { $in: duplicateObjectIds } },
              { $set: { contactId: new ObjectId(primaryId) } }
            )
          ]);
          
          // Delete duplicates
          await db.collection('contacts').deleteMany({
            _id: { $in: duplicateObjectIds }
          });
          
          results.success.push({
            merged: true,
            primaryId,
            mergedCount: duplicateIds.length
          });
          
        } catch (error: any) {
          results.failed.push({
            error: error.message
          });
        }
        break;
    }
    
    return sendSuccess(res, {
      action,
      results: {
        successful: results.success.length,
        failed: results.failed.length,
        duplicates: results.duplicates.length,
        total: results.total,
        details: options.includeDetails ? results : undefined
      }
    }, `Batch ${action} completed`);
    
  } catch (error) {
    console.error('[CONTACTS BATCH] Operation error:', error);
    return sendServerError(res, error, 'Batch operation failed');
  }
}

// Helper function to format phone numbers
function formatPhoneToE164(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (phone.startsWith('+')) return phone;
  
  return `+1${cleaned}`;
}