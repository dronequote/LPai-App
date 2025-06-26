// src/services/signatureService.ts
// Created: 2025-06-17

import { BaseService } from './baseService';
import { projectService } from './projectService';

interface SignatureData {
  type: 'consultant' | 'customer';
  signature: string; // Base64 string
  signedAt: string;
  name?: string;
  email?: string;
  ipAddress?: string;
}

interface SignatureSubmissionResult {
  success: boolean;
  signatureType: string;
  fullySignedCompleted: boolean;
  quote: {
    _id: string;
    status: string;
    signatures: any;
  };
}

interface SignedPDFResult {
  success: boolean;
  pdfUrl: string;
  fileId: string;
}

class SignatureService extends BaseService {
  protected serviceName = 'signatures';
  
  /**
   * Submit a single signature for a quote
   * This matches the API's expected format exactly
   */
  async submitSignature(
    quoteId: string,
    locationId: string,
    signatureType: 'consultant' | 'customer',
    signatureData: {
      signature: string; // Base64 string
      signedBy: string;
      deviceInfo?: string;
    }
  ): Promise<SignatureSubmissionResult> {
    const endpoint = `/api/quotes/${quoteId}/sign`;
    
    const payload = {
      locationId,
      signatureType,
      signature: signatureData.signature,
      signedBy: signatureData.signedBy,
      deviceInfo: signatureData.deviceInfo || 'iPad App'
    };
    
    console.log('[SignatureService] Submitting signature:', {
      quoteId,
      signatureType,
      signedBy: payload.signedBy
    });
    
    const result = await this.post<SignatureSubmissionResult>(
      endpoint,
      payload,
      {
        offline: false, // Signatures must be online
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'high',
      }
    );
    
    // Clear quote cache
    await this.clearCache(`@lpai_cache_GET_/api/quotes/${quoteId}`);
    
    return result;
  }

  /**
   * Original submitSignatures method - updated to use submitSignature internally
   */
  async submitSignatures(
    quoteId: string,
    locationId: string,
    signatures: {
      consultant?: SignatureData;
      customer?: SignatureData;
    }
  ): Promise<SignatureSubmissionResult> {
    // If consultant signature is provided, submit it
    if (signatures.consultant) {
      return this.submitSignature(
        quoteId,
        locationId,
        'consultant',
        {
          signature: signatures.consultant.signature,
          signedBy: signatures.consultant.name || 'Consultant',
          deviceInfo: 'iPad App'
        }
      );
    }
    
    // If customer signature is provided, submit it
    if (signatures.customer) {
      return this.submitSignature(
        quoteId,
        locationId,
        'customer',
        {
          signature: signatures.customer.signature,
          signedBy: signatures.customer.name || 'Customer',
          deviceInfo: 'iPad App'
        }
      );
    }
    
    throw new Error('No signature data provided');
  }


  /**
   * Generate signed PDF
   */
  async generateSignedPDF(
    quoteId: string,
    locationId: string
  ): Promise<SignedPDFResult> {
    const endpoint = `/api/quotes/${quoteId}/pdf`;
    
    const result = await this.post<SignedPDFResult>(
      endpoint,
      { 
        locationId,
        includeSignatures: true,
      },
      {
        offline: false, // PDF generation must be online
        showError: true,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
        priority: 'high',
      }
    );
    
    return result;
  }

  /**
   * Update project status after signing
   */
async updateProjectAfterSigning(
  projectId: string,
  locationId: string,
  signatureData: {
    signedDate: string;
    status?: string;
    pipelineStageId?: string;
  }
): Promise<any> {
  // Manually construct the URL with locationId as query param
  const endpoint = `/api/projects/${projectId}?locationId=${locationId}`;
  
  return this.patch(
    endpoint,
    {
      status: signatureData.status || 'won',
      signedDate: signatureData.signedDate,
      pipelineStageId: signatureData.pipelineStageId,
    },
    {
      offline: false,
      showError: true,
    },
    {
      endpoint,
      method: 'PATCH',
      entity: 'project',
      priority: 'high',
    }
  );
}

  /**
   * Send signed quote email
   */
async sendSignedQuoteEmail(
  quoteId: string,
  locationId: string,
  options: {
    recipientEmail: string;
    subject?: string;
    message?: string;
    includePDF?: boolean;
  }
): Promise<{ success: boolean; messageId: string }> {
  // First, get the quote to find the contact
  const quote = await this.get(`/api/quotes/${quoteId}?locationId=${locationId}`);
  
  if (!quote || !quote.contact?._id) {
    throw new Error('Quote or contact not found');
  }
  
  // Use the general email send endpoint
  const endpoint = `/api/emails/send`;
  
  const emailData = {
    contactObjectId: quote.contact._id, // MongoDB ObjectId of the contact
    locationId,
    subject: options.subject || `Contract Signed - ${quote.quoteNumber}`,
    htmlContent: options.message || `
      <p>Your signed contract for ${quote.projectTitle || 'your project'} is attached.</p>
      <p>Total Amount: $${quote.total?.toFixed(2) || '0.00'}</p>
      <p>Thank you for your business!</p>
    `,
    projectId: quote.projectId,
    attachments: options.includePDF ? [{
      url: `${process.env.API_BASE_URL || 'https://lpai-backend-omega.vercel.app'}/api/quotes/${quoteId}/pdf?locationId=${locationId}`,
      filename: `${quote.quoteNumber}_signed.pdf`
    }] : undefined
  };
  
  return this.post(
    endpoint,
    emailData,
    {
      offline: false,
      showError: true,
    },
    {
      endpoint,
      method: 'POST',
      entity: 'quote',
    }
  );
}

  /**
   * Verify signature authenticity
   */
  async verifySignature(
    quoteId: string,
    signatureType: 'consultant' | 'customer',
    locationId: string
  ): Promise<{ valid: boolean; signedAt?: string; signerName?: string }> {
    const endpoint = `/api/quotes/${quoteId}/verify-signature`;
    
    return this.post(
      endpoint,
      {
        locationId,
        signatureType,
      },
      {
        cache: false,
        showError: false,
      },
      {
        endpoint,
        method: 'POST',
        entity: 'quote',
      }
    );
  }

  /**
   * Get signature status for a quote
   */
  async getSignatureStatus(
    quoteId: string,
    locationId: string
  ): Promise<{
    hasConsultantSignature: boolean;
    hasCustomerSignature: boolean;
    fullySign: boolean;
    signatureDetails: any;
  }> {
    const endpoint = `/api/quotes/${quoteId}/signature-status?locationId=${locationId}`;
    
    return this.get(
      endpoint,
      {
        cache: { priority: 'high', ttl: 60 * 1000 }, // 1 min cache
      },
      {
        endpoint,
        method: 'GET',
        entity: 'quote',
      }
    );
  }
}

// Create singleton instance
export const signatureService = new SignatureService();