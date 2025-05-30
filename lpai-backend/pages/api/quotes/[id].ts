// pages/api/quotes/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper for environment-aware logging
const isDev = process.env.NODE_ENV === 'development';
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid quote ID' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'GET':
      return await getQuote(db, id, req.query, res);
    case 'PATCH':
      return await updateQuote(db, id, req.body, res);
    case 'DELETE':
      return await deleteQuote(db, id, req.query, res);
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// 📋 GET: Fetch single quote with full details
async function getQuote(db: any, id: string, query: any, res: NextApiResponse) {
  try {
    const { locationId } = query;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid quote ID format' });
    }
    
    const quote = await db.collection('quotes').findOne({
      _id: new ObjectId(id),
      locationId
    });
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Enrich with contact and project details
    try {
      const [contact, project] = await Promise.all([
        db.collection('contacts').findOne({ _id: new ObjectId(quote.contactId) }),
        db.collection('projects').findOne({ _id: new ObjectId(quote.projectId) })
      ]);
      
      const enrichedQuote = {
        ...quote,
        contact,
        project,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact',
        projectTitle: project?.title || 'Unknown Project',
      };
      
      log(`[QUOTE DETAIL API] Fetched quote ${quote.quoteNumber}`);
      return res.status(200).json(enrichedQuote);
      
    } catch (err) {
      log(`[QUOTE DETAIL API] Failed to enrich quote ${id}:`, err);
      return res.status(200).json({
        ...quote,
        contactName: 'Unknown Contact',
        projectTitle: 'Unknown Project',
      });
    }
    
  } catch (error) {
    console.error('[QUOTE DETAIL API] Error fetching quote:', error);
    return res.status(500).json({ error: 'Failed to fetch quote' });
  }
}

// ✏️ PATCH: Update quote
async function updateQuote(db: any, id: string, body: any, res: NextApiResponse) {
  try {
    const { locationId, action, userId } = body;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid quote ID format' });
    }
    
    // Get existing quote first
    const existingQuote = await db.collection('quotes').findOne({
      _id: new ObjectId(id),
      locationId
    });
    
    if (!existingQuote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    let updateData: any = {};
    let activityEntry: any = null;
    let projectUpdate: any = null;
    
    switch (action) {
      case 'update_status':
        const { status, signatureImageUrl, signedBy } = body;
        
        if (!status) {
          return res.status(400).json({ error: 'Status is required' });
        }
        
        updateData = {
          status,
          updatedAt: new Date().toISOString(),
        };
        
        // Add status-specific timestamps
        if (status === 'sent') {
          updateData.sentAt = new Date().toISOString();
        } else if (status === 'viewed') {
          updateData.viewedAt = new Date().toISOString();
          updateData.lastViewedAt = new Date().toISOString();
          projectUpdate = {
            quoteViewedAt: new Date(),
            status: 'quote_viewed'
          };
        } else if (status === 'accepted') {
          updateData.respondedAt = new Date().toISOString();
          if (signatureImageUrl) {
            updateData.signatureImageUrl = signatureImageUrl;
            updateData.signedAt = new Date().toISOString();
            updateData.signedBy = signedBy || 'Customer';
          }
        } else if (status === 'declined') {
          updateData.respondedAt = new Date().toISOString();
          projectUpdate = {
            status: 'quote_declined',
            quoteDeclinedAt: new Date()
          };
        }
        
        activityEntry = {
          action: `status_changed_to_${status}`,
          timestamp: new Date().toISOString(),
          userId: userId || 'system',
          metadata: { 
            previousStatus: existingQuote.status,
            newStatus: status 
          }
        };
        
        log(`[QUOTE DETAIL API] Updating quote ${id} status to: ${status}`);
        break;
        
      case 'update_content':
        const { 
          title, 
          description, 
          sections, 
          taxRate, 
          discountAmount, 
          discountPercentage,
          termsAndConditions,
          paymentTerms,
          notes,
          // ADD DEPOSIT FIELDS
          depositType,
          depositValue,
          depositAmount
        } = body;
        
        // Recalculate totals if sections provided
        if (sections) {
          const sectionsWithTotals = sections.map((section: any) => {
            const lineItems = section.lineItems || [];
            const sectionSubtotal = lineItems.reduce((sum: number, item: any) => {
              return sum + (parseFloat(item.totalPrice) || 0);
            }, 0);
            
            return {
              ...section,
              subtotal: sectionSubtotal,
            };
          });
          
          const subtotal = sectionsWithTotals.reduce((sum: number, section: any) => sum + section.subtotal, 0);
          const discountTotal = discountPercentage > 0 
            ? subtotal * (discountPercentage / 100)
            : discountAmount || 0;
          const taxableAmount = subtotal - discountTotal;
          const taxAmount = taxableAmount * (taxRate || 0);
          const total = taxableAmount + taxAmount;
          
          // ADD: Calculate deposit amount
          let calculatedDepositAmount = depositAmount || 0;
          if (depositType === 'percentage' && depositValue > 0) {
            calculatedDepositAmount = (total * depositValue) / 100;
          } else if (depositType === 'fixed' && depositValue > 0) {
            calculatedDepositAmount = depositValue;
          }
          
          updateData = {
            sections: sectionsWithTotals,
            subtotal,
            taxAmount,
            discountAmount: discountTotal,
            total,
            // ADD deposit amount to update
            depositAmount: calculatedDepositAmount,
          };
          
          // Update payment summary with new totals
          if (existingQuote.paymentSummary) {
            updateData['paymentSummary.totalRequired'] = total;
            updateData['paymentSummary.depositRequired'] = calculatedDepositAmount;
            updateData['paymentSummary.balance'] = total - (existingQuote.paymentSummary.totalPaid || 0);
          }
        }
        
        // Update other fields if provided
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (taxRate !== undefined) updateData.taxRate = parseFloat(taxRate);
        if (discountPercentage !== undefined) updateData.discountPercentage = parseFloat(discountPercentage);
        if (termsAndConditions !== undefined) updateData.termsAndConditions = termsAndConditions;
        if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
        if (notes !== undefined) updateData.notes = notes;
        
        // ADD: Update deposit fields
        if (depositType !== undefined) updateData.depositType = depositType;
        if (depositValue !== undefined) updateData.depositValue = parseFloat(depositValue);
        
        updateData.updatedAt = new Date().toISOString();
        
        activityEntry = {
          action: 'content_updated',
          timestamp: new Date().toISOString(),
          userId: userId || 'system',
          metadata: { 
            fieldsUpdated: Object.keys(updateData).filter(k => k !== 'updatedAt')
          }
        };
        
        log(`[QUOTE DETAIL API] Updating quote ${id} content`);
        break;
        
      case 'create_revision':
        // This is now handled by the separate create-revision endpoint
        return res.status(400).json({ 
          error: 'Use /api/quotes/[id]/create-revision endpoint for creating revisions' 
        });
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Add activity entry if exists
    const updateQuery: any = { $set: updateData };
    if (activityEntry) {
      updateQuery.$push = { activityFeed: activityEntry };
    }
    
    const result = await db.collection('quotes').updateOne(
      { _id: new ObjectId(id), locationId },
      updateQuery
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Update project if needed
    if (projectUpdate && existingQuote.projectId) {
      try {
        await db.collection('projects').updateOne(
          { _id: new ObjectId(existingQuote.projectId) },
          {
            $set: {
              ...projectUpdate,
              updatedAt: new Date()
            },
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: `quote_${action}`,
                description: activityEntry?.metadata?.newStatus 
                  ? `Quote status changed to ${activityEntry.metadata.newStatus}`
                  : 'Quote updated',
                timestamp: new Date().toISOString(),
                userId: userId || 'system',
                metadata: {
                  quoteId: id,
                  quoteNumber: existingQuote.quoteNumber,
                  ...activityEntry?.metadata
                }
              }
            }
          }
        );
        log(`[QUOTE DETAIL API] Updated project ${existingQuote.projectId} after quote update`);
      } catch (projectError) {
        console.error('[QUOTE DETAIL API] Failed to update project:', projectError);
      }
    }
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('[QUOTE DETAIL API] Error updating quote:', error);
    return res.status(500).json({ error: 'Failed to update quote' });
  }
}

