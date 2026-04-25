import { db } from "../db";
import { visitorSessions, conversionEvents, bookings, type VisitorSession } from "@shared/schema";
import { eq } from "drizzle-orm";
import { classifyTraffic } from "../lib/traffic-classifier";

export interface UpsertSessionPayload {
  visitorId: string;
  utmSource:   string | null;
  utmMedium:   string | null;
  utmCampaign: string | null;
  utmTerm:     string | null;
  utmContent:  string | null;
  utmId:       string | null;
  referrer:    string | null;
  landingPage: string | null;
}

/**
 * Upsert a visitor session row.
 *
 * INVARIANT: Never update first_* columns on an existing row — first-touch
 * preservation is guaranteed here (CAPTURE-05). The UPDATE branch below
 * intentionally omits all first_* fields. Violating this invariant corrupts
 * attribution data permanently.
 *
 * LAST-TOUCH UPDATE RULE (D-02 / CAPTURE-06): last_* columns are only
 * updated when the request contains UTM parameters OR an identifiable
 * external referrer. Direct navigation (empty referrer, no UTMs) increments
 * visit_count and updates last_seen_at only — it does NOT overwrite the
 * last real marketing touch.
 */
export async function upsertVisitorSession(
  payload: UpsertSessionPayload,
): Promise<{ session: VisitorSession; isNew: boolean }> {
  // Server-side normalization safety net (D-04) — client should already normalize
  const normalize = (v: string | null | undefined): string | null =>
    v ? v.trim().toLowerCase() : null;

  const norm = {
    utmSource:   normalize(payload.utmSource),
    utmMedium:   normalize(payload.utmMedium),
    utmCampaign: normalize(payload.utmCampaign),
    utmTerm:     normalize(payload.utmTerm),
    utmContent:  normalize(payload.utmContent),
    utmId:       normalize(payload.utmId),
    // Referrer and landing page: trimmed but NOT lowercased (URLs are case-sensitive in path segments)
    referrer:    payload.referrer?.trim() || null,
    landingPage: payload.landingPage?.trim() || null,
  };

  const trafficSource = classifyTraffic(norm.utmSource, norm.utmMedium, norm.referrer);

  // Determine if this visit qualifies for a last-touch update (D-02)
  const hasMeaningfulSignal = !!(
    norm.utmSource ||
    (norm.referrer && !isSameDomain(norm.referrer))
  );

  // Check if row exists — select visitCount for the integer-increment pattern (avoids raw SQL)
  const existing = await db
    .select({ id: visitorSessions.id, visitCount: visitorSessions.visitCount })
    .from(visitorSessions)
    .where(eq(visitorSessions.id, payload.visitorId))
    .limit(1);

  if (existing.length === 0) {
    // INSERT — new visitor: write both first_* and last_* from this visit
    const [inserted] = await db
      .insert(visitorSessions)
      .values({
        id: payload.visitorId,
        firstUtmSource:    norm.utmSource,
        firstUtmMedium:    norm.utmMedium,
        firstUtmCampaign:  norm.utmCampaign,
        firstUtmTerm:      norm.utmTerm,
        firstUtmContent:   norm.utmContent,
        firstUtmId:        norm.utmId,
        firstLandingPage:  norm.landingPage,
        firstReferrer:     norm.referrer,
        firstTrafficSource: trafficSource,
        firstSeenAt:       new Date(),
        lastUtmSource:     norm.utmSource,
        lastUtmMedium:     norm.utmMedium,
        lastUtmCampaign:   norm.utmCampaign,
        lastUtmTerm:       norm.utmTerm,
        lastUtmContent:    norm.utmContent,
        lastUtmId:         norm.utmId,
        lastLandingPage:   norm.landingPage,
        lastReferrer:      norm.referrer,
        lastTrafficSource: trafficSource,
        lastSeenAt:        new Date(),
        visitCount:        1,
      })
      .returning();
    return { session: inserted, isNew: true };
  }

  // UPDATE — returning visitor
  // NEVER include first_* columns here — that is the invariant.
  const updateFields: Record<string, unknown> = {
    lastSeenAt:  new Date(),
    // Integer increment via select-first pattern (avoids raw SQL expression issues in Drizzle 0.39.3)
    visitCount:  (existing[0].visitCount ?? 0) + 1,
  };

  if (hasMeaningfulSignal) {
    updateFields.lastUtmSource    = norm.utmSource;
    updateFields.lastUtmMedium    = norm.utmMedium;
    updateFields.lastUtmCampaign  = norm.utmCampaign;
    updateFields.lastUtmTerm      = norm.utmTerm;
    updateFields.lastUtmContent   = norm.utmContent;
    updateFields.lastUtmId        = norm.utmId;
    updateFields.lastLandingPage  = norm.landingPage;
    updateFields.lastReferrer     = norm.referrer;
    updateFields.lastTrafficSource = trafficSource;
  }

  const [updated] = await db
    .update(visitorSessions)
    .set(updateFields)
    .where(eq(visitorSessions.id, payload.visitorId))
    .returning();

  return { session: updated, isNew: false };
}

