---
phase: 14-admin-calendar-create-booking-from-slot
plan: 02
subsystem: admin/calendar
tags: [admin, calendar, booking, type-ahead, contacts, react-query, debounce]
dependency_graph:
  requires:
    - 14-01-SUMMARY.md (booking form scaffold — customerName FormField, react-hook-form, apiRequest already imported)
    - server/routes/contacts.ts (GET /api/contacts?search=&limit= — admin cookie auth via requireAdmin)
    - client/src/components/ui/command.tsx (shadcn Command primitives)
    - client/src/components/ui/popover.tsx (already imported by Plan 01)
    - client/src/lib/queryClient.ts (apiRequest sends credentials: "include")
  provides:
    - useDebounced<T>(value, ms) helper at module scope
    - ContactSuggestion local type
    - Customer-name Popover/Command listbox driven by debounced /api/contacts query
    - Four-field auto-fill (name/phone/email/address) on suggestion select
  affects:
    - client/src/components/admin/AppointmentsCalendarSection.tsx
tech_stack:
  added: []
  patterns:
    - useDebounced custom hook (250 ms via setTimeout cleanup) — no new dep
    - useQuery enabled-gated by (popover open && debouncedSearch.trim().length >= 2)
    - Plain apiRequest('GET', ...) for admin-cookie-authed routes (NOT authenticatedRequest with Bearer token)
    - Popover with onOpenAutoFocus={(e) => e.preventDefault()} to keep focus on the typing input
    - Command shouldFilter={false} — server already filtered the results
    - form.setValue(..., { shouldValidate: true }) on suggestion select for instant validation feedback
key_files:
  created: []
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx
decisions:
  - Inline ContactSuggestion type (id/name/phone/email/address) — narrower than full Contact from @shared/schema, keeps the queryFn body self-contained and free of cross-file coupling
  - Plain apiRequest (not authenticatedRequest) — admin auth is cookie-based via requireAdmin; Bearer token would silently no-op because getAccessToken returns the Supabase customer-portal token, absent in admin sessions
  - 250 ms debounce — matches the must_haves spec (≥250 ms); short enough to feel live, long enough to skip per-keystroke fetches
  - 8-result limit on the suggestions endpoint — small surface for a popover; full Contacts page handles broader search elsewhere
  - shouldFilter={false} on <Command> — the server already filtered; client filtering would re-filter on the client display value (`${id}-${name}`) and cause empty lists
  - Popover open expression `contactSearchOpen && debouncedContactSearch.trim().length >= 2` — guarantees the popover stays closed for empty/short inputs even if `contactSearchOpen` is stale
  - onOpenAutoFocus prevented — Radix Popover would otherwise pull focus to the popover content; we want the user to keep typing in the Input
  - Free-text always wins on submit — Selecting a suggestion writes to the form state via setValue but does NOT lock the field; subsequent typing overrides (D-06)
metrics:
  duration_minutes: 2
  completed_date: "2026-04-28"
  tasks_completed: 1
  commits: 1
---

# Phase 14 Plan 02: Customer Type-Ahead Summary

Adds a customer type-ahead to the Create-Booking modal: typing ≥2 chars in the customer-name field opens a debounced `<Popover>` listbox of contact matches from `GET /api/contacts?search=…&limit=8`. Clicking a suggestion fills name/phone/email/address; free-text typing remains the source of truth.

## What Was Built

### `useDebounced<T>` Helper (module scope)

Tiny debounce hook placed alongside `addMinutesToHHMM` (line 170):

```ts
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
```

No new dependency added; `useState`/`useEffect` were already imported at the top of the file.

### Contact Search State + Query

Inside the component, after the existing `form.watch` lines:

```ts
type ContactSuggestion = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

const [contactSearchOpen, setContactSearchOpen] = useState(false);
const watchedCustomerName = form.watch('customerName');
const debouncedContactSearch = useDebounced(watchedCustomerName, 250);

const { data: contactSuggestions = [], isLoading: contactsLoading } = useQuery<ContactSuggestion[]>({
  queryKey: ['/api/contacts', debouncedContactSearch],
  queryFn: async () => {
    const res = await apiRequest(
      'GET',
      `/api/contacts?search=${encodeURIComponent(debouncedContactSearch)}&limit=8`,
    );
    return res.json();
  },
  enabled: contactSearchOpen && debouncedContactSearch.trim().length >= 2,
  staleTime: 30_000,
});
```

### Auth Choice — Cookie, NOT Bearer Token

Confirmed: the contacts endpoint (`server/routes/contacts.ts:8`) uses `requireAdmin`, which is **cookie-based** in this codebase. The queryFn uses plain `apiRequest('GET', ...)` — `apiRequest` sends `credentials: "include"` (`client/src/lib/queryClient.ts:47`), which carries the admin session cookie.

Explicitly NOT used: `authenticatedRequest(...)` with a Bearer token. `getAccessToken()` returns the Supabase customer-portal token; in an admin session that token is absent and the helper would silently return `[]` via the `if (!token) return []` guard — the type-ahead would never load. This file does still use `getAccessToken` elsewhere (lines 356/399/411/461/519, pre-existing) for the bookings/staff queries; the contacts queryFn is the only intentionally-cookie-only query.

### Popover/Command Listbox

The `customerName` `<FormField>` body is wrapped in a `<Popover>`:

