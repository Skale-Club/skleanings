import type { Booking } from "@shared/schema";
import type { IStorage } from "../storage";
import {
  createGHLAppointment,
  getOrCreateGHLContact,
  formatDateTimeWithTimezone,
  updateGHLContact,
} from "../integrations/ghl";
import { logNotification } from "./notification-logger";
import { getVisitorSession } from "../storage/analytics";

export interface BookingGhlSyncResult {
  attempted: boolean;
  synced: boolean;
  contactId?: string;
  appointmentId?: string;
  reason?: string;
}

export async function syncBookingToGhl(
  storage: IStorage,
  booking: Booking,
  serviceSummary?: string,
): Promise<BookingGhlSyncResult> {
  try {
    const settings = await storage.getIntegrationSettings("gohighlevel");
    if (!settings?.isEnabled || !settings.apiKey || !settings.locationId || !settings.calendarId) {
      return {
        attempted: false,
        synced: false,
        reason: "GHL not enabled or missing required settings",
      };
    }

    const nameParts = booking.customerName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const contactResult = await getOrCreateGHLContact(settings.apiKey, settings.locationId, {
      email: booking.customerEmail || "",
      firstName,
      lastName,
      phone: booking.customerPhone,
      address: booking.customerAddress,
    });

    await logNotification({
      channel: "ghl",
      trigger: "new_booking",
      recipient: booking.customerEmail || booking.customerPhone,
      preview: `Contact: ${booking.customerName} (${booking.customerPhone})`,
      status: contactResult.success && contactResult.contactId ? "sent" : "failed",
      providerMessageId: contactResult.contactId,
      errorMessage: contactResult.success ? undefined : contactResult.message,
      bookingId: booking.id,
    });

    if (!contactResult.success || !contactResult.contactId) {
      await storage.updateBookingGHLSync(booking.id, "", "", "failed");
      return {
        attempted: true,
        synced: false,
        reason: contactResult.message || "Failed to create or find contact in GHL",
      };
    }

    // GHL-01, GHL-02: Write UTM attribution custom fields to GHL contact (fire-and-forget).
    // D-13: Fires after contact found/created. Never blocks booking or main sync.
    // D-15: Skip entirely if utm_session_id is null (anonymous visitor).
    if (booking.utmSessionId) {
      void (async () => {
        try {
          const session = await getVisitorSession(booking.utmSessionId!);
          if (session) {
            const customFields: Array<{ key: string; value: string }> = [];
            // D-11: Fixed field keys — admin creates these custom fields in GHL once.
            if (session.firstUtmSource)   customFields.push({ key: 'utm_first_source',   value: session.firstUtmSource });
            if (session.firstUtmCampaign) customFields.push({ key: 'utm_first_campaign', value: session.firstUtmCampaign });
            if (session.lastUtmSource)    customFields.push({ key: 'utm_last_source',    value: session.lastUtmSource });
            if (session.lastUtmCampaign)  customFields.push({ key: 'utm_last_campaign',  value: session.lastUtmCampaign });
            if (customFields.length > 0) {
              await updateGHLContact(settings.apiKey!, contactResult.contactId!, { customFields });
              console.log(`[GHL] UTM custom fields written for contact ${contactResult.contactId}`);
            }
          }
        } catch (utmErr: any) {
          // Fire-and-forget: log but never propagate — contact/appointment sync is primary.
          console.log(`[GHL] UTM custom field write failed (non-fatal): ${utmErr?.message}`);
        }
      })();
    } else {
      console.debug(`[GHL] Skipping UTM custom fields — booking ${booking.id} has no utm_session_id`);
    }

    const companySettings = await storage.getCompanySettings();
    const timeZone = companySettings?.timeZone || "America/New_York";

    const appointmentResult = await createGHLAppointment(
      settings.apiKey,
      settings.calendarId,
      settings.locationId,
      {
        contactId: contactResult.contactId,
        startTime: formatDateTimeWithTimezone(booking.bookingDate, booking.startTime, timeZone),
        endTime: formatDateTimeWithTimezone(booking.bookingDate, booking.endTime, timeZone),
        title: serviceSummary
          ? `Cleaning: ${serviceSummary}`
          : `Cleaning: ${booking.customerName} - ${booking.totalDurationMinutes} mins`,
        address: booking.customerAddress,
      },
    );

    if (!appointmentResult.success || !appointmentResult.appointmentId) {
      await storage.updateBookingGHLSync(booking.id, contactResult.contactId, "", "failed");
      return {
        attempted: true,
        synced: false,
        contactId: contactResult.contactId,
        reason: appointmentResult.message || "Failed to create appointment in GHL",
      };
    }

    await storage.updateBookingGHLSync(
      booking.id,
      contactResult.contactId,
      appointmentResult.appointmentId,
      "synced",
    );

    return {
      attempted: true,
      synced: true,
      contactId: contactResult.contactId,
      appointmentId: appointmentResult.appointmentId,
    };
  } catch (error: any) {
    return {
      attempted: true,
      synced: false,
      reason: error?.message || "Unexpected error while syncing booking to GHL",
    };
  }
}