/** Returns true if the referrer is from the same domain as the site (file-private). */
function isSameDomain(referrer: string): boolean {
  try {
    const ref = new URL(referrer);
    const appHost = process.env.APP_DOMAIN || process.env.VITE_APP_URL || "";
    if (!appHost) return false;
    const appHostname = appHost.startsWith("http") ? new URL(appHost).hostname : appHost;
    return ref.hostname === appHostname || ref.hostname.endsWith(`.${appHostname}`);
  } catch {
    return false;
  }
}

/**
 * Links a booking row to its visitor session.
 * Sets bookings.utm_session_id = session.id
 * Increments visitor_sessions.total_bookings and sets converted_at on first conversion.
 * D-03: silently returns if visitorId not found in visitor_sessions.
 */
export async function linkBookingToAttribution(
  bookingId: number,
  visitorId: string,
): Promise<void> {
  // 1. Look up visitor session
  const sessionRows = await db
    .select()
    .from(visitorSessions)
    .where(eq(visitorSessions.id, visitorId))
    .limit(1);

  if (sessionRows.length === 0) return; // D-03: silent skip — booking is never blocked

  const session = sessionRows[0];

  // 2. Set bookings.utm_session_id
  await db
    .update(bookings)
    .set({ utmSessionId: session.id })
    .where(eq(bookings.id, bookingId));

  // 3. Increment total_bookings; set converted_at only on first conversion
  const newTotal = (session.totalBookings ?? 0) + 1;
  await db
    .update(visitorSessions)
    .set({
      totalBookings: newTotal,
      convertedAt: session.convertedAt ?? new Date(),
    })
    .where(eq(visitorSessions.id, visitorId));
}

export interface RecordConversionEventOptions {
  bookingId?: number;
  visitorId?: string;
  bookingValue?: string | number | null;
  pageUrl?: string | null;
}

/**
 * Writes two rows to conversion_events — one 'first_touch', one 'last_touch'.
 * Lookup chain (per D-04, D-05):
 *   1. If bookingId provided → SELECT utm_session_id FROM bookings → use that session.
 *   2. If visitorId provided directly → query visitor_sessions.
 *   3. If no session found → writes two rows with null attribution (event is preserved).
 * Uses onConflictDoNothing() to respect the partial unique index from Phase 10
 * (ATTR-03) — prevents duplicates if webhook fires more than once.
 */
export async function recordConversionEvent(
  eventType: string,
  options: RecordConversionEventOptions = {},
): Promise<void> {
  let session: VisitorSession | null = null;

  // Lookup path 1: bookingId → get utm_session_id from booking row → fetch session
  if (options.bookingId != null) {
    const bookingRows = await db
      .select({ utmSessionId: bookings.utmSessionId })
      .from(bookings)
      .where(eq(bookings.id, options.bookingId))
      .limit(1);

    const utmSessionId = bookingRows[0]?.utmSessionId ?? null;
    if (utmSessionId) {
      const sessionRows = await db
        .select()
        .from(visitorSessions)
        .where(eq(visitorSessions.id, utmSessionId))
        .limit(1);
      session = sessionRows[0] ?? null;
    }
  }

  // Lookup path 2: visitorId provided directly (used by /api/analytics/events endpoint)
  if (!session && options.visitorId) {
    const sessionRows = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.id, options.visitorId))
      .limit(1);
    session = sessionRows[0] ?? null;
  }

  // Normalise bookingValue to string for the numeric column
  const bookingValueStr =
    options.bookingValue != null ? String(options.bookingValue) : null;

  // Write two rows: first_touch (first_* fields) + last_touch (last_* fields).
  // onConflictDoNothing respects the partial unique index on (booking_id, event_type, attribution_model).
  await db
    .insert(conversionEvents)
    .values([
      {
        visitorId:             session?.id ?? null,
        eventType,
        bookingId:             options.bookingId ?? null,
        bookingValue:          bookingValueStr,
        attributedSource:      session?.firstUtmSource ?? null,
        attributedMedium:      session?.firstUtmMedium ?? null,
        attributedCampaign:    session?.firstUtmCampaign ?? null,
        attributedLandingPage: session?.firstLandingPage ?? null,
        attributionModel:      'first_touch',
        pageUrl:               options.pageUrl ?? null,
      },
      {
        visitorId:             session?.id ?? null,
        eventType,
        bookingId:             options.bookingId ?? null,
        bookingValue:          bookingValueStr,
        attributedSource:      session?.lastUtmSource ?? null,
        attributedMedium:      session?.lastUtmMedium ?? null,
        attributedCampaign:    session?.lastUtmCampaign ?? null,
        attributedLandingPage: session?.lastLandingPage ?? null,
        attributionModel:      'last_touch',
        pageUrl:               options.pageUrl ?? null,
      },
    ])
    .onConflictDoNothing();
}
