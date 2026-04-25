# Feature Research

**Domain:** First-party UTM marketing attribution dashboard for a service booking business (cleaning company)
**Researched:** 2026-04-25
**Confidence:** HIGH (stack/architecture validated against Plausible docs and official sources; feature priorities drawn from multiple corroborating sources)

---

## Context: What This Dashboard Answers

The non-technical business owner has three questions:
1. Where are my visitors coming from?
2. Which sources and campaigns are turning into actual bookings?
3. Is my marketing spend going to the right places?

Every feature below is evaluated against those three questions. If a feature does not help answer one of them plainly, it is an anti-feature.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a business owner assumes exist in any attribution tool. Missing these makes the dashboard feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Traffic source overview** — grouped totals by source (Google Organic, Google Ads, Facebook, Email, Direct, etc.) | Every analytics tool shows this; it is the baseline | LOW | Auto-classify via referrer + UTM medium. Display human labels ("Google Organic"), never raw parameter values ("google / organic"). |
| **Booking conversion count per source** — how many completed bookings came from each source | Owners want to know which source produces real customers, not just clicks | MEDIUM | Requires joining `utm_sessions` with `bookings` table via session_id or visitor_id. This is the primary value of the whole system. |
| **Conversion rate per source** — bookings ÷ visitors | Makes small-traffic sources comparable to high-traffic ones | LOW | Derived metric; no new data required. Show as percentage with tooltip explaining "visitors who became bookings". |
| **Date range filter** — presets: Today, Last 7 Days, Last 30 Days, This Month, Last Month, Custom | Users apply mental models around weeks and months; lacking this makes data feel static | LOW | Default to Last 30 Days. Custom picker needed for campaign post-mortems. These exact presets are standard across GA4, Plausible, and Fathom. |
| **Top landing pages by conversions** — which page they first visited before booking | Owners want to know which page is "doing the work" | LOW | Captured at session start. Aggregate and rank. Display as page path, not full URL. |
| **Campaign performance table** — per UTM campaign: visitors, bookings, conversion rate | Any business running paid ads expects to see campaign-level data | MEDIUM | UTM campaigns only populated when utm_campaign param is present; gracefully show "No campaign tag" for untagged paid traffic. |
| **Trend line for bookings over time** — daily or weekly bookings plotted as a line chart | Owners need to see if they are growing or declining | LOW | Simple time-series from conversion events table. Line chart is correct for trend data; bar chart works for comparison. |
| **"Direct / Unknown" as a visible source category** — not hidden | If 20-40% of traffic shows as Direct, hiding it destroys trust in the numbers | LOW | Label as "Direct or Unknown" with a brief tooltip: "Visitors we couldn't trace to a specific source — may include typed-in URLs, bookmarks, or private browsing." |
| **Summary KPI cards at top of Overview** — Visitors, Leads (phone/form), Bookings, Conversion Rate | Mental model from GA4 and every SaaS dashboard; absence feels amateurish | LOW | 4 cards. Use plain labels, not marketing jargon. "Bookings" not "Macro-conversions." |
| **Filter by source or campaign across all views** — click a source to filter the whole page | Plausible and Fathom both implement this as a core interaction; expected by anyone who has used a modern analytics tool | MEDIUM | Global filter state; all charts and tables re-query based on active dimension filters. |

### Differentiators (Competitive Advantage)

