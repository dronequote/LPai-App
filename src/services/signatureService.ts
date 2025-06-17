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
  /**
   * Submit signatures for a quote
   */
  async submitSignatures(
    quoteId: string,
    locationId: string,
    signatures: {
      consultant?: SignatureData;
      customer?: SignatureData;
    }
  ): Promise<SignatureSubmissionResult> {
    const endpoint = `/api/quotes/${quoteId}/sign`;
    
    // Prepare signature data
    const payload: any = {
      locationId,
    };
    
    if (signatures.consultant) {
      payload.consultantSignature = signatures.consultant.signature;
      payload.consultantName = signatures.consultant.name;
      payload.consultantSignedAt = signatures.consultant.signedAt;
    }
    
    if (signatures.customer) {
      payload.customerSignature = signatures.customer.signature;
      payload.customerName = signatures.customer.name;
      payload.customerEmail = signatures.customer.email;
      payload.customerSignedAt = signatures.customer.signedAt;
    }
    
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
    // Use projectService for project updates
    return projectService.update(
      projectId,
      locationId,
      {
        status: signatureData.status || 'won',
        signedDate: signatureData.signedDate,
        pipelineStageId: signatureData.pipelineStageId,
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
    const endpoint = `/api/emails/send-signed-quote`;
    
    return this.post(
      endpoint,
      {
        quoteId,
        locationId,
        ...options,
      },
      {
        offline: false, // Email must be sent online
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