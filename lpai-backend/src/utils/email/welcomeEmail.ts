// src/utils/email/welcomeEmail.ts
import { emailService } from './emailService';

export async function sendWelcomeEmail(params: {
  email: string;
  firstName: string;
  locationName: string;
  setupToken: string;
  setupUrl: string;
}) {
  const { email, firstName, locationName, setupToken, setupUrl } = params;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Welcome to LPai, ${firstName}! 🎉</h1>
      
      <p>Your account has been created for ${locationName}.</p>
      
      <p>To get started, please set up your password:</p>
      
      <div style="margin: 30px 0;">
        <a href="https://lpai-backend-omega.vercel.app/setup-account.html?token=${setupUrl}" 
           style="background: #4CAF50; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
          Set Up My Account
        </a>
      </div>
      
      <p>This link will expire in 7 days for security reasons.</p>
      
      <p>If you didn't expect this email, please ignore it.</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      
      <p style="color: #666; font-size: 12px;">
        This is an automated message from LPai. 
        If you need help, contact support at support@lpai.app
      </p>
    </div>
  `;

  await emailService.send({
    to: email,
    subject: `Welcome to LPai - Set Up Your Account`,
    html,
  });
}