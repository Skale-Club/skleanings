import { db } from "../db";
import { visitorSessions, conversionEvents, bookings, type VisitorSession } from "@shared/schema";
import { and, eq, gte, lte, sql, desc, isNotNull } from "drizzle-orm";
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

// ============================================================
// PHASE 12: Marketing Dashboard Aggregate Query Functions
// ============================================================

export interface TrendPoint {
  date: string;
  visitors: number;
  bookings: number;
}

export interface RecentConversion {
  id: number;
  eventType: string;
  source: string | null;
  campaign: string | null;
  bookingValue: string | null;
  occurredAt: string;
  bookingId: number | null;
}

export interface OverviewData {
  visitors: number;
  bookings: number;
  conversionRate: string;
  revenue: string;
  topSource: string | null;
  topCampaign: string | null;
  topLandingPage: string | null;
  recentConversions: RecentConversion[];
  trend: TrendPoint[];
}

export interface SourceRow {
  source: string;
  visitors: number;
  bookings: number;
  conversionRate: string;
  revenue: string;
  bestCampaign: string | null;
  bestLandingPage: string | null;
}

export interface CampaignRow {
  campaign: string;
  source: string | null;
  medium: string | null;
  visitors: number;
  bookings: number;
  conversionRate: string;
  revenue: string;
  topLandingPage: string | null;
}

function emptyOverview(): OverviewData {
  return { visitors: 0, bookings: 0, conversionRate: '—', revenue: '0.00', topSource: null, topCampaign: null, topLandingPage: null, recentConversions: [], trend: [] };
}

