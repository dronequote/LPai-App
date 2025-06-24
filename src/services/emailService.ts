// services/emailService.ts
// Updated Date: 06/24/2025
import { BaseService } from './baseService';

interface SendEmailInput {
 contactObjectId: string;  // Changed from contactId
 locationId: string;
 subject: string;
 htmlContent?: string;
 plainTextContent?: string;
 attachments?: Array<{
   url: string;
   filename: string;
 }>;
 appointmentId?: string;
 projectId?: string;
 userId?: string;
 replyToMessageId?: string;
}

interface SendEmailResponse {
 success: boolean;
 messageId: string;
 conversationId: string;
 message: string;
}

interface SendContractInput {
 quoteId: string;
 locationId: string;
 contactObjectId: string;  // Changed from contactId
 pdfFileId: string;
 quoteData: {
   quoteNumber: string;
   customerName: string;
   total: number;
   projectTitle?: string;
 };
 companyData?: {
   name?: string;
   phone?: string;
   email?: string;
   address?: string;
   establishedYear?: string;
   warrantyYears?: string;
 };
}

interface SendContractResponse {
 success: boolean;
 emailId: string;
 templateUsed: string;
 sentAt: string;
 sentTo: string;
}

interface EmailTemplate {
 _id: string;
 name: string;
 subject: string;
 html: string;
 category: string;
 isGlobal: boolean;
 isActive: boolean;
 variables: string[];
}

class EmailService extends BaseService {
 /**
  * Send general email
  */
 async send(data: SendEmailInput): Promise<SendEmailResponse> {
   const endpoint = '/api/emails/send';
   
   const response = await this.post<SendEmailResponse>(
     endpoint,
     data,
     {
       offline: true,
       showError: true,
     },
     {
       endpoint,
       method: 'POST',
       entity: 'contact',
       priority: 'medium',
     }
   );

   // Clear conversation cache
   if (data.contactObjectId) {  // Changed from contactId
     await this.clearCache(`@lpai_cache_GET_/api/contacts/${data.contactObjectId}/conversations`);
   }
   
   return response;
 }

 /**
  * Send signed contract email
  */
 async sendContract(data: SendContractInput): Promise<SendContractResponse> {
   const endpoint = '/api/emails/send-contract';
   
   const response = await this.post<SendContractResponse>(
     endpoint,
     data,
     {
       offline: false, // Don't queue contract emails
       showError: true,
     },
     {
       endpoint,
       method: 'POST',
       entity: 'quote',
       priority: 'high',
     }
   );
   
   return response;
 }

 /**
  * Send quote email
  */
 async sendQuote(
   quoteId: string,
   locationId: string,
   contactObjectId: string,  // Changed from contactId
   options?: {
     includeLink?: boolean;
     includePDF?: boolean;
     customMessage?: string;
   }
 ): Promise<SendEmailResponse> {
   // This would need backend implementation
   // For now, use general send with quote details
   const subject = 'Your Quote is Ready';
   const htmlContent = options?.customMessage || 
     '<p>Your quote is ready for review. Please find the details attached.</p>';
   
   return this.send({
     contactObjectId,  // Changed from contactId
     locationId,
     subject,
     htmlContent,
     projectId: quoteId, // Using as reference
   });
 }

 /**
  * Send appointment confirmation
  */
 async sendAppointmentConfirmation(
   appointmentId: string,
   contactObjectId: string,  // Changed from contactId
   locationId: string,
   appointmentDetails: {
     title: string;
     date: string;
     time: string;
     location: string;
     technicianName?: string;
   }
 ): Promise<SendEmailResponse> {
   const subject = `Appointment Confirmation - ${appointmentDetails.date}`;
   const htmlContent = `
     <h2>Appointment Confirmed</h2>
     <p>Your appointment has been scheduled:</p>
     <ul>
       <li><strong>Service:</strong> ${appointmentDetails.title}</li>
       <li><strong>Date:</strong> ${appointmentDetails.date}</li>
       <li><strong>Time:</strong> ${appointmentDetails.time}</li>
       <li><strong>Location:</strong> ${appointmentDetails.location}</li>
       ${appointmentDetails.technicianName ? 
         `<li><strong>Technician:</strong> ${appointmentDetails.technicianName}</li>` : ''
       }
     </ul>
     <p>We'll see you then!</p>
   `;
   
   return this.send({
     contactObjectId,  // Changed from contactId
     locationId,
     subject,
     htmlContent,
     appointmentId,
   });
 }