Features that separate a good implementation from a generic GA4 clone. These are what make a first-party system worth building.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **First-touch preserved alongside last-touch** — show both "where they came from originally" and "what source they visited before booking" | GA4 defaults to last-touch only. Showing both reveals whether your awareness campaigns (e.g. Facebook) are actually contributing to bookings that convert via Google. | HIGH | Requires storing first-touch at session-creation time and never overwriting it. Attribution join logic must present both. Label them in plain language: "How they first found you" and "What brought them back to book." |
| **Booking revenue attributed to source** — dollar value of bookings per source, not just count | Moves the dashboard from traffic talk to money talk, which is what the business owner actually cares about | MEDIUM | `bookings.total_price` already exists in schema. Join to attribution data. Show "Revenue from Google Ads: $4,200" not just "12 bookings." |
| **Visitor journey view** — a timeline for a single conversion event showing: first touch source → landing page → last touch source → conversion | Makes attribution concrete and verifiable; owners can check whether the data matches what they know about a real customer | HIGH | Not a full session-replay product. A simple list view: each row is one conversion event with attribution chain. Useful for validating data quality in early rollout. |
| **UTM parameter coverage warning** — surface when a paid traffic source has high visitors but no UTM tags | Catches the most common data quality problem (running ads without UTM tags) before it corrupts reporting | LOW | Heuristic: referrer contains "google.com/aclk" or "facebook.com" but utm_source is null. Show a dismissible banner: "We noticed Google Ads traffic without campaign tags — you may be missing attribution data." |
| **Micro-conversion tracking alongside bookings** — track phone clicks and form starts as leading indicators | Bookings take time; micro-conversions show marketing is working before the full booking cycle completes | MEDIUM | Already scoped in PROJECT.md. Requires client-side event on phone number anchor click and quote form submit. Store as separate conversion_type values. |
| **Source-level comparison across periods** — "This month vs. last month" per source | Business owners naturally think in monthly cycles and want to know if a channel is growing or dying | MEDIUM | Date comparison is a common request. Show change as +/- % with color coding: green/red. Keep it simple: current period vs. previous period of equal length. |
| **Plain-language labels throughout** — "Google Paid" not "google / cpc", "Email Campaign" not "email / newsletter" | GA4 exposes raw UTM values which confuse non-technical owners; auto-classification into friendly names is a real differentiator | LOW | Implement a classification map: utm_source + utm_medium combos → human-readable channel label. This is a data transform, not a UI change. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look reasonable on a spec sheet but actively harm the non-technical user experience or create scope traps.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Multi-touch attribution model selector** — "Choose: Linear, Time-Decay, Position-Based" | Sounds sophisticated; appears in enterprise tools | Non-technical owners cannot interpret the difference between linear and time-decay attribution. Presenting model options forces a decision they lack context to make, destroys confidence in the data, and doubles the query complexity. Plausible explicitly avoids this. | Expose first-touch and last-touch only. Label them plainly. Document the difference in a tooltip. |
| **Real-time visitor tracking** — live visitor count updating every few seconds | GA4 has it; owners sometimes ask for it | For a cleaning company booking platform, real-time data has no operational value. Bookings are scheduled, not impulse decisions. Real-time requires websocket infrastructure and creates anxiety over normal low-traffic periods. | Show "Today" as a date preset. Refresh on page load. That is sufficient freshness for this use case. |
| **Cohort analysis** — retention curves, repeat-visitor cohorts | Standard in growth tools | Cleaning company customers book infrequently (monthly or quarterly). Cohort analysis requires user-level identity across sessions, which this system explicitly avoids (no PII, cookie/session-only). Results would be misleading. | Show "return visitor" as a source label when a visitor returns and converts. That is the useful signal. |
| **Attribution by device or browser** — "iPhone users convert 3x better than desktop" | Segmentation sounds useful | Adds dashboard complexity without actionable outcome for a local cleaning business. The business cannot change its channel mix based on device data. It creates noise that buries the source/campaign signal. | Keep device-level data in GA4. This first-party dashboard focuses on source and campaign only. |
| **Raw UTM parameter tables** — expose utm_source, utm_medium, utm_campaign columns directly | Developers want to see the raw data | Raw UTM values confuse non-technical users ("what is cpc?"). A table of `google / cpc / spring-promo-2025` means nothing without context. | Classify into channel labels in all primary views. Offer a raw data export (CSV) for developers/agency access, but never surface raw params in the main dashboard. |
| **Custom attribution windows** — "Set your lookback window to 7 / 14 / 30 / 90 days" | Enterprise analytics tools offer this | Requires the owner to understand what an attribution window is to make a meaningful choice. Default 30-day lookback covers the entire consideration cycle for a cleaning booking (which is typically 1-7 days). | Fixed 30-day attribution window for last-touch. Display this in a tooltip. |
| **Heatmaps or session recordings** — showing where users click on the booking page | Sounds like "more attribution data" | This is a UX/conversion optimization tool, not attribution. It is a completely separate product surface with significant privacy implications (records customer input). Out of scope for a marketing attribution dashboard. | Use Hotjar or Microsoft Clarity for that purpose separately. |

---

## Feature Dependencies

