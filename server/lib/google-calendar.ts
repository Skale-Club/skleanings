import { OAuth2Client } from "google-auth-library";
import type { IStorage } from "../storage";
import { sendCalendarDisconnectNotification } from "../integrations/twilio";

// In-memory cache for GCal busy times — 10-minute TTL
// Key: `${staffMemberId}:${date}` → { data, expiresAt }
const busyTimesCache = new Map<string, {
  data: { start: string; end: string }[];
  expiresAt: number;
}>();

const BUSY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function clearBusyTimesCache(staffMemberId: number, date: string): void {
  busyTimesCache.delete(`${staffMemberId}:${date}`);
}

async function createOAuth2Client(storage: IStorage): Promise<OAuth2Client> {
  const creds = await storage.getIntegrationSettings("google-calendar");
  if (!creds?.apiKey || !creds?.locationId) {
    throw new Error("Google Calendar credentials not configured. Set Client ID and Client Secret in Admin → Integrations.");
  }
  const redirectUri = creds.calendarId || process.env.GOOGLE_REDIRECT_URI || "";
  return new OAuth2Client(creds.apiKey, creds.locationId, redirectUri);
}

export async function getAuthUrl(storage: IStorage, staffId: number, redirectTo: "staff" | "admin" = "admin"): Promise<string> {
  const client = await createOAuth2Client(storage);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token on every connect
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    state: `${staffId}:${redirectTo}`,
  });
}

export async function exchangeCodeForTokens(
  storage: IStorage,
  code: string,
  staffId: number
): Promise<void> {
  const client = await createOAuth2Client(storage);
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("OAuth token exchange did not return required tokens");
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  await storage.upsertStaffGoogleCalendar({
    staffMemberId: staffId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    calendarId: "primary",
    tokenExpiresAt: expiresAt,
  });
}

/**
 * Get a valid access token for a staff member, refreshing if expired.
 * Returns null if the staff member has no connected calendar.
 */
export async function getValidAccessToken(storage: IStorage, staffMemberId: number): Promise<string | null> {
  const record = await storage.getStaffGoogleCalendar(staffMemberId);
  if (!record) return null;

  const now = new Date();
  const expiresAt = new Date(record.tokenExpiresAt);

  // Return cached token if not expiring within 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return record.accessToken;
  }

  // Refresh token
  try {
    const client = await createOAuth2Client(storage);
    client.setCredentials({ refresh_token: record.refreshToken });
    const { credentials } = await client.refreshAccessToken();

    if (!credentials.access_token) return null;

    const newExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await storage.upsertStaffGoogleCalendar({
      staffMemberId,
      accessToken: credentials.access_token,
      refreshToken: record.refreshToken,
      calendarId: record.calendarId,
      tokenExpiresAt: newExpiry,
    });

    return credentials.access_token;
  } catch {
    // Mark the calendar as needing reconnect and notify admin via SMS
    try {
      await storage.markCalendarNeedsReconnect(staffMemberId);
      const twilioSettings = await storage.getTwilioSettings();
      if (twilioSettings) {
        const calRecord = await storage.getStaffGoogleCalendar(staffMemberId);
        if (calRecord) {
          const member = await storage.getStaffMember(staffMemberId);
          if (member) {
            const staffName = `${member.firstName} ${member.lastName}`;
            await sendCalendarDisconnectNotification(storage, staffName, twilioSettings);
          }
        }
      }
    } catch {
      // Notification failure must never break the availability engine
    }
    return null;
  }
}

/**
 * Fetch busy time intervals for a staff member on a given date.
 * Returns array of { start, end } in HH:MM format (local time in timeZone).
 * Returns [] if staff has no connected calendar or on any error.
 */
export async function getStaffBusyTimes(
  staffMemberId: number,
  date: string,
  timeZone: string = "America/New_York",
  storage?: IStorage
): Promise<{ start: string; end: string }[]> {
  if (!storage) return [];
  try {
    // Check cache first
    const cacheKey = `${staffMemberId}:${date}`;
    const cached = busyTimesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const accessToken = await getValidAccessToken(storage, staffMemberId);
    if (!accessToken) return [];

    const record = await storage.getStaffGoogleCalendar(staffMemberId);
    if (!record) return [];

    const timeMin = new Date(`${date}T00:00:00`);
    const timeMax = new Date(`${date}T23:59:59`);

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          timeZone,
          items: [{ id: record.calendarId }],
        }),
      }
    );

    if (!response.ok) return [];

    const data = await response.json() as {
      calendars: Record<string, { busy: { start: string; end: string }[] }>;
    };

    const busyIntervals = data.calendars?.[record.calendarId]?.busy ?? [];

    const result = busyIntervals.map((interval) => ({
      start: new Date(interval.start).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      }),
      end: new Date(interval.end).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      }),
    }));

    busyTimesCache.set(cacheKey, { data: result, expiresAt: Date.now() + BUSY_CACHE_TTL_MS });
    return result;
  } catch {
    return [];
  }
}
