import type { Booking } from "@shared/schema";
import { storage } from "../storage";
import {
  createGHLAppointment,
  getOrCreateGHLContact,
  formatDateTimeWithTimezone,
} from "../integrations/ghl";

export interface BookingGhlSyncResult {
  attempted: boolean;
  synced: boolean;
  contactId?: string;
  appointmentId?: string;
  reason?: string;
}

export async function syncBookingToGhl(
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

    if (!contactResult.success || !contactResult.contactId) {
      await storage.updateBookingGHLSync(booking.id, "", "", "failed");
      return {
        attempted: true,
        synced: false,
        reason: contactResult.message || "Failed to create or find contact in GHL",
      };
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