// 🗑️ DELETE: Soft delete quote
async function deleteQuote(db: any, id: string, query: any, res: NextApiResponse) {
  try {
    const { locationId, userId } = query;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid quote ID format' });
    }
    
    // Get quote first to update project
    const quote = await db.collection('quotes').findOne({
      _id: new ObjectId(id),
      locationId
    });
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const result = await db.collection('quotes').updateOne(
      { _id: new ObjectId(id), locationId },
      { 
        $set: { 
          status: 'deleted',
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        $push: {
          activityFeed: {
            action: 'deleted',
            timestamp: new Date().toISOString(),
            userId: userId || 'system',
            metadata: {}
          }
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Update project if exists
    if (quote.projectId) {
      try {
        await db.collection('projects').updateOne(
          { _id: new ObjectId(quote.projectId) },
          {
            $unset: { 
              quoteId: "", 
              activeQuoteId: "" 
            },
            $set: {
              hasQuote: false,
              updatedAt: new Date()
            },
            $push: {
              timeline: {
                id: new ObjectId().toString(),
                event: 'quote_deleted',
                description: `Quote ${quote.quoteNumber} was deleted`,
                timestamp: new Date().toISOString(),
                userId: userId || 'system',
                metadata: {
                  quoteId: id,
                  quoteNumber: quote.quoteNumber
                }
              }
            }
          }
        );
        log(`[QUOTE DETAIL API] Updated project after quote deletion`);
      } catch (projectError) {
        console.error('[QUOTE DETAIL API] Failed to update project after deletion:', projectError);
      }
    }
    
    log(`[QUOTE DETAIL API] Soft deleted quote ${id}`);
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('[QUOTE DETAIL API] Error deleting quote:', error);
    return res.status(500).json({ error: 'Failed to delete quote' });
  }
}