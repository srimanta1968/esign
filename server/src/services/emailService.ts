/**
 * EmailService handles email delivery via SendGrid (primary) or nodemailer (fallback).
 */

let sgMail: any;
try {
  sgMail = require('@sendgrid/mail');
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
} catch {
  sgMail = null;
}

let nodemailer: any;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const DEFAULT_FROM = {
  email: process.env.EMAIL_FROM || 'noreply@edocsign.com',
  name: 'eDocSign',
};

export class EmailService {
  private static transporter: any = null;

  /**
   * Send an email via SendGrid (if configured), nodemailer (fallback), or console (dev).
   */
  static async send(to: string, subject: string, body: string): Promise<{ success: boolean; messageId?: string; previewUrl?: string | false; error?: string }> {
    // Try SendGrid first
    if (sgMail && process.env.SENDGRID_API_KEY) {
      try {
        const [response] = await sgMail.send({
          to,
          from: DEFAULT_FROM,
          replyTo: DEFAULT_FROM,
          subject,
          html: body,
          headers: {
            'X-Priority': '1',
          },
          mailSettings: {
            bypassListManagement: { enable: false },
          },
          trackingSettings: {
            clickTracking: { enable: false },
            openTracking: { enable: false },
          },
        });
        const messageId = response?.headers?.['x-message-id'] || `sg-${Date.now()}`;
        console.log(`Email sent via SendGrid to ${to}: ${messageId}`);
        return { success: true, messageId };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'SendGrid error';
        console.error('SendGrid send failed:', errorMessage);
        // Fall through to nodemailer
      }
    }

    // Fallback to nodemailer
    try {
      const transporter = await EmailService.getTransporter();

      if (!transporter) {
        const messageId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        console.log('=== EMAIL (console fallback) ===');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`MessageId: ${messageId}`);
        console.log('=== END EMAIL ===');
        return { success: true, messageId };
      }

      const info = await transporter.sendMail({
        from: DEFAULT_FROM,
        to,
        subject,
        html: body,
      });

      const previewUrl = nodemailer ? nodemailer.getTestMessageUrl(info) : false;
      console.log(`Email sent via nodemailer to ${to}: ${info.messageId}`);
      if (previewUrl) console.log(`Preview URL: ${previewUrl}`);

      return { success: true, messageId: info.messageId, previewUrl };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown email error';
      console.error('Email send failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get or create the nodemailer transporter (fallback).
   */
  private static async getTransporter(): Promise<any> {
    if (EmailService.transporter) return EmailService.transporter;
    if (!nodemailer) return null;

    if (process.env.SMTP_HOST) {
      EmailService.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      EmailService.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    }

    return EmailService.transporter;
  }

  /**
   * Send a notification email with standard formatting.
   */
  static async sendNotification(
    to: string,
    notificationType: string,
    message: string,
    actionUrl?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = `eDocs Notification: ${notificationType.replace(/_/g, ' ')}`;
    let body = `<p>${message}</p>`;
    if (actionUrl) {
      body += `<p><a href="${actionUrl}">View details</a></p>`;
    }
    return EmailService.send(to, subject, body);
  }

  /**
   * Send a signature confirmation email.
   */
  static async sendSignatureConfirmation(
    recipientEmail: string,
    signerName: string,
    documentInfo: { documentId: string; documentName?: string },
    confirmationStatus: string
  ): Promise<{ success: boolean; messageId?: string; previewUrl?: string | false; error?: string }> {
    const statusLabel = confirmationStatus === 'confirmed' ? 'Confirmed' : 'Rejected';
    const subject = `Signature ${statusLabel} - ${documentInfo.documentName || 'Document'}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Signature ${statusLabel}</h2>
        <p>Hello,</p>
        <p>The signature by <strong>${signerName}</strong> on document
          <strong>${documentInfo.documentName || documentInfo.documentId}</strong>
          has been <strong>${statusLabel.toLowerCase()}</strong>.</p>
        <p>Document ID: ${documentInfo.documentId}</p>
        <p>Status: ${statusLabel}</p>
        <hr />
        <p style="color: #888; font-size: 12px;">This is an automated notification from eDocs.</p>
      </div>
    `;

    return EmailService.send(recipientEmail, subject, htmlBody);
  }

  /**
   * Send signed document email with download links.
   */
  static async sendSignedDocumentEmail(
    recipients: string[],
    signedPdfUrl: string,
    certificateUrl: string,
    documentName: string
  ): Promise<{ success: boolean; sent: number; errors: string[] }> {
    const errors: string[] = [];
    let sent = 0;

    const subject = `Document Signed: ${documentName}`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">
          <tr>
            <td style="background-color: #059669; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">eDocSign</h1>
              <p style="margin: 6px 0 0; color: #d1fae5; font-size: 14px;">Document Signing Complete</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px;">
                All parties have signed <strong>${documentName}</strong>.
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 24px;">
                You can download the signed document and signing certificate using the buttons below.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${signedPdfUrl}"
                       style="display: inline-block; background-color: #1a56db; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Download Signed Document
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${certificateUrl}"
                       style="display: inline-block; background-color: #6b7280; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Download Signing Certificate
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">
                These download links will expire in 7 days. Please save the documents for your records.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                This is an automated notification from eDocSign. The signing certificate contains a SHA-256 hash
                of the original document and a full audit trail of all signing activity.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    for (const recipientEmail of recipients) {
      try {
        const result = await EmailService.send(recipientEmail, subject, htmlBody);
        if (result.success) {
          sent++;
        } else {
          errors.push(`${recipientEmail}: ${result.error}`);
        }
      } catch (error: unknown) {
        errors.push(`${recipientEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success: errors.length === 0, sent, errors };
  }
}

export default EmailService;