 /**
  * Send payment receipt
  */
 async sendPaymentReceipt(
   paymentId: string,
   contactObjectId: string,  // Changed from contactId
   locationId: string,
   paymentDetails: {
     amount: number;
     invoiceNumber: string;
     projectName: string;
     paymentMethod: string;
     paidAt: string;
   }
 ): Promise<SendEmailResponse> {
   const subject = `Payment Receipt - ${paymentDetails.invoiceNumber}`;
   const htmlContent = `
     <h2>Payment Received</h2>
     <p>Thank you for your payment!</p>
     <table style="width: 100%; border-collapse: collapse;">
       <tr>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">Invoice Number:</td>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">${paymentDetails.invoiceNumber}</td>
       </tr>
       <tr>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">Project:</td>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">${paymentDetails.projectName}</td>
       </tr>
       <tr>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">Amount Paid:</td>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${paymentDetails.amount.toFixed(2)}</td>
       </tr>
       <tr>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">Payment Method:</td>
         <td style="padding: 8px; border-bottom: 1px solid #ddd;">${paymentDetails.paymentMethod}</td>
       </tr>
       <tr>
         <td style="padding: 8px;">Date:</td>
         <td style="padding: 8px;">${paymentDetails.paidAt}</td>
       </tr>
     </table>
     <p>This receipt confirms your payment has been processed successfully.</p>
   `;
   
   return this.send({
     contactObjectId,  // Changed from contactId
     locationId,
     subject,
     htmlContent,
     projectId: paymentId, // Using as reference
   });
 }

 /**
  * Send follow-up email
  */
 async sendFollowUp(
   contactObjectId: string,  // Changed from contactId
   locationId: string,
   projectId: string,
   type: 'quote_followup' | 'job_complete' | 'satisfaction' | 'custom',
   customContent?: {
     subject?: string;
     message?: string;
   }
 ): Promise<SendEmailResponse> {
   let subject = customContent?.subject || '';
   let htmlContent = customContent?.message || '';
   
   // Default templates based on type
   switch (type) {
     case 'quote_followup':
       subject = subject || 'Following up on your quote';
       htmlContent = htmlContent || `
         <p>I wanted to follow up on the quote we sent you.</p>
         <p>Do you have any questions or would you like to discuss the details?</p>
         <p>We're here to help make your project a success!</p>
       `;
       break;
       
     case 'job_complete':
       subject = subject || 'Your project is complete!';
       htmlContent = htmlContent || `
         <p>Great news! We've completed work on your project.</p>
         <p>Thank you for choosing us for your service needs.</p>
         <p>If you have any questions or concerns, please don't hesitate to reach out.</p>
       `;
       break;
       
     case 'satisfaction':
       subject = subject || 'How was your experience?';
       htmlContent = htmlContent || `
         <p>We hope you're satisfied with our recent service.</p>
         <p>Your feedback is important to us. How was your experience?</p>
         <p>If there's anything we can improve, please let us know!</p>
       `;
       break;
   }
   
   return this.send({
     contactObjectId,  // Changed from contactId
     locationId,
     subject,
     htmlContent,
     projectId,
   });
 }

 /**
  * Send bulk email (to multiple contacts)
  */
 async sendBulk(
   contactObjectIds: string[],  // Changed from contactIds
   locationId: string,
   content: {
     subject: string;
     htmlContent: string;
     plainTextContent?: string;
   },
   options?: {
     batchSize?: number;
     delayMs?: number;
   }
 ): Promise<{
   sent: number;
   failed: number;
   results: Array<{ contactObjectId: string; success: boolean; error?: string }>;  // Changed from contactId
 }> {
   const batchSize = options?.batchSize || 10;
   const delayMs = options?.delayMs || 1000;
   const results: Array<any> = [];
   let sent = 0;
   let failed = 0;
   
   // Process in batches
   for (let i = 0; i < contactObjectIds.length; i += batchSize) {
     const batch = contactObjectIds.slice(i, i + batchSize);
     
     const batchPromises = batch.map(async (contactObjectId) => {  // Changed from contactId
       try {
         await this.send({
           contactObjectId,  // Changed from contactId
           locationId,
           ...content,
         });
         
         sent++;
         return { contactObjectId, success: true };  // Changed from contactId
       } catch (error) {
         failed++;
         return { 
           contactObjectId,  // Changed from contactId
           success: false, 
           error: error instanceof Error ? error.message : 'Failed to send'
         };
       }
     });
     
     const batchResults = await Promise.all(batchPromises);
     results.push(...batchResults);
     
     // Delay between batches
     if (i + batchSize < contactObjectIds.length) {
       await new Promise(resolve => setTimeout(resolve, delayMs));
     }
   }
   
   return { sent, failed, results };
 }

 /**
  * Reply to email thread
  */
 async reply(
   originalMessageId: string,
   contactObjectId: string,  // Changed from contactId
   locationId: string,
   content: {
     subject: string;
     htmlContent: string;
     plainTextContent?: string;
   }
 ): Promise<SendEmailResponse> {
   return this.send({
     ...content,
     contactObjectId,  // Changed from contactId
     locationId,
     replyToMessageId: originalMessageId,
   });
 }

 /**
  * Get email templates (would need backend implementation)
  */
 async getTemplates(
   locationId: string,
   category?: string
 ): Promise<EmailTemplate[]> {
   // This would need backend endpoint
   // For now, return empty array
   return [];
 }
}

export const emailService = new EmailService();