import type { TwilioSettings } from "@shared/schema";
import {
  type BookingNotificationPayload,
  buildBookingNotification,
  buildNewChatNotification,
  renderNotificationPlain,
} from "../lib/notification-templates";
import { logNotification } from "../lib/notification-logger";

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
      try {
        const result = await client.messages.create({
          body: message,
          from: twilioSettings.fromPhoneNumber,
          to: phoneNumber,
        });
        await logNotification({
          channel: "sms",
          trigger: "new_chat",
          recipient: phoneNumber,
          preview: message,
          status: "sent",
          providerMessageId: result.sid,
          conversationId,
        });
      } catch (err: any) {
        await logNotification({
          channel: "sms",
          trigger: "new_chat",
          recipient: phoneNumber,
          preview: message,
          status: "failed",
          errorMessage: err?.message,
          conversationId,
        });
        throw err;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Twilio notification:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}

export async function sendCalendarDisconnectNotification(
  staffName: string,
  twilioSettings: TwilioSettings
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled || !twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumbers || twilioSettings.toPhoneNumbers.length === 0) {
      return { success: false, message: "Twilio settings incomplete or disabled" };
    }

    const { default: twilio } = await import("twilio");
    const client = twilio(twilioSettings.accountSid, twilioSettings.authToken);
    const body = `⚠️ Google Calendar disconnected for ${staffName}. Please reconnect at Admin → Staff → Calendar.`;

    for (const phoneNumber of twilioSettings.toPhoneNumbers) {
      try {
        const result = await client.messages.create({
          body,
          from: twilioSettings.fromPhoneNumber,
          to: phoneNumber,
        });
        await logNotification({
          channel: "sms",
          trigger: "calendar_disconnect",
          recipient: phoneNumber,
          preview: body,
          status: "sent",
          providerMessageId: result.sid,
        });
      } catch (err: any) {
        await logNotification({
          channel: "sms",
          trigger: "calendar_disconnect",
          recipient: phoneNumber,
          preview: body,
          status: "failed",
          errorMessage: err?.message,
        });
        throw err;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send calendar disconnect notification:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}

export async function sendBookingNotification(
  booking: BookingNotificationPayload,
  serviceNames: string[],
  twilioSettings: TwilioSettings,
  companyName?: string,
  bookingId?: number
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
      try {
        const result = await client.messages.create({
          body: message,
          from: twilioSettings.fromPhoneNumber,
          to: phoneNumber,
        });
        await logNotification({
          channel: "sms",
          trigger: "new_booking",
          recipient: phoneNumber,
          preview: message,
          status: "sent",
          providerMessageId: result.sid,
          bookingId,
        });
      } catch (err: any) {
        await logNotification({
          channel: "sms",
          trigger: "new_booking",
          recipient: phoneNumber,
          preview: message,
          status: "failed",
          errorMessage: err?.message,
          bookingId,
        });
        throw err;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Twilio booking notification:", error);
    return { success: false, message: error?.message || "Unknown error" };
  }
}
