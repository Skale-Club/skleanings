import { useEffect } from "react";
import { useLocation } from "wouter";

const VISITOR_ID_KEY = "skleanings_visitor_id";

/**
 * Normalize a UTM value: lowercase + trim. Returns null if empty.
 * (Server also normalizes — D-04 belt-and-suspenders.)
 */
function norm(v: string | null): string | null {
  const t = v?.trim().toLowerCase();
  return t || null;
}

/**
 * useUTMCapture — fires a fire-and-forget POST /api/analytics/session
 * on each meaningful location change.
 *
 * Mounted INSIDE the existing AnalyticsProvider in App.tsx so it
 * piggybacks on the provider's useLocation() subscription.
 *
 * Decisions implemented:
 *   D-05: Returns early in development (matches analytics.ts pattern)
 *   D-07: Uses the existing AnalyticsProvider — no new provider added
 *   D-08: localStorage UUID via crypto.randomUUID(); no cookie fallback
 *   D-04: Lowercases UTM values client-side before send
 *
 * "Meaningful" = new visitor (UUID just generated) OR has UTM params
 * OR has a referrer. Pure internal SPA navs without any of those are
 * skipped to avoid noise on the server.
 */
export function useUTMCapture(): void {
  const [location] = useLocation();

  useEffect(() => {
    // D-05: DEV guard — must be first statement
    if (import.meta.env.DEV) return;

    // 1. Get-or-generate the visitor UUID (D-08, CAPTURE-02)
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    const isNewVisitor = !visitorId;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }

    // 2. Read UTM params from current URL (CAPTURE-01, CAPTURE-03 normalize)
    const params = new URLSearchParams(window.location.search);
    const utmSource   = norm(params.get("utm_source"));
    const utmMedium   = norm(params.get("utm_medium"));
    const utmCampaign = norm(params.get("utm_campaign"));
    const utmTerm     = norm(params.get("utm_term"));
    const utmContent  = norm(params.get("utm_content"));
    const utmId       = norm(params.get("utm_id"));

    // 3. Capture referrer (page-load value) and landing page (pathname only — no query)
    // CONTEXT.md specifics: landing page MUST be pathname-only to avoid
    // double-storing the UTM params already captured above.
    const referrer    = document.referrer || null;
    const landingPage = window.location.pathname;

    // 4. Skip noise: only fire when there's some signal worth recording
    const hasUtm = !!(utmSource || utmMedium || utmCampaign || utmTerm || utmContent || utmId);
    const hasSignal = isNewVisitor || hasUtm || !!referrer;
    if (!hasSignal) return;

    // 5. Fire-and-forget POST. Never await. Errors silently swallowed —
    //    analytics MUST NEVER break UX (D-07 spirit / EVENTS-04 future).
    fetch("/api/analytics/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        utmId,
        referrer,
        landingPage,
      }),
    }).catch(() => {
      // Silent — never surface to the user
    });
  }, [location]);
}