function generateDateRange(fromDate: Date, toDate: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(fromDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatTrendLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeRate(bookings: number, visitors: number): string {
  if (visitors === 0) return '—';
  return (bookings / visitors * 100).toFixed(1) + '%';
}

export async function getOverviewData(fromDate: Date, toDate: Date): Promise<OverviewData> {
  try {
    const [visitorRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitorSessions)
      .where(and(gte(visitorSessions.firstSeenAt, fromDate), lte(visitorSessions.firstSeenAt, toDate)));
    const visitors = visitorRow?.count ?? 0;

    // CRITICAL: attributionModel='last_touch' prevents double-counting (recordConversionEvent writes 2 rows per booking)
    const [bookingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversionEvents)
      .where(and(
        eq(conversionEvents.eventType, 'booking_completed'),
        eq(conversionEvents.attributionModel, 'last_touch'),
        gte(conversionEvents.occurredAt, fromDate),
        lte(conversionEvents.occurredAt, toDate),
      ));
    const bookings = bookingRow?.count ?? 0;

    const [revenueRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(booking_value::numeric), 0)::text` })
      .from(conversionEvents)
      .where(and(
        eq(conversionEvents.eventType, 'booking_completed'),
        eq(conversionEvents.attributionModel, 'last_touch'),
        gte(conversionEvents.occurredAt, fromDate),
        lte(conversionEvents.occurredAt, toDate),
      ));
    const revenue = revenueRow?.total ?? '0.00';

    const topSourceRows = await db
      .select({ source: visitorSessions.lastTrafficSource, cnt: sql<number>`count(*)::int` })
      .from(conversionEvents)
      .innerJoin(visitorSessions, eq(conversionEvents.visitorId, visitorSessions.id))
      .where(and(
        eq(conversionEvents.eventType, 'booking_completed'),
        eq(conversionEvents.attributionModel, 'last_touch'),
        gte(conversionEvents.occurredAt, fromDate),
        lte(conversionEvents.occurredAt, toDate),
      ))
      .groupBy(visitorSessions.lastTrafficSource)
      .orderBy(desc(sql`count(*)`))
      .limit(1);
    const topSource = topSourceRows[0]?.source ?? null;

    const topCampaignRows = await db
      .select({ campaign: conversionEvents.attributedCampaign, cnt: sql<number>`count(*)::int` })
      .from(conversionEvents)
      .where(and(
        eq(conversionEvents.eventType, 'booking_completed'),
        eq(conversionEvents.attributionModel, 'last_touch'),
        isNotNull(conversionEvents.attributedCampaign),
        gte(conversionEvents.occurredAt, fromDate),
        lte(conversionEvents.occurredAt, toDate),
      ))
      .groupBy(conversionEvents.attributedCampaign)
      .orderBy(desc(sql`count(*)`))
      .limit(1);
    const topCampaign = topCampaignRows[0]?.campaign ?? null;

    const topLPRows = await db
      .select({ lp: visitorSessions.lastLandingPage, cnt: sql<number>`count(*)::int` })
      .from(visitorSessions)
      .where(and(
        isNotNull(visitorSessions.lastLandingPage),
        gte(visitorSessions.firstSeenAt, fromDate),
        lte(visitorSessions.firstSeenAt, toDate),
      ))
      .groupBy(visitorSessions.lastLandingPage)
      .orderBy(desc(sql`count(*)`))
      .limit(1);
    const topLandingPage = topLPRows[0]?.lp ?? null;

    const recent = await db
      .select({
        id: conversionEvents.id,
        eventType: conversionEvents.eventType,
        source: conversionEvents.attributedSource,
        campaign: conversionEvents.attributedCampaign,
        bookingValue: conversionEvents.bookingValue,
        occurredAt: conversionEvents.occurredAt,
        bookingId: conversionEvents.bookingId,
      })
      .from(conversionEvents)
      .where(eq(conversionEvents.attributionModel, 'last_touch'))
      .orderBy(desc(conversionEvents.occurredAt))
      .limit(5);
    const recentConversions: RecentConversion[] = recent.map(r => ({
      id: r.id,
      eventType: r.eventType,
      source: r.source,
      campaign: r.campaign,
      bookingValue: r.bookingValue != null ? String(r.bookingValue) : null,
      occurredAt: r.occurredAt.toISOString(),
      bookingId: r.bookingId,
    }));

    const dailyVisitorRows = await db
      .select({
        day: sql<string>`DATE(first_seen_at)::text`,
        visitors: sql<number>`count(*)::int`,
      })
      .from(visitorSessions)
      .where(and(gte(visitorSessions.firstSeenAt, fromDate), lte(visitorSessions.firstSeenAt, toDate)))
      .groupBy(sql`DATE(first_seen_at)`)
      .orderBy(sql`DATE(first_seen_at)`);

    const dailyBookingRows = await db
      .select({
        day: sql<string>`DATE(occurred_at)::text`,
        bookings: sql<number>`count(*)::int`,
      })
      .from(conversionEvents)
      .where(and(
        eq(conversionEvents.eventType, 'booking_completed'),
        eq(conversionEvents.attributionModel, 'last_touch'),
        gte(conversionEvents.occurredAt, fromDate),
        lte(conversionEvents.occurredAt, toDate),
      ))
      .groupBy(sql`DATE(occurred_at)`)
      .orderBy(sql`DATE(occurred_at)`);

    const visitorByDay: Record<string, number> = {};
    for (const r of dailyVisitorRows) { visitorByDay[r.day] = r.visitors; }
    const bookingByDay: Record<string, number> = {};
    for (const r of dailyBookingRows) { bookingByDay[r.day] = r.bookings; }

    const allDates = generateDateRange(fromDate, toDate);
    const trend: TrendPoint[] = allDates.map(d => ({
      date: formatTrendLabel(d),
      visitors: visitorByDay[d] ?? 0,
      bookings: bookingByDay[d] ?? 0,
    }));

    return { visitors, bookings, conversionRate: computeRate(bookings, visitors), revenue: parseFloat(revenue).toFixed(2), topSource, topCampaign, topLandingPage, recentConversions, trend };
  } catch (err: any) {
    if (err?.code === '42P01' || err?.message?.includes('does not exist')) return emptyOverview();
    throw err;
  }
}

export async function getSourcesData(fromDate: Date, toDate: Date): Promise<SourceRow[]> {
  try {
    const visitorRows = await db
      .select({ source: visitorSessions.lastTrafficSource, visitors: sql<number>`count(*)::int` })
      .from(visitorSessions)
      .where(and(gte(visitorSessions.firstSeenAt, fromDate), lte(visitorSessions.firstSeenAt, toDate)))
      .groupBy(visitorSessions.lastTrafficSource);

    const bookingRows = await db
      .select({
        source: visitorSessions.lastTrafficSource,
        bookings: sql<number>`count(*)::int`,
        revenue: sql<string>`COALESCE(SUM(${conversionEvents.bookingValue}::numeric), 0)::text`,
      })
      .from(conversionEvents)
      .innerJoin(visitorSessions, eq(conversionEvents.visitorId, visitorSessions.id))
      .where(and(
        eq(conversionEvents.eventType, 'booking_completed'),
        eq(conversionEvents.attributionModel, 'last_touch'),
        gte(conversionEvents.occurredAt, fromDate),
        lte(conversionEvents.occurredAt, toDate),
      ))
      .groupBy(visitorSessions.lastTrafficSource);

    const map = new Map<string, SourceRow>();
    for (const r of visitorRows) {
      const key = r.source ?? 'unknown';
      map.set(key, { source: key, visitors: r.visitors, bookings: 0, conversionRate: '—', revenue: '0.00', bestCampaign: null, bestLandingPage: null });
    }
    for (const r of bookingRows) {
      const key = r.source ?? 'unknown';
      const existing = map.get(key) ?? { source: key, visitors: 0, bookings: 0, conversionRate: '—', revenue: '0.00', bestCampaign: null, bestLandingPage: null };
      existing.bookings = r.bookings;
      existing.revenue = parseFloat(r.revenue).toFixed(2);
      existing.conversionRate = computeRate(r.bookings, existing.visitors);
      map.set(key, existing);
    }

    if (!map.has('direct')) map.set('direct', { source: 'direct', visitors: 0, bookings: 0, conversionRate: '—', revenue: '0.00', bestCampaign: null, bestLandingPage: null });
    if (!map.has('unknown')) map.set('unknown', { source: 'unknown', visitors: 0, bookings: 0, conversionRate: '—', revenue: '0.00', bestCampaign: null, bestLandingPage: null });

    for (const sourceKey of Array.from(map.keys())) {
      const bestCamp = await db
        .select({ campaign: conversionEvents.attributedCampaign, cnt: sql<number>`count(*)::int` })
        .from(conversionEvents)
        .innerJoin(visitorSessions, eq(conversionEvents.visitorId, visitorSessions.id))
        .where(and(
          eq(conversionEvents.eventType, 'booking_completed'),
          eq(conversionEvents.attributionModel, 'last_touch'),
          eq(visitorSessions.lastTrafficSource, sourceKey),
          isNotNull(conversionEvents.attributedCampaign),
          gte(conversionEvents.occurredAt, fromDate),
          lte(conversionEvents.occurredAt, toDate),
        ))
        .groupBy(conversionEvents.attributedCampaign)
        .orderBy(desc(sql`count(*)`))
        .limit(1);

      const bestLP = await db
        .select({ lp: visitorSessions.lastLandingPage, cnt: sql<number>`count(*)::int` })
        .from(visitorSessions)
        .where(and(
          eq(visitorSessions.lastTrafficSource, sourceKey),
          isNotNull(visitorSessions.lastLandingPage),
          gte(visitorSessions.firstSeenAt, fromDate),
          lte(visitorSessions.firstSeenAt, toDate),
        ))
        .groupBy(visitorSessions.lastLandingPage)
        .orderBy(desc(sql`count(*)`))
        .limit(1);

      const row = map.get(sourceKey)!;
      row.bestCampaign = bestCamp[0]?.campaign ?? null;
      row.bestLandingPage = bestLP[0]?.lp ?? null;
    }

    return Array.from(map.values()).sort((a, b) => b.visitors - a.visitors);
  } catch (err: any) {
    if (err?.code === '42P01' || err?.message?.includes('does not exist')) {
      return [
        { source: 'direct',  visitors: 0, bookings: 0, conversionRate: '—', revenue: '0.00', bestCampaign: null, bestLandingPage: null },
        { source: 'unknown', visitors: 0, bookings: 0, conversionRate: '—', revenue: '0.00', bestCampaign: null, bestLandingPage: null },
      ];
    }
    throw err;
  }
}

export async function getCampaignsData(fromDate: Date, toDate: Date): Promise<CampaignRow[]> {
  try {
    const bookingRows = await db
      .select({
        campaign: conversionEvents.attributedCampaign,
        source:   conversionEvents.attributedSource,
        medium:   conversionEvents.attributedMedium,
        bookings: sql<number>`count(*)::int`,
        revenue:  sql<string>`COALESCE(SUM(booking_value::numeric), 0)::text`,
      })
      .from(conversionEvents)
      .where(and(
        eq(conversionEvents.eventType, 'booking_completed'),
        eq(conversionEvents.attributionModel, 'last_touch'),
        gte(conversionEvents.occurredAt, fromDate),
        lte(conversionEvents.occurredAt, toDate),
      ))
      .groupBy(conversionEvents.attributedCampaign, conversionEvents.attributedSource, conversionEvents.attributedMedium);

    const visitorRows = await db
      .select({
        campaign: visitorSessions.lastUtmCampaign,
        source:   visitorSessions.lastUtmSource,
        medium:   visitorSessions.lastUtmMedium,
        visitors: sql<number>`count(*)::int`,
      })
      .from(visitorSessions)
      .where(and(
        isNotNull(visitorSessions.lastUtmCampaign),
        gte(visitorSessions.firstSeenAt, fromDate),
        lte(visitorSessions.firstSeenAt, toDate),
      ))
      .groupBy(visitorSessions.lastUtmCampaign, visitorSessions.lastUtmSource, visitorSessions.lastUtmMedium);

    const compositeKey = (c: string | null, s: string | null, m: string | null) => `${c ?? ''}|${s ?? ''}|${m ?? ''}`;
    const map = new Map<string, CampaignRow>();

    for (const r of visitorRows) {
      if (!r.campaign) continue;
      const key = compositeKey(r.campaign, r.source, r.medium);
      map.set(key, { campaign: r.campaign, source: r.source, medium: r.medium, visitors: r.visitors, bookings: 0, conversionRate: '—', revenue: '0.00', topLandingPage: null });
    }

    for (const r of bookingRows) {
      const key = compositeKey(r.campaign, r.source, r.medium);
      const existing = map.get(key) ?? { campaign: r.campaign ?? '(unknown)', source: r.source, medium: r.medium, visitors: 0, bookings: 0, conversionRate: '—', revenue: '0.00', topLandingPage: null };
      existing.bookings = r.bookings;
      existing.revenue  = parseFloat(r.revenue).toFixed(2);
      existing.conversionRate = computeRate(r.bookings, existing.visitors);
      map.set(key, existing);
    }

    for (const [key, row] of map) {
      const lpRows = await db
        .select({ lp: visitorSessions.lastLandingPage, cnt: sql<number>`count(*)::int` })
        .from(visitorSessions)
        .where(and(
          eq(visitorSessions.lastUtmCampaign, row.campaign),
          isNotNull(visitorSessions.lastLandingPage),
          gte(visitorSessions.firstSeenAt, fromDate),
          lte(visitorSessions.firstSeenAt, toDate),
        ))
        .groupBy(visitorSessions.lastLandingPage)
        .orderBy(desc(sql`count(*)`))
        .limit(1);
      map.get(key)!.topLandingPage = lpRows[0]?.lp ?? null;
    }

    return Array.from(map.values()).sort((a, b) => b.visitors - a.visitors);
  } catch (err: any) {
    if (err?.code === '42P01' || err?.message?.includes('does not exist')) return [];
    throw err;
  }
}

// ============================================================
// PHASE 13: Conversions tab + Visitor Journey panel
// ============================================================

export interface ConversionEventRow {
  id: number;
  eventType: string;
  attributedSource: string | null;
  attributedCampaign: string | null;
  attributedLandingPage: string | null;
  bookingValue: string | null;
  occurredAt: string;      // ISO string
  bookingId: number | null;
  visitorId: string | null;
  attributionModel: string;
}

/**
 * Returns last_touch conversion events filtered by date range and optional source.
 * D-02: only last_touch rows are returned — first_touch rows are excluded by design.
 * D-04: campaign/type filter deferred per D-04; source + date filter only.
 */
export async function getConversionsData(
  fromDate: Date,
  toDate: Date,
  source?: string | null,
  limit = 50,
  offset = 0,
): Promise<ConversionEventRow[]> {
  try {
    const conditions = [
      eq(conversionEvents.attributionModel, 'last_touch'),  // D-02: last_touch only
      gte(conversionEvents.occurredAt, fromDate),
      lte(conversionEvents.occurredAt, toDate),
    ];
    if (source) {
      conditions.push(eq(conversionEvents.attributedSource, source));
    }
    const rows = await db
      .select({
        id:                    conversionEvents.id,
        eventType:             conversionEvents.eventType,
        attributedSource:      conversionEvents.attributedSource,
        attributedCampaign:    conversionEvents.attributedCampaign,
        attributedLandingPage: conversionEvents.attributedLandingPage,
        bookingValue:          conversionEvents.bookingValue,
        occurredAt:            conversionEvents.occurredAt,
        bookingId:             conversionEvents.bookingId,
        visitorId:             conversionEvents.visitorId,
        attributionModel:      conversionEvents.attributionModel,
      })
      .from(conversionEvents)
      .where(and(...conditions))
      .orderBy(desc(conversionEvents.occurredAt))
      .limit(limit)
      .offset(offset);

    return rows.map(r => ({
      id:                    r.id,
      eventType:             r.eventType,
      attributedSource:      r.attributedSource,
      attributedCampaign:    r.attributedCampaign,
      attributedLandingPage: r.attributedLandingPage,
      bookingValue:          r.bookingValue != null ? String(r.bookingValue) : null,
      occurredAt:            r.occurredAt.toISOString(),
      bookingId:             r.bookingId,
      visitorId:             r.visitorId,
      attributionModel:      r.attributionModel,
    }));
  } catch (err: any) {
    if (err?.code === '42P01' || err?.message?.includes('does not exist')) return [];
    throw err;
  }
}

/**
 * Returns the full visitor_sessions row for the Visitor Journey panel.
 * Returns null if visitorId is not found (route will return 404).
 */
export async function getVisitorSession(
  visitorId: string,
): Promise<VisitorSession | null> {
  try {
    const rows = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.id, visitorId))
      .limit(1);
    return rows[0] ?? null;
  } catch (err: any) {
    if (err?.code === '42P01' || err?.message?.includes('does not exist')) return null;
    throw err;
  }
}
