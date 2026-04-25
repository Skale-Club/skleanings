import { db } from "../db";
import { visitorSessions, type VisitorSession } from "@shared/schema";
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
