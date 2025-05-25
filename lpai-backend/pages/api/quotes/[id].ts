// pages/api/quotes/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

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
      
      console.log(`[QUOTE DETAIL API] Fetched quote ${quote.quoteNumber}`);
      return res.status(200).json(enrichedQuote);
      
    } catch (err) {
      console.warn(`[QUOTE DETAIL API] Failed to enrich quote ${id}:`, err);
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
    const { locationId, action } = body;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid quote ID format' });
    }
    
    let updateData: any = {};
    
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
        } else if (status === 'accepted') {
          updateData.respondedAt = new Date().toISOString();
          if (signatureImageUrl) {
            updateData.signatureImageUrl = signatureImageUrl;
            updateData.signedAt = new Date().toISOString();
            updateData.signedBy = signedBy || 'Customer';
          }
        } else if (status === 'declined') {
          updateData.respondedAt = new Date().toISOString();
        }
        
        console.log(`[QUOTE DETAIL API] Updating quote ${id} status to: ${status}`);
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
          notes 
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
          
          updateData = {
            sections: sectionsWithTotals,
            subtotal,
            taxAmount,
            discountAmount: discountTotal,
            total,
          };
        }
        
        // Update other fields if provided
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (taxRate !== undefined) updateData.taxRate = parseFloat(taxRate);
        if (discountPercentage !== undefined) updateData.discountPercentage = parseFloat(discountPercentage);
        if (termsAndConditions !== undefined) updateData.termsAndConditions = termsAndConditions;
        if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
        if (notes !== undefined) updateData.notes = notes;
        
        updateData.updatedAt = new Date().toISOString();
        
        console.log(`[QUOTE DETAIL API] Updating quote ${id} content`);
        break;
        
      case 'create_revision':
        // Create a new quote as revision
        const originalQuote = await db.collection('quotes').findOne({
          _id: new ObjectId(id),
          locationId
        });
        
        if (!originalQuote) {
          return res.status(404).json({ error: 'Original quote not found' });
        }
        
        // Generate new quote number for revision
        const currentYear = new Date().getFullYear();
        const quoteCount = await db.collection('quotes').countDocuments({ 
          locationId,
          createdAt: { 
            $gte: new Date(`${currentYear}-01-01`),
            $lt: new Date(`${currentYear + 1}-01-01`)
          }
        });
        
        const newQuoteNumber = `Q-${currentYear}-${String(quoteCount + 1).padStart(3, '0')}`;
        
        const revision = {
          ...originalQuote,
          _id: undefined, // Let MongoDB generate new ID
          quoteNumber: newQuoteNumber,
          version: (originalQuote.version || 1) + 1,
          parentQuoteId: originalQuote._id.toString(),
          status: 'draft',
          sentAt: undefined,
          viewedAt: undefined,
          respondedAt: undefined,
          signatureImageUrl: undefined,
          signedAt: undefined,
          signedBy: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        const revisionResult = await db.collection('quotes').insertOne(revision);
        const createdRevision = { ...revision, _id: revisionResult.insertedId };
        
        console.log(`[QUOTE DETAIL API] Created revision ${newQuoteNumber} from quote ${originalQuote.quoteNumber}`);
        return res.status(201).json(createdRevision);
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    const result = await db.collection('quotes').updateOne(
      { _id: new ObjectId(id), locationId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Quote not found' });
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
    const { locationId } = query;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Missing locationId' });
    }
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid quote ID format' });
    }
    
    const result = await db.collection('quotes').updateOne(
      { _id: new ObjectId(id), locationId },
      { 
        $set: { 
          status: 'deleted',
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    console.log(`[QUOTE DETAIL API] Soft deleted quote ${id}`);
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('[QUOTE DETAIL API] Error deleting quote:', error);
    return res.status(500).json({ error: 'Failed to delete quote' });
  }
}