# Phase 17: Favicon, Legal & Company Type Admin UI — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md.

**Date:** 2026-04-30
**Phase:** 17-favicon-legal-company-type-admin-ui
**Areas discussed:** Legal pages rendering, Legal content editor format, Favicon field strategy, Admin UI placement

---

## Favicon Field Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| New faviconUrl field + Supabase migration | Keeps favicon semantically separate from logoIcon. Matches FAV-02 spec. Requires one migration. | ✓ |
| Reuse existing logoIcon field | No new migration. Conflates logo and favicon. | |

**User's choice:** New faviconUrl field (Recommended)

---

## Legal Pages Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| DB content replaces everything | Hardcoded template removed. Empty DB = placeholder card. Clean white-label. | ✓ |
| DB content shown above template | DB content in box + hardcoded sections below. Template is cleaning-specific. | |
| DB content replaces intro only | Template stays; only intro is customizable. | |

**User's choice:** DB content replaces everything (Recommended)

---

## Empty State Placeholder

| Option | Description | Selected |
|--------|-------------|----------|
| Simple notice + contact email | "Our privacy policy is being updated. Contact [email]." Looks intentional. | ✓ |
| Generic placeholder text | Risk of real visitors confusing placeholder for actual policy. | |
| Redirect to homepage | Loses SEO value of URL. | |

**User's choice:** Simple notice + contact email (Recommended)

---

## Legal Content Editor Format

| Option | Description | Selected |
|--------|-------------|----------|
| Plain textarea — paste HTML or plain text | No new dependencies. Admin pastes from legal generators. dangerouslySetInnerHTML on render. | ✓ |
| Markdown with live preview | Requires marked/remark library. Admin must know Markdown. | |
| Rich text editor (Tiptap/Quill) | Best UX but ~200KB+ dependency. Overkill for once-edited content. | |

**User's choice:** Plain textarea (Recommended)

---

## Editor UX (word count)

| Option | Description | Selected |
|--------|-------------|----------|
| No — just a tall textarea | Simple. | ✓ |
| Yes — character count | Adds signal that content was saved. | |

**User's choice:** No word count (Recommended)

---

## Favicon Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Phase 16 SEO injector with {{FAVICON_URL}} token | Zero new routes. Works with existing infrastructure. | ✓ |
| Express /favicon.ico redirect route | Matches FAV-02 spec literally but less effective than <link> tag. | |
| Client-side only via useSEO hook | No server changes but crawlers see old favicon from index.html. | |

**User's choice:** Extend SEO injector (Recommended)

---

## Favicon Admin Input

| Option | Description | Selected |
|--------|-------------|----------|
| URL input + upload button | Paste URL or upload to Supabase. Most flexible. | |
| URL input only | Simple but limits to external URLs. | |
| Upload button only | Consistent Supabase storage, fewer edge cases. | ✓ |

**User's choice:** Upload button only

---

## Admin UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New "Legal & Branding" sub-tab in Company Settings | Groups all Phase 17 fields. Doesn't clutter existing tabs. | ✓ |
| Append to existing general tab | Long page, less organized. | |
| You decide | Defer to executor. | |

**User's choice:** New "Legal & Branding" sub-tab (Recommended)

---

## Service Delivery Model Selector

| Option | Description | Selected |
|--------|-------------|----------|
| Radio group with descriptive labels | Readable. 3 options with title + subtitle. | ✓ |
| Select dropdown | Compact but less scannable. | |
| Toggle cards | Visual but more effort. | |

**User's choice:** Radio group with descriptive labels (Recommended)

---

## Claude's Discretion

- Migration filename and column position
- Whether to use a single form or separate forms per section in the Legal & Branding tab
- Exact tab label ("Legal & Branding" vs "Branding & Legal" vs "Legal")
- Whether faviconUrl needs explicit addition to publicCompanySettingsFallback

## Deferred Ideas

- Markdown rendering for legal content
- Legal version history
- Custom /privacy and /terms URL slugs
- /favicon.ico Express redirect route (FAV-02 spec literal)
- Sitemap.xml (already listed)
