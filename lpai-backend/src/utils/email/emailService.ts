// /src/utils/email/emailService.ts
import { Resend } from 'resend';

export class EmailService {
  private resend: Resend;
  
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }
  
  async sendReport(options: {
    to: string[];
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'LPai Reports <reports@leadprospecting.ai>',
        to: options.to,
        subject: options.subject,
        html: options.html
      });
      
      if (error) {
        console.error('[Email Service] Failed to send report:', error);
        throw error;
      }
      
      console.log('[Email Service] Report sent successfully:', data);
    } catch (error) {
      console.error('[Email Service] Error sending email:', error);
      throw error;
    }
  }
}