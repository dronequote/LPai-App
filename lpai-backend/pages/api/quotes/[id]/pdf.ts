// pages/api/quotes/[id]/pdf.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { quotePDFGenerator } from '../../../../../src/services/pdfGenerator';
import { pdfStorageService } from '../../../../../src/services/pdfStorage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid quote ID' });
  }

  const client = await clientPromise;
  const db = client.db('lpai');

  switch (req.method) {
    case 'POST':
      // Get locationId from body for POST requests
      const { locationId } = req.body;
      if (!locationId) {
        return res.status(400).json({ error: 'Missing locationId in request body' });
      }
      return await generateAndStorePDF(db, id, locationId, res);
      
    case 'GET':
      // Get locationId from query for GET requests  
      const { locationId: queryLocationId } = req.query;
      if (!queryLocationId || typeof queryLocationId !== 'string') {
        return res.status(400).json({ error: 'Missing locationId in query' });
      }
      return await retrievePDF(db, id, queryLocationId, req, res);
      
    default:
      res.setHeader('Allow', ['POST', 'GET']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

// Generate and store PDF
async function generateAndStorePDF(db: any, quoteId: string, locationId: string, res: NextApiResponse) {
  try {
    console.log('[PDF API] Generating PDF for quote:', quoteId);

    // Get quote with all details
    const quote = await db.collection('quotes').findOne({
      _id: new ObjectId(quoteId),
      locationId
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Get location data (company info and terms)
    const location = await db.collection('locations').findOne({ locationId });
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get template data (for styling and company overrides)
    // For now, use a default template structure
    const template = {
      styling: {
        primaryColor: '#2E86AB',
        accentColor: '#A23B72'
      },
      companyOverrides: {
        name: location.name,
        phone: location.branding?.phone,
        email: location.branding?.email,
        address: location.branding?.address
      }
    };

    const companyData = {
      name: location.name,
      termsAndConditions: location.termsAndConditions || '',
      ...location.branding
    };

    const signatures = quote.signatures || {};

    // Generate PDF
    const pdfBytes = await quotePDFGenerator.generateSignedQuotePDF(
      quote, 
      template, 
      companyData, 
      signatures
    );

    // Store PDF in GridFS
    const storedPDF = await pdfStorageService.storePDF(db, pdfBytes, quoteId, {
      quoteNumber: quote.quoteNumber,
      customerName: quote.customerName,
      locationId: locationId,
      hasSignatures: !!(signatures.consultant && signatures.customer),
      generatedAt: new Date().toISOString()
    });

    // Update quote with PDF reference
    await db.collection('quotes').updateOne(
      { _id: new ObjectId(quoteId), locationId },
      {
        $set: {
          signedPdfUrl: storedPDF.url,
          signedPdfFileId: storedPDF.fileId,
          pdfGeneratedAt: new Date().toISOString()
        },
        $push: {
          activityFeed: {
            action: 'pdf_generated',
            timestamp: new Date().toISOString(),
            metadata: {
              filename: storedPDF.filename,
              fileSize: pdfBytes.length,
              hasSignatures: !!(signatures.consultant && signatures.customer)
            }
          }
        }
      }
    );

    console.log('[PDF API] PDF generated and stored successfully');

    return res.status(200).json({
      success: true,
      pdf: {
        fileId: storedPDF.fileId,
        filename: storedPDF.filename,
        url: storedPDF.url,
        size: pdfBytes.length
      }
    });

  } catch (error) {
    console.error('[PDF API] Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

// Retrieve PDF
async function retrievePDF(db: any, quoteId: string, locationId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const { fileId } = req.query;

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ error: 'Missing fileId parameter' });
    }

    console.log('[PDF API] Retrieving PDF:', fileId);

    // Verify quote exists and belongs to location
    const quote = await db.collection('quotes').findOne({
      _id: new ObjectId(quoteId),
      locationId
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Retrieve PDF from GridFS
    const pdfData = await pdfStorageService.retrievePDF(db, new ObjectId(fileId));

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfData.filename}"`);
    res.setHeader('Content-Length', pdfData.buffer.length);

    // Send PDF buffer
    res.send(pdfData.buffer);

  } catch (error) {
    console.error('[PDF API] Error retrieving PDF:', error);
    return res.status(500).json({ error: 'Failed to retrieve PDF' });
  }
}

// Increase body size limit for PDF upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};