---
phase: 25
slug: multiple-time-slots-per-day
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type check (npm run check) + manual browser |
| **Config file** | tsconfig.json |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 25-01-01 | 01 | 1 | SLOTS-01, SLOTS-04 | migration | `test -f supabase/migrations/*range_order*` | ⬜ pending |
| 25-02-01 | 02 | 1 | SLOTS-01, SLOTS-03 | type-check | `npm run check` | ⬜ pending |
| 25-02-02 | 02 | 1 | SLOTS-03 | type-check | `npm run check` | ⬜ pending |
| 25-03-01 | 03 | 2 | SLOTS-02 | type-check + manual | `npm run check` | ⬜ pending |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin adds two ranges to Monday and saves; both appear on reload | SLOTS-01, SLOTS-02 | Requires browser + DB | Open Staff edit → Availability tab → Monday → click + → add 8am-12pm and 2pm-7pm → Save → Reload → confirm both ranges present |
| Customer booking flow shows no slots between 12pm-2pm gap | SLOTS-03 | Requires live slot generation | Book a service for a staff with split Monday hours → confirm no 12pm-2pm slots offered |
| Existing single-range staff shows identical availability after migration | SLOTS-04 | Requires before/after comparison | Before: note current slots for any staff member. After migration: confirm same slots returned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
