# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-02)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v0.3 — planning

## Current Position

Milestone: v0.2 Staff Members ✅ COMPLETE
Phase: All 5 phases complete
Status: Ready to plan v0.3
Last activity: 2026-04-02 — Google Calendar credentials moved to Admin DB (hotfix), transition complete

Progress:
- v0.2 Milestone: [██████████] 100% — SHIPPED

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Milestone complete — ready for /paul:plan v0.3]
```

## Accumulated Context

### Decisions
| Decision | Context | Impact |
|----------|---------|--------|
| `staffMembers` table separate from `users` | `users` is admin auth only | Staff CRUD is independent of auth system |
| `staffMemberId` nullable on `bookings` | Backward compat | Existing bookings unaffected |
| All integrations optional | GHL, Google Calendar are opt-in per staff/deployment | Feature works without any external integrations |
| Unified calendar (not per-staff) | UX requirement | Availability engine must merge staff slots transparently |
| Hide staff UI when count ≤ 1 | UX requirement | No disruption for single-operator deployments |
| Google Calendar creds in integrationSettings DB | User correction: credentials belong in Admin UI, not env vars | Setup is self-serve; no env var config needed |

### Deferred Issues
None.

### Blockers/Concerns
None — all phases complete, all blockers resolved.

### Git State
Branch: feature/staff-members
Status: All changes staged, ready to commit

## Session Continuity

Last session: 2026-04-02
Stopped at: v0.2 milestone complete — all changes uncommitted on feature/staff-members
Next action: git commit → merge feature/staff-members → main → plan v0.3
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
