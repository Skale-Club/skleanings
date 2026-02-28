import type { TwilioSettings } from "@shared/schema";
import {
  type BookingNotificationPayload,
  buildBookingNotification,
  buildNewChatNotification,
  renderNotificationPlain,
} from "../lib/notification-templates";

export async function sendNewChatNotification(
  twilioSettings: TwilioSettings,
  conversationId: string,
  pageUrl?: string,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled || !twilioSettings.notifyOnNewChat) {
      return { success: false, message: "Twilio notifications are disabled" };
    }

    if (!twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumbers || twilioSettings.toPhoneNumbers.length === 0) {
      return { success: false, message: "Twilio settings are incomplete" };
    }

    const twilio = await import("twilio");
    const client = twilio.default(twilioSettings.accountSid, twilioSettings.authToken);
    const message = renderNotificationPlain(
      buildNewChatNotification(conversationId, pageUrl, companyName)
    );

    for (const phoneNumber of twilioSettings.toPhoneNumbers) {
      await client.messages.create({
        body: message,
        from: twilioSettings.fromPhoneNumber,
        to: phoneNumber,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Twilio notification:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}

export async function sendBookingNotification(
  booking: BookingNotificationPayload,
  serviceNames: string[],
  twilioSettings: TwilioSettings,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled || !twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumbers || twilioSettings.toPhoneNumbers.length === 0) {
      return { success: false, message: "Twilio settings are incomplete" };
    }

    const { default: twilio } = await import("twilio");
    const client = twilio(twilioSettings.accountSid, twilioSettings.authToken);
    const message = renderNotificationPlain(
      buildBookingNotification(booking, serviceNames, companyName)
    );

    for (const phoneNumber of twilioSettings.toPhoneNumbers) {
      await client.messages.create({
        body: message,
        from: twilioSettings.fromPhoneNumber,
        to: phoneNumber,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Twilio booking notification:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}
