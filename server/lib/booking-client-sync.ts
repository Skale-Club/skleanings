import type { Booking } from "@shared/schema";
import { storage } from "../storage";
import { deleteGHLAppointment, updateGHLAppointment, formatDateTimeWithTimezone } from "../integrations/ghl";
import { sendMessageToAll } from "../integrations/telegram";

async function notifyAdminTwilio(message: string): Promise<void> {
    try {
        const twilioSettings = await storage.getTwilioSettings();
        if (
            !twilioSettings?.enabled ||
            !twilioSettings.accountSid ||
            !twilioSettings.authToken ||
            !twilioSettings.fromPhoneNumber ||
            !twilioSettings.toPhoneNumbers?.length
        ) return;
        const { default: twilio } = await import("twilio");
        const client = twilio(twilioSettings.accountSid, twilioSettings.authToken);
        for (const to of twilioSettings.toPhoneNumbers) {
            await client.messages.create({ body: message, from: twilioSettings.fromPhoneNumber, to });
        }
    } catch (err) {
        console.error("[ClientSync] Twilio notification failed:", err);
    }
}

async function notifyAdminTelegram(message: string): Promise<void> {
    try {
        const telegramSettings = await storage.getTelegramSettings();
        if (!telegramSettings?.enabled || !telegramSettings.botToken || !telegramSettings.chatIds?.length) return;
        await sendMessageToAll(telegramSettings, message);
    } catch (err) {
        console.error("[ClientSync] Telegram notification failed:", err);
    }
}

export async function syncClientCancelToExternal(booking: Booking): Promise<void> {
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");
        if (settings?.isEnabled && settings.apiKey && booking.ghlAppointmentId) {
            const result = await deleteGHLAppointment(settings.apiKey, booking.ghlAppointmentId);
            if (!result.success) {
                console.error("[ClientSync] GHL delete failed:", result.message);
            }
        }
    } catch (err) {
        console.error("[ClientSync] GHL cancel sync error:", err);
    }

    const msg = `❌ Client cancelled booking #${booking.id} for ${booking.bookingDate} (${booking.customerName})`;
    await Promise.allSettled([notifyAdminTwilio(msg), notifyAdminTelegram(msg)]);
}

export async function syncClientRescheduleToExternal(
    booking: Booking,
    newDate: string,
    newStart: string,
    newEnd: string
): Promise<void> {
    try {
        const [settings, companySettings] = await Promise.all([
            storage.getIntegrationSettings("gohighlevel"),
            storage.getCompanySettings(),
        ]);
        const timeZone = companySettings?.timeZone || "America/New_York";

        if (settings?.isEnabled && settings.apiKey && booking.ghlAppointmentId) {
            const result = await updateGHLAppointment(settings.apiKey, booking.ghlAppointmentId, {
                startTime: formatDateTimeWithTimezone(newDate, newStart, timeZone),
                endTime: formatDateTimeWithTimezone(newDate, newEnd, timeZone),
            });
            if (!result.success) {
                console.error("[ClientSync] GHL reschedule update failed:", result.message);
            }
        }
    } catch (err) {
        console.error("[ClientSync] GHL reschedule sync error:", err);
    }

    const msg = `🔄 Client rescheduled booking #${booking.id} to ${newDate} ${newStart}–${newEnd} (${booking.customerName})`;
    await Promise.allSettled([notifyAdminTwilio(msg), notifyAdminTelegram(msg)]);
}
