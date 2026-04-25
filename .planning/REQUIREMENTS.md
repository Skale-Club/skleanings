# Requirements: Skleanings — v1.0 Marketing Attribution

**Defined:** 2026-04-25
**Core Value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.

## v1 Requirements

### Session Capture & Traffic Classification

- [x] **CAPTURE-01**: Visitor session is captured on the first page load, recording all available UTM parameters (utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id), the referrer URL, and the landing page URL
- [x] **CAPTURE-02**: An anonymous visitor session ID (UUID) is generated and persisted in localStorage so first-touch attribution survives multi-page visits and multi-day booking journeys
- [x] **CAPTURE-03**: All UTM parameter values are normalized to lowercase before storage so "Google" and "google" are treated as the same source
- [x] **CAPTURE-04**: Traffic without UTM parameters is automatically classified into a human-readable channel: Organic Search (known search engines without UTMs), Social (Facebook, Instagram, YouTube, TikTok, LinkedIn without UTMs), Referral (other external referrers), Direct (no referrer and no UTMs), or Unknown
- [x] **CAPTURE-05**: First-touch attribution (the original source/campaign that brought the visitor) is written once and never overwritten for the life of the visitor session
- [x] **CAPTURE-06**: Last-touch attribution is updated each time the visitor returns with a new UTM signal or identifiable referrer, so the most recent marketing source is always current

### Attribution Model

- [x] **ATTR-01**: Each conversion event records both first-touch attribution (what originally brought the visitor) and last-touch attribution (what most recently drove them back) as separate fields
- [x] **ATTR-02**: Booking attribution survives the Stripe checkout redirect — the visitor session ID is passed in the booking POST body before any Stripe redirect occurs so paid booking attributions are never lost
- [x] **ATTR-03**: Duplicate conversion events for the same booking are prevented so a booking that goes through both the Stripe webhook path and the confirmation page does not create two attribution records

### Conversion Event Tracking

- [x] **EVENTS-01**: Booking completed event is recorded with full first-touch and last-touch attribution context (source, medium, campaign, landing page, conversion page, booking value)
- [x] **EVENTS-02**: Booking started event is recorded when a visitor reaches the first step of the booking flow, with first-touch and last-touch attribution
- [x] **EVENTS-03**: Chat initiated event is recorded when a visitor opens the chat widget, with first-touch and last-touch attribution
- [x] **EVENTS-04**: Conversion event recording never delays or blocks the booking flow — all attribution writes are fire-and-forget
- [x] **EVENTS-05**: Admin can see each conversion event linked to the booking or action it represents so a specific lead can be traced to its source

### Marketing Overview Dashboard

- [x] **OVERVIEW-01**: Admin can view total visitors, total bookings (from tracked sessions), overall conversion rate, and total booking revenue attributed to tracked marketing sessions in one overview panel
- [x] **OVERVIEW-02**: Admin can see the top performing source, top performing campaign, and top performing landing page at a glance
- [x] **OVERVIEW-03**: Admin can see a trend chart showing visitors and bookings per day over the selected time period
- [x] **OVERVIEW-04**: Admin can see the most recent conversions (source, campaign, booking value, time) in the overview without clicking into a separate view
- [x] **OVERVIEW-05**: The overview communicates clearly when there is not enough data yet (first-time empty state explains when collection started)

### Source Performance

- [x] **SOURCES-01**: Admin can see marketing performance grouped by traffic source in a table showing visitors, bookings, conversion rate, and total revenue per source
- [x] **SOURCES-02**: For each source, admin can see the best performing campaign and the best performing landing page from that source
- [x] **SOURCES-03**: Direct and Unknown traffic is always shown (never hidden) with a plain-language tooltip explaining what these categories mean
- [x] **SOURCES-04**: Source labels use business-friendly names (e.g., "Google Ads", "Facebook", "Organic Search", "Direct") — raw UTM values are not shown in this view

### Campaign Performance

- [x] **CAMP-01**: Admin can see marketing performance grouped by campaign name in a table showing source, medium, visitors, bookings, conversion rate, and total revenue per campaign
- [x] **CAMP-02**: Admin can identify campaigns that brought traffic but produced zero bookings ("campaigns with no conversions")
- [x] **CAMP-03**: For each campaign, admin can see which landing pages received traffic from that campaign
- [x] **CAMP-04**: Campaigns from different sources are distinguished so "Summer Sale" from Google and "Summer Sale" from Facebook appear as separate rows

### Conversions View

- [ ] **CONV-01**: Admin can see a list of all recorded conversion events showing: what happened, when, source, campaign, landing page, whether it was first-touch or last-touch, and the booking value
- [ ] **CONV-02**: Admin can filter the conversions list by source, campaign, conversion type, and date range
- [ ] **CONV-03**: Each conversion event in the list is linked to the specific booking or action so the admin can click through to the booking detail

### Visitor Journey

- [ ] **JOUR-01**: Admin can view the attribution journey for a specific visitor session, showing first-touch source/campaign, subsequent marketing touchpoints (if any), and the conversion event
- [ ] **JOUR-02**: The visitor journey clearly shows whether first-touch and last-touch were the same source or different sources, so the admin understands multi-touch influence

