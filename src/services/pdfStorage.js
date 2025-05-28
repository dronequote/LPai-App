// src/services/pdfStorage.js
import { GridFSBucket } from 'mongodb';

export class PDFStorageService {
  constructor() {
    this.bucketName = 'signed_quotes';
  }

  async storePDF(db, pdfBytes, quoteId, metadata = {}) {
    try {
      console.log('[PDF Storage] Storing PDF for quote:', quoteId);
      
      // Create GridFS bucket
      const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
      
      // Generate filename
      const filename = `quote_${quoteId}_signed_${Date.now()}.pdf`;
      
      // Prepare metadata
      const fileMetadata = {
        quoteId: quoteId,
        fileType: 'signed_pdf',
        createdAt: new Date().toISOString(),
        size: pdfBytes.length,
        ...metadata
      };
      
      // Create upload stream
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: fileMetadata
      });
      
      // Upload PDF bytes
      return new Promise((resolve, reject) => {
        uploadStream.on('error', (error) => {
          console.error('[PDF Storage] Upload error:', error);
          reject(error);
        });
        
        uploadStream.on('finish', () => {
          console.log('[PDF Storage] PDF stored successfully, ID:', uploadStream.id);
          resolve({
            fileId: uploadStream.id,
            filename: filename,
            url: `/api/quotes/${quoteId}/pdf/${uploadStream.id}`,
            metadata: fileMetadata
          });
        });
        
        // Write PDF bytes to stream
        uploadStream.end(Buffer.from(pdfBytes));
      });
      
    } catch (error) {
      console.error('[PDF Storage] Error storing PDF:', error);
      throw new Error('Failed to store PDF: ' + error.message);
    }
  }

  async retrievePDF(db, fileId) {
    try {
      console.log('[PDF Storage] Retrieving PDF, ID:', fileId);
      
      const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
      
      // Get file info
      const files = await bucket.find({ _id: fileId }).toArray();
      if (files.length === 0) {
        throw new Error('PDF file not found');
      }
      
      const file = files[0];
      
      // Create download stream
      const downloadStream = bucket.openDownloadStream(fileId);
      
      // Collect chunks
      return new Promise((resolve, reject) => {
        const chunks = [];
        
        downloadStream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        downloadStream.on('error', (error) => {
          console.error('[PDF Storage] Download error:', error);
          reject(error);
        });
        
        downloadStream.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          console.log('[PDF Storage] PDF retrieved successfully, size:', pdfBuffer.length);
          
          resolve({
            buffer: pdfBuffer,
            filename: file.filename,
            metadata: file.metadata,
            contentType: 'application/pdf'
          });
        });
      });
      
    } catch (error) {
      console.error('[PDF Storage] Error retrieving PDF:', error);
      throw new Error('Failed to retrieve PDF: ' + error.message);
    }
  }

  async listPDFs(db, quoteId) {
    try {
      console.log('[PDF Storage] Listing PDFs for quote:', quoteId);
      
      const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
      
      const files = await bucket.find({ 
        'metadata.quoteId': quoteId 
      }).toArray();
      
      return files.map(file => ({
        fileId: file._id,
        filename: file.filename,
        uploadDate: file.uploadDate,
        length: file.length,
        metadata: file.metadata,
        url: `/api/quotes/${quoteId}/pdf/${file._id}`
      }));
      
    } catch (error) {
      console.error('[PDF Storage] Error listing PDFs:', error);
      throw new Error('Failed to list PDFs: ' + error.message);
    }
  }

  async deletePDF(db, fileId) {
    try {
      console.log('[PDF Storage] Deleting PDF, ID:', fileId);
      
      const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
      await bucket.delete(fileId);
      
      console.log('[PDF Storage] PDF deleted successfully');
      return true;
      
    } catch (error) {
      console.error('[PDF Storage] Error deleting PDF:', error);
      throw new Error('Failed to delete PDF: ' + error.message);
    }
  }
}

// Export the storage service
export const pdfStorageService = new PDFStorageService();