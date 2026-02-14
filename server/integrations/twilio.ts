import type { TwilioSettings } from "@shared/schema";

export async function sendNewChatNotification(
  twilioSettings: TwilioSettings,
  conversationId: string,
  pageUrl?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled || !twilioSettings.notifyOnNewChat) {
      return { success: false, message: 'Twilio notifications are disabled' };
    }

    if (!twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumbers || twilioSettings.toPhoneNumbers.length === 0) {
      return { success: false, message: 'Twilio settings are incomplete' };
    }

    const twilio = await import('twilio');
    const client = twilio.default(twilioSettings.accountSid, twilioSettings.authToken);

    const message = `🔔 New chat started on Skleanings!\n\nConversation ID: ${conversationId.slice(0, 8)}...\nPage: ${pageUrl || 'Unknown'}`;

    // Send SMS to all configured phone numbers
    for (const phoneNumber of twilioSettings.toPhoneNumbers) {
      await client.messages.create({
        body: message,
        from: twilioSettings.fromPhoneNumber,
        to: phoneNumber
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send Twilio notification:', error);
    return { success: false, message: error?.message || 'Unknown error' };
  }
}

export async function sendBookingNotification(
  booking: any, // Using any to avoid circular import of Booking type
  twilioSettings: TwilioSettings
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled || !twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumbers || twilioSettings.toPhoneNumbers.length === 0) {
      return { success: false, message: 'Twilio settings are incomplete' };
    }

    const { default: twilio } = await import('twilio');
    const client = twilio(twilioSettings.accountSid, twilioSettings.authToken);

    const message = `📅 New Booking Received!\n\nCustomer: ${booking.customerName}\nTime: ${booking.bookingDate} at ${booking.startTime}\n\nPlease check admin dashboard for details.`;

    // Send SMS to all configured phone numbers
    for (const phoneNumber of twilioSettings.toPhoneNumbers) {
      await client.messages.create({
        body: message,
        from: twilioSettings.fromPhoneNumber,
        to: phoneNumber
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send Twilio booking notification:', error);
    return { success: false, message: error?.message || 'Unknown error' };
  }
}