- `open={contactSearchOpen && debouncedContactSearch.trim().length >= 2}` — popover stays closed for empty/short input even if user re-focuses
- `<PopoverTrigger asChild>` wraps the existing `<Input>` — input is the trigger, no separate button
- `onFocus` opens the popover when re-focusing on a 2+ char value (re-search of past input)
- `onChange` propagates the field change AND toggles the popover open state based on the new length
- `<PopoverContent>` width matches the input via `w-[--radix-popover-trigger-width]`
- `onOpenAutoFocus={(e) => e.preventDefault()}` — Radix would otherwise pull focus into the popover; we want the user to keep typing in the Input

### Listbox States

- `contactsLoading` → "Searching…" muted text
- `contactSuggestions.length === 0` → `<CommandEmpty>No matches — type a new name to create</CommandEmpty>`
- Otherwise → `<CommandGroup heading="Existing customers">` with one `<CommandItem>` per result. Each item shows the name (medium weight) and a muted secondary line of `phone · email`.

### Suggestion Selection

`onSelect` fires four `form.setValue` calls and closes the popover:

```ts
form.setValue('customerName', c.name, { shouldValidate: true });
form.setValue('customerPhone', c.phone ?? '', { shouldValidate: true });
form.setValue('customerEmail', c.email ?? '', { shouldValidate: true });
form.setValue('customerAddress', c.address ?? '', { shouldValidate: true });
setContactSearchOpen(false);
```

`shouldValidate: true` triggers immediate Zod re-validation (Plan 01's `bookingFormSchema` has min-length rules on name/phone/address) so any selection that satisfies the rules clears the error state without waiting for blur.

Free-text typing is preserved: after selection the field is editable; the user can continue typing and overwrite any auto-filled value. Selection is a convenience only — never a lock.

## File Diff Summary

**`client/src/components/admin/AppointmentsCalendarSection.tsx`**

- Imports added: `Command`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandList` from `@/components/ui/command`
- Module scope: `useDebounced<T>` helper (8 lines after `addMinutesToHHMM`)
- Component body: `ContactSuggestion` type alias, `contactSearchOpen` state, `watchedCustomerName`, `debouncedContactSearch`, `useQuery` for `/api/contacts` (28 lines, placed after the existing `watch` block)
- Modal body: customerName `<FormField>` body replaced with the Popover/Command listbox version (~70 lines, replacing the prior 4-line plain Input)

Net change: 111 insertions, 7 deletions in a single commit.

## Auth Note

The contacts type-ahead query is the ONLY query in this file that uses plain `apiRequest`. Other queries on the page (bookings, staff, calendar) use `authenticatedRequest` with a Bearer token because they were originally wired to a Supabase-token path. The plan explicitly chose the cookie path for `/api/contacts` to match the admin route's `requireAdmin` behaviour and to avoid the silent-no-op trap if a Supabase token isn't present in an admin session.

## Deviations from Plan

None — plan executed exactly as written. The inline `ContactSuggestion` type was used (not the full `Contact` type from `@shared/schema`) because it keeps the queryFn body self-contained and avoids importing a wider type than needed.

## Acceptance Criteria

- File contains `function useDebounced<T>(` — PASS (line 170)
- File contains `queryKey: ['/api/contacts', debouncedContactSearch]` — PASS (line 600)
- File contains `?search=${encodeURIComponent(debouncedContactSearch)}&limit=8` — PASS (line 604)
- Contacts queryFn uses plain `apiRequest('GET',` — PASS (lines 602–605)
- Contacts queryFn body does NOT contain `getAccessToken` — PASS (other queries use it; the contacts queryFn at lines 601–607 does not)
- Contacts queryFn body does NOT contain `authenticatedRequest` — PASS (the contacts queryFn uses plain `apiRequest`)
- Contacts queryFn body does NOT contain `if (!token) return []` — PASS (no token guard, no token fetched)
- File contains `enabled: contactSearchOpen && debouncedContactSearch.trim().length >= 2` — PASS (line 608)
- File contains `form.setValue('customerName', c.name` — PASS (line 1068)
- File contains `form.setValue('customerPhone', c.phone` — PASS (line 1069)
- File contains `form.setValue('customerEmail', c.email` — PASS (line 1070)
- File contains `form.setValue('customerAddress', c.address` — PASS (line 1071)
- File contains `from '@/components/ui/command'` — PASS (line 64)
- File contains `onOpenAutoFocus={(e) => e.preventDefault()}` — PASS (line 1053)
- `npm run check` exits 0 — PASS
- `npm run build` exits 0 — PASS (3 pre-existing esbuild `import.meta` warnings in cjs server output, unrelated to this plan, same as Plan 01 noted)

## Commits

- `0db6b92` feat(14-02): wire customer name field to debounced /api/contacts type-ahead

## What Plan 03 Will Add

Replaces the placeholder `onSubmit` (still a `console.log`) with the real `useMutation` against `POST /api/bookings`:
- Maps `{ serviceId, quantity }` → `cartItems` array per the API contract
- Applies defaults `status: 'confirmed'` (D-10) / `paymentMethod: 'site'` (D-11)
- On 201: close modal, invalidate `['/api/bookings']`, toast (D-15)
- On 409: inline conflict message (D-16)
- On 400: surface field-level Zod errors (D-17)
- Includes the manual smoke checkpoint covering both the form and the type-ahead

## Self-Check: PASSED

- File `client/src/components/admin/AppointmentsCalendarSection.tsx` exists — FOUND
- Commit `0db6b92` exists — FOUND
- All acceptance criteria met
- `npm run check` exits 0 (no TypeScript regressions)
- `npm run build` exits 0 (production build succeeds; pre-existing unrelated warnings only)