```
Conversion Tracking (booking completed event)
    └──requires──> UTM Session Capture (session_id tied to visitor)
                       └──requires──> Session Identification (cookie/localStorage visitor_id)

Attribution Join (source → booking)
    └──requires──> Conversion Tracking
    └──requires──> UTM Session Capture

Overview KPI Cards
    └──requires──> Attribution Join
    └──requires──> Conversion Tracking

Campaign Performance Table
    └──requires──> UTM Session Capture (utm_campaign field populated)
    └──enhances──> Overview KPI Cards (drill-down from top-level)

Revenue Attribution
    └──requires──> Attribution Join
    └──requires──> bookings.total_price (already exists in schema)

First-Touch vs Last-Touch Display
    └──requires──> UTM Session Capture (first_touch stored at session creation, never overwritten)
    └──requires──> Attribution Join

Visitor Journey View
    └──requires──> Attribution Join
    └──requires──> Conversion events table with session linkage

Source Comparison (period-over-period)
    └──requires──> Attribution Join
    └──requires──> Date range filter

Micro-Conversion Tracking (phone click, form start)
    └──requires──> Client-side event instrumentation on booking flow pages
    └──requires──> Conversion events table (same table as booking conversions, different type)

UTM Coverage Warning Banner
    └──requires──> UTM Session Capture
    └──requires──> Referrer classification logic

Visitor Journey View ──conflicts──> Cohort Analysis
    (Journey = session-scoped; cohort = user-scoped across sessions — architecturally incompatible with no-PII model)
```

### Dependency Notes

- **Attribution Join requires UTM Session Capture:** Without storing session_id on both the session record and the booking record at checkout-completion time, there is no way to link a booking to its originating traffic source. This is the foundational dependency of the entire system.
- **First-touch requires immutable storage:** The first-touch UTM data must be written once at session creation and never overwritten. A separate `last_touch_*` column set is updated on each new visit. Both columns live on the same session or visitor record.
- **Revenue Attribution requires no new data capture:** `bookings.total_price` already exists. This feature is purely a JOIN and aggregation change — low risk, high value.
- **Micro-conversions require client-side instrumentation:** Phone click tracking requires an `onClick` handler on the phone number link in the frontend. Quote form start requires a form-focus or first-input event. Neither requires backend changes beyond accepting the event payload.

---

## MVP Definition

### Launch With (v1)

Minimum viable — answers "where are my bookings coming from?" with confidence.

- [ ] **UTM session capture** — store all 6 UTM params + referrer + landing page at session start, with first-touch preserved
- [ ] **Auto-classification into friendly channel labels** — Google Organic, Google Ads, Facebook, Email, Direct/Unknown, etc.
- [ ] **Booking completion event with session linkage** — store session_id on booking record at checkout
- [ ] **Overview KPI cards** — Visitors, Bookings, Conversion Rate (from all sources)
- [ ] **Source performance table** — visitors and bookings per source, with conversion rate
- [ ] **Trend line** — bookings per day/week over selected date range
- [ ] **Date range presets** — Last 7 Days (default for spotcheck), Last 30 Days (default for reporting), This Month, Last Month, Custom
- [ ] **"Direct / Unknown" handled and explained** — not hidden; tooltip explains what it means
- [ ] **Plain-language labels throughout** — no raw UTM values exposed in primary views

### Add After Validation (v1.x)

Add once the core attribution data is confirmed accurate and trusted.

- [ ] **Campaign performance table** — when business is running tagged campaigns and needs per-campaign breakdowns; trigger: owner asks "which campaign is working?"
- [ ] **Revenue attribution per source** — show dollar value alongside booking count; trigger: owner wants to optimize spend allocation
- [ ] **First-touch vs last-touch toggle** — expose both attribution models with plain-language labels; trigger: owner notices discrepancy between Google Ads data and dashboard
- [ ] **Micro-conversion tracking** — phone clicks and quote form starts as leading indicators; trigger: low booking volume makes conversion count an unreliable metric alone
- [ ] **Period comparison** — current vs. previous period; trigger: owner asks "is this month better than last month?"
- [ ] **UTM coverage warning banner** — trigger: owner reports paid traffic not showing in dashboard

### Future Consideration (v2+)

Defer until v1.x is stable and generating trust in the data.

- [ ] **Visitor journey view** — individual conversion timelines; deferred because it requires more complex session-stitching and is primarily a data-validation tool, not a decision tool
- [ ] **Landing page performance view** — which pages start converting journeys; deferred because the source view covers 80% of the same insight
- [ ] **Export to CSV** — raw data export for agency/developer access; not needed until an agency asks for it

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| UTM session capture (backend) | HIGH | MEDIUM | P1 |
| Booking event with session linkage | HIGH | LOW | P1 |
| Auto-classification to friendly labels | HIGH | LOW | P1 |
| Overview KPI cards | HIGH | LOW | P1 |
| Source performance table | HIGH | LOW | P1 |
| Trend line chart | HIGH | LOW | P1 |
| Date range presets | HIGH | LOW | P1 |
| Direct/Unknown handling + tooltip | MEDIUM | LOW | P1 |
| Campaign performance table | HIGH | MEDIUM | P2 |
| Revenue attribution per source | HIGH | LOW | P2 |
| First-touch vs last-touch display | MEDIUM | MEDIUM | P2 |
| Micro-conversion tracking | MEDIUM | MEDIUM | P2 |
| Period comparison (MoM) | MEDIUM | MEDIUM | P2 |
| UTM coverage warning | MEDIUM | LOW | P2 |
| Visitor journey view | LOW | HIGH | P3 |
| Landing page performance view | MEDIUM | MEDIUM | P3 |
| CSV export | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch — the system has no value without these
- P2: Should have — add in the phase immediately after data capture is working
- P3: Nice to have — defer until business asks for it specifically

---

## Competitor Feature Analysis

| Feature | Plausible Analytics | Fathom Analytics | Our Approach |
|---------|---------------------|------------------|--------------|
| Source attribution | Shows source, medium, campaign tabs; filters by any goal | Shows referrers; no filtering by conversion source | Match Plausible's filtering model: click a source to filter the full page |
| UTM campaign tracking | Full UTM parameter support; Campaigns tab groups by utm_campaign | Basic referrer only; no UTM-level breakdown | Full UTM support; group by campaign, show booking count per campaign |
| First-touch attribution | Approximated via entry pages; no explicit first/last toggle | Not supported | Explicit first-touch storage; display alongside last-touch with plain labels |
| Dark traffic / Direct | Displayed as "Direct / None"; attempts to recover Android app traffic | Displayed in referrers | Label as "Direct or Unknown" with explanatory tooltip |
| Conversion tracking | Goals and funnels; filter sources by who completed a goal | Goal tracking with no source breakdown (limitation noted by users) | Native booking event; source-filtered conversion count is the core metric |
| Revenue attribution | Not built-in (traffic only) | Not built-in | Built-in via booking total_price join — key differentiator |
| Attribution model | Last-touch by default; entry-page approximation for first-touch | Last-touch only | First-touch + last-touch, both stored and both displayed |
| Language for non-technical users | Very clean: "Sources", "Campaigns", "Goals" — no raw UTM values in primary UI | Very clean: minimal labels | Same approach: channel labels not raw parameters; "Bookings" not "Conversions" |
| Date range presets | Today, Yesterday, Last 7D, Last 30D, Month to date, Last month, Last year, Custom | Last 24h, 7D, 30D, 6 months, Year, Custom | Today, Last 7 Days, Last 30 Days, This Month, Last Month, Custom |

---

## Conversion Events for a Service Booking Business

Primary and secondary conversion events ordered by business value. This informs what gets tracked and what gets featured in the Conversions view.

| Event | Business Value | Funnel Stage | Implementation |
|-------|---------------|--------------|----------------|
| **Booking completed** | Highest — direct revenue | Bottom | Server-side: fires when booking status transitions to confirmed; capture session_id from cookie |
| **Checkout started** — customer reached payment step | High — shows purchase intent | Mid-Bottom | Client-side event on payment page load |
| **Quote requested / Contact form submitted** | Medium — warm lead | Mid | Client-side event on form submit |
| **Phone number clicked** | Medium — intent signal; most local bookings for cleaning start with a call | Mid | Client-side onClick on tel: link |
| **Service added to cart** | Low-Medium — early intent | Top-Mid | Client-side event on add-to-cart |

For v1, implement: Booking completed + Phone click + Quote form submit. The rest are v1.x.

---

## Attribution Model Presentation Guide (Non-Technical Language)

The system captures both first-touch and last-touch. Display guidance for the non-technical owner audience:

**Do NOT use:** "First-touch attribution", "Last-touch attribution", "Attribution model"
**DO use:** These exact labels and explanations:

- **"How they first found you"** — the source that brought the visitor to the site for the very first time. Use this to evaluate brand awareness campaigns and channels like Facebook or YouTube.
- **"What brought them back to book"** — the source they came from on the visit where they completed the booking. Use this to evaluate bottom-of-funnel channels like Google Search.

**For the overview**, show last-touch as the primary figure (it is the most actionable for ad spend decisions). Surface first-touch as a secondary label on the source row or in a tooltip.

**For direct traffic**, use: "Direct or Unknown — visitors we couldn't trace to a specific source. Common causes: bookmarks, typed URLs, private browsing, or untagged links."

---

## Empty States and Zero-Data Handling

Every view must handle the state where no data exists yet. Each case requires specific copy, not a generic spinner.

| State | When It Occurs | Recommended Treatment |
|-------|---------------|----------------------|
| **No sessions captured yet** | First 24-48h after deployment, before any visitors | Icon + "We haven't recorded any visitors yet. Once customers visit your site, their sources will appear here." No CTA needed. |
| **No bookings in date range** | Short date range (Today, Yesterday) with no bookings | Show visitor count if > 0. "No bookings in this period — but [N] visitors stopped by. Change the date range or check back later." |
| **No campaigns tagged** | utm_campaign is never populated | Campaign Performance table shows one row: "Untagged traffic — [N] bookings from visitors without campaign tags. Add UTM tags to your ads to see campaign-level data." Link to a simple guide. |
| **Zero data for a specific source** | Selected source filter has no events | "No data for [Google Ads] in this period. Either no visitors came from this source, or campaign tags are missing." |
| **No micro-conversions** | Phone click tracking not yet instrumented | Suppress micro-conversion section from Conversions view entirely until at least one event exists. Do not show an empty table. |
| **Very first admin visit** | New deployment, nothing captured | Show a setup checklist card: "3 things to do to start tracking: 1. Visit your site to test the tracker 2. Add UTM tags to any active ads 3. Complete a test booking". |

---

## Implementation Notes for Roadmap

These notes are for the requirements writer and roadmapper.

**Build order constraint:** UTM session capture (backend table + client-side script) must ship before any dashboard views. The dashboard has no data to show until capture is running. This forces a Phase 1 (capture) → Phase 2 (dashboard) split.

**Existing booking flow dependency:** The booking checkout flow must be instrumented to pass session_id to the server at booking creation time. This is a change to the existing frontend checkout component and the existing bookings creation endpoint. It is low-risk (additive, non-breaking) but must be coordinated with the session capture work.

**Drizzle schema additions needed:**
- `utm_sessions` table: visitor_id (cookie), first_touch_* columns, last_touch_* columns, referrer, landing_page, created_at, last_seen_at
- `conversion_events` table: visitor_id, session_id, conversion_type (enum: booking_completed, phone_click, form_submit, checkout_started), booking_id (nullable FK), occurred_at
- `bookings` table: add `visitor_id` column (nullable, for attribution join)

**Classification logic is stateless:** The auto-classification of UTM params + referrer → channel label is a pure function (no DB query needed). Implement as a shared utility in `server/lib/utm-classifier.ts` for reuse across routes and queries.

**No new UI framework needed:** All dashboard views fit the existing shadcn/ui + Recharts (already used in admin) pattern. A trend line is a Recharts `<LineChart>`. A source table is a standard shadcn `<Table>`. KPI cards are existing card components.

---

## Sources

- [Plausible Analytics — Attribution Modeling](https://plausible.io/blog/attribution-modeling) — HIGH confidence; official Plausible documentation
- [Plausible Analytics — UTM Tracking and Dark Traffic](https://plausible.io/blog/utm-tracking-tags) — HIGH confidence; official Plausible documentation
- [Plausible Analytics — Paid Campaigns and UTM Tags](https://plausible.io/docs/manual-link-tagging) — HIGH confidence; official Plausible documentation
- [CallRail — First Touch vs Last Touch Attribution](https://www.callrail.com/blog/first-touch-vs-last-touch-attribution) — MEDIUM confidence; practitioner source
- [LocaliQ — 2025 Home Services Search Ad Benchmarks](https://localiq.com/blog/home-services-search-advertising-benchmarks/) — MEDIUM confidence; industry benchmark data
- [Brixon Group — 10 Critical UTM Parameter Mistakes 2026](https://brixongroup.com/en/the-10-critical-utm-parameter-mistakes-that-sabotage-your-marketing-tracking) — MEDIUM confidence; practitioner source
- [Seer Interactive — Dark Traffic Explained](https://www.seerinteractive.com/insights/direct-traffic-is-dark-traffic-and-thats-ok) — MEDIUM confidence; practitioner source
- [Dataslayer — Marketing Dashboard Best Practices 2025](https://www.dataslayer.ai/blog/marketing-dashboard-best-practices-2025) — MEDIUM confidence; practitioner source
- [Eleken — Empty State UX](https://www.eleken.co/blog-posts/empty-state-ux) — MEDIUM confidence; UX practitioner source
- [Usermaven — Fathom vs Plausible vs Usermaven](https://usermaven.com/blog/fathom-vs-plausible-vs-usermaven) — MEDIUM confidence; comparative analysis

---

*Feature research for: UTM Attribution Dashboard — Skleanings v1.0 Marketing Attribution*
*Researched: 2026-04-25*
