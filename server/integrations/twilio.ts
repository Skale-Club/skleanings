import type { TwilioSettings } from "@shared/schema";

type BookingNotificationPayload = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  customerAddress?: string;
  bookingDate?: string;
  startTime?: string;
  totalPrice?: string | number;
};

function formatBookingDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDate);
}

function formatBookingTime(time?: string): string {
  if (!time) return "N/A";
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;

  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${minute} ${period}`;
}

function formatMoney(totalPrice?: string | number): string {
  if (totalPrice === undefined || totalPrice === null) return "N/A";
  const value = typeof totalPrice === "number" ? totalPrice : Number(totalPrice);
  if (Number.isNaN(value)) return String(totalPrice);
  return value.toFixed(2);
}

export async function sendNewChatNotification(
  twilioSettings: TwilioSettings,
  conversationId: string,
  pageUrl?: string
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

    const message = `🔔 New chat started on Skleanings!\n\nConversation ID: ${conversationId.slice(0, 8)}...\nPage: ${pageUrl || "Unknown"}`;

    // Send SMS to all configured phone numbers
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
  twilioSettings: TwilioSettings
): Promise<{ success: boolean; message?: string }> {
  try {
    if (!twilioSettings.enabled || !twilioSettings.accountSid || !twilioSettings.authToken || !twilioSettings.fromPhoneNumber || !twilioSettings.toPhoneNumbers || twilioSettings.toPhoneNumbers.length === 0) {
      return { success: false, message: "Twilio settings are incomplete" };
    }

    const { default: twilio } = await import("twilio");
    const client = twilio(twilioSettings.accountSid, twilioSettings.authToken);

    const servicesTitle = serviceNames.length > 1 ? "🧽 Service(s):" : "🧽 Service:";
    const servicesList = serviceNames.length > 0 ? serviceNames.map((service) => `- ${service}`).join("\n") : "- N/A";

    const message =
      `📥 New Booking Confirmed | Skleanings\n\n` +
      `👤 Customer: ${booking.customerName || "N/A"}\n` +
      `📞 Phone: ${booking.customerPhone || "N/A"}\n` +
      `📧 Email: ${booking.customerEmail || "N/A"}\n\n` +
      `📅 Date: ${formatBookingDate(booking.bookingDate)}\n` +
      `⏰ Time: ${formatBookingTime(booking.startTime)} EST\n` +
      `🏠 Location: ${booking.customerAddress || "N/A"}\n\n` +
      `${servicesTitle}\n` +
      `${servicesList}\n\n` +
      `💵 Estimated Total: $${formatMoney(booking.totalPrice)}`;

    // Send SMS to all configured phone numbers
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
