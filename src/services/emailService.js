// src/services/emailService.js
import api from '../lib/api';

/**
 * Email Service for GHL Integration
 * Handles automated contract email sending after signature completion
 */
class EmailService {
  
  /**
   * Send contract email automatically after signature completion
   * @param {Object} params - Email parameters
   * @param {string} params.quoteId - Quote ID
   * @param {string} params.locationId - GHL Location ID
   * @param {string} params.contactId - Contact ID (GHL contact)
   * @param {string} params.pdfFileId - GridFS file ID for signed PDF
   * @param {Object} params.quoteData - Quote data for variable replacement
   * @param {Object} params.companyData - Company data for variable replacement
   * @returns {Promise<Object>} Result with success status and details
   */
  async sendContractEmail({
    quoteId,
    locationId,
    contactId,
    pdfFileId,
    quoteData,
    companyData
  }) {
    console.log('[EmailService] Starting contract email send:', {
      quoteId,
      locationId,
      contactId,
      pdfFileId,
      hasQuoteData: !!quoteData,
      hasCompanyData: !!companyData
    });

    try {
      // Call backend API to handle GHL email sending
      const response = await api.post('/api/emails/send-contract', {
        quoteId,
        locationId,
        contactId,
        pdfFileId,
        quoteData,
        companyData
      });

      console.log('[EmailService] Email sent successfully:', response.data);
      
      return {
        success: true,
        emailId: response.data.emailId,
        templateUsed: response.data.templateUsed,
        sentAt: response.data.sentAt,
        fallbackUsed: response.data.fallbackUsed || false
      };

    } catch (error) {
      console.error('[EmailService] Failed to send contract email:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to send email',
        details: error.response?.data
      };
    }
  }

  /**
   * Build variables object for email template replacement
   * @param {Object} quoteData - Quote data
   * @param {Object} companyData - Company data
   * @returns {Object} Variables for template replacement
   */
  buildEmailVariables(quoteData, companyData) {
    const currentYear = new Date().getFullYear();
    const establishedYear = parseInt(companyData.establishedYear || currentYear.toString());
    const experienceYears = currentYear - establishedYear;

    return {
      // Company variables
      companyName: companyData.name || 'Your Company',
      companyPhone: companyData.phone || '',
      companyEmail: companyData.email || '',
      companyAddress: companyData.address || '',
      establishedYear: companyData.establishedYear || currentYear.toString(),
      warrantyYears: companyData.warrantyYears || '1',
      experienceYears: experienceYears.toString(),
      
      // Quote variables
      quoteNumber: quoteData.quoteNumber || 'Q-XXXX-XXX',
      customerName: quoteData.customerName || 'Valued Customer',
      projectTitle: quoteData.projectTitle || 'Your Project',
      totalAmount: quoteData.total ? `$${quoteData.total.toLocaleString()}` : '$0',
      
      // Date variables
      currentDate: new Date().toLocaleDateString(),
      signedDate: new Date().toLocaleDateString(),
      
      // Custom variables for email templates
      firstName: quoteData.customerName?.split(' ')[0] || 'Valued Customer',
      projectDescription: quoteData.description || quoteData.projectTitle || 'Your Project'
    };
  }

  /**
   * Get fallback email template for when GHL templates fail
   * @param {Object} variables - Variables for replacement
   * @returns {Object} Fallback email template
   */
  getFallbackTemplate(variables) {
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
}

// Export singleton instance
export default new EmailService();