### Filters & Date Ranges

- [x] **FILTER-01**: Admin can filter all marketing views by date range with standard presets: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, and a Custom date picker
- [x] **FILTER-02**: Admin can filter by source, medium, campaign, and conversion type across all views
- [x] **FILTER-03**: The default date range is Last 30 days and is pre-applied when the admin first opens the marketing section

### Admin Navigation & UX

- [x] **UX-01**: The marketing intelligence section is accessible from the existing admin sidebar navigation under a clear label ("Marketing" or "UTM Tracking")
- [x] **UX-02**: All labels throughout the marketing section use business-friendly language — field names like "First Source", "Last Source", "Campaign", "Landing Page", "Visitors", "Bookings", "Conversion Rate" instead of raw parameter names
- [x] **UX-03**: Each dashboard view has a meaningful empty state that explains what it shows and when data will appear

### GoHighLevel UTM Sync

- [ ] **GHL-01**: When a booking with attribution data is created, the visitor's first-touch source and campaign are written to the corresponding GoHighLevel contact's custom fields
- [ ] **GHL-02**: The last-touch source and campaign are also written to the GoHighLevel contact record so CRM records reflect both attribution touchpoints

---

## v2 Requirements

### Secondary Conversion Events

- **EVENTS-V2-01**: Phone click is recorded as a micro-conversion event with attribution context
- **EVENTS-V2-02**: Quote request / contact form submission is recorded as a micro-conversion event with attribution context

### Enhanced Reporting

- **REPORT-V2-01**: Admin can compare current period performance against the previous equivalent period (e.g., last 30 days vs the 30 days before that)
- **REPORT-V2-02**: Admin can see a UTM coverage warning indicating what percentage of recent bookings lacked UTM attribution data
- **REPORT-V2-03**: Admin can see a dedicated landing page performance view showing which landing pages convert best per source/campaign

### Data Export

- **EXPORT-V2-01**: Admin can export conversion event data as CSV for use in external tools

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replacing GA4 / GTM | GA4 is already installed and serves a different purpose; this is a complementary first-party layer |
| Third-party tracking SDKs on the frontend | All tracking is first-party using existing stack — no Segment, Mixpanel, Amplitude, or similar |
| IP address storage | GDPR liability; anonymous visitor UUID is sufficient; IP never written to database |
| User-level tracking (cross-device) | Requires login; customers are anonymous; session-level attribution is the correct scope |
| Real-time event streaming / WebSocket dashboards | Standard React Query polling is sufficient for a marketing reporting use case |
| Multi-property / multi-business tracking | Single cleaning business, single admin panel |
| Visitor fingerprinting | Privacy violation; out of scope regardless of GA4 usage |
| UTM link builder tool | Governance tooling; out of scope for this milestone |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAPTURE-01 | Phase 10 | Complete |
| CAPTURE-02 | Phase 10 | Complete |
| CAPTURE-03 | Phase 10 | Complete |
| CAPTURE-04 | Phase 10 | Complete |
| CAPTURE-05 | Phase 10 | Complete |
| CAPTURE-06 | Phase 10 | Complete |
| ATTR-01 | Phase 11 | Complete |
| ATTR-02 | Phase 11 | Complete |
| ATTR-03 | Phase 10 | Complete |
| EVENTS-01 | Phase 11 | Complete |
| EVENTS-02 | Phase 11 | Complete |
| EVENTS-03 | Phase 11 | Complete |
| EVENTS-04 | Phase 11 | Complete |
| EVENTS-05 | Phase 11 | Complete |
| OVERVIEW-01 | Phase 12 | Complete |
| OVERVIEW-02 | Phase 12 | Complete |
| OVERVIEW-03 | Phase 12 | Complete |
| OVERVIEW-04 | Phase 12 | Complete |
| OVERVIEW-05 | Phase 12 | Complete |
| SOURCES-01 | Phase 12 | Complete |
| SOURCES-02 | Phase 12 | Complete |
| SOURCES-03 | Phase 12 | Complete |
| SOURCES-04 | Phase 12 | Complete |
| CAMP-01 | Phase 12 | Complete |
| CAMP-02 | Phase 12 | Complete |
| CAMP-03 | Phase 12 | Complete |
| CAMP-04 | Phase 12 | Complete |
| CONV-01 | Phase 13 | Pending |
| CONV-02 | Phase 13 | Pending |
| CONV-03 | Phase 13 | Pending |
| JOUR-01 | Phase 13 | Pending |
| JOUR-02 | Phase 13 | Pending |
| FILTER-01 | Phase 12 | Complete |
| FILTER-02 | Phase 12 | Complete |
| FILTER-03 | Phase 12 | Complete |
| UX-01 | Phase 12 | Complete |
| UX-02 | Phase 12 | Complete |
| UX-03 | Phase 12 | Complete |
| GHL-01 | Phase 13 | Pending |
| GHL-02 | Phase 13 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-04-25*
*Last updated: 2026-04-25 — traceability populated after roadmap creation*
