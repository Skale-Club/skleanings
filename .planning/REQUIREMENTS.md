# Requirements: Skleanings — v3.0 Calendar Polish

**Defined:** 2026-05-05
**Core Value:** A receptionist or admin can run the daily booking floor on a calendar that renders structurally correct in every view — the UI never gets in the way.

## v3.0 Requirements

### Timeline Alignment

- [x] **CAL-FIX-01**: Time gutter labels (e.g., "9:00 AM") align horizontally with the corresponding grid line in Day, Week, and By Staff views — verified at default zoom and at min/max zoom levels with no pixel offset visible
- [x] **CAL-FIX-02**: Switching between Month, Week, Day, and By Staff views and back leaves no stale layout state — gutter widths, header positions, and event placements re-render correctly without manual reload

### Structural Correctness

- [x] **CAL-FIX-03**: The By Staff multi-column view (Phase 19) continues to render one column per visible staff member after the refactor; column headers, gutter, and event positions remain aligned with the time grid; horizontal scroll behavior for 5+ staff is preserved
- [x] **CAL-FIX-04**: Phase 19 interactive flows (drag-to-reassign with undo toast, QuickBook walk-in modal, GCal busy block guard) function identically before and after the refactor — no regression on the 5 outstanding human UAT items

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAL-FIX-01 | Phase 20 | Not started |
| CAL-FIX-02 | Phase 20 | Not started |
| CAL-FIX-03 | Phase 20 | Not started |
| CAL-FIX-04 | Phase 20 | Not started |

## Notes

- Scope is intentionally narrow (timeline alignment + structural correctness). Performance, mobile responsiveness, and behavior changes are out of scope for v3.0 — open as v3.1 if needed.
- Phase 18 already shipped a `.rbc-label` alignment fix (commit a326c33). If the issue is back, Phase 20 must root-cause why Phase 18's fix regressed (likely Phase 19's DnDCalendar HOC + resourceProps changes).
