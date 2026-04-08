/**
 * SmsService handles SMS notification delivery.
 * Currently a stub that logs to console in development.
 * Ready for Twilio integration in production.
 */
export class SmsService {
  /**
   * Send an SMS notification.
   * In dev mode, logs to console. In production, would use Twilio SDK.
   */
  static async send(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Development mode: log SMS to console
      const messageId = `sms-dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      console.log('=== SMS NOTIFICATION ===');
      console.log(`To: ${to}`);
      console.log(`Message: ${message}`);
      console.log(`MessageId: ${messageId}`);
      console.log('=== END SMS ===');

      // TODO: Production Twilio integration
      // const client = twilio(accountSid, authToken);
      // const result = await client.messages.create({ body: message, from: twilioNumber, to });

      return { success: true, messageId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SMS error';
      console.error('SMS send failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a notification SMS with standard formatting.
   */
  static async sendNotification(
    to: string,
    message: string,
    actionUrl?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let smsBody = `eDocs: ${message}`;
    if (actionUrl) {
      smsBody += ` - ${actionUrl}`;
    }
    return SmsService.send(to, smsBody);
  }
}

export default SmsService;
