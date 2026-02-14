# SEO Injection System - Eliminating FODC

## Original Problem

The application displayed a **FODC (Flash of Default Content)** for ~2 seconds after page load:

- **Browser tab**: "Skleanings | Your 5-Star Cleaning Company" → then changed to configured value
- **Cause**: Hardcoded values in `index.html` while React Query fetched real data from `/api/company-settings`

## Implemented Solution

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BUILD TIME                                │
├─────────────────────────────────────────────────────────────────┤
│  1. npm run build                                                │
│  2. Vite loads seoInjectPlugin                                   │
│  3. Plugin connects to DATABASE_URL                              │
│  4. Fetches company_settings (seo_title, seo_description, etc)   │
│  5. Injects values into dist/public/index.html                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        RUNTIME                                   │
├─────────────────────────────────────────────────────────────────┤
│  1. Browser loads index.html (already has correct SEO data)      │
│  2. Initial loader (dots animation) covers the screen            │
│  3. React app boots, CompanySettingsProvider fetches settings    │
│  4. PageWrapper waits for settings to be ready (isReady: true)   │
│  5. Loader fades out, content becomes visible                    │
│  6. useSEO hook updates any remaining meta tags client-side      │
└─────────────────────────────────────────────────────────────────┘
```

## Files Created

| File | Purpose |
|------|---------|
| `script/seo-inject-plugin.ts` | Vite plugin that fetches DB data and injects into HTML during build |
| `client/src/context/CompanySettingsContext.tsx` | Centralized React context for company settings |

## Files Modified

| File | Changes |
|------|---------|
| `client/index.html` | Removed hardcoded title/description (now empty, filled by plugin) |
| `vite.config.ts` | Added `seoInjectPlugin()` to plugins array |
| `script/build.ts` | Added `process.env.NODE_ENV = 'production'` to ensure plugin runs |
| `client/src/App.tsx` | Added `CompanySettingsProvider`, loader waits for settings |
| `client/src/components/layout/Navbar.tsx` | Uses `useCompanySettings()`, no hardcoded fallbacks |
| `client/src/components/layout/Footer.tsx` | Uses `useCompanySettings()`, no hardcoded fallbacks |
| `client/src/pages/Home.tsx` | Uses `useCompanySettings()`, conditional rendering |

## SEO Plugin Details

### Location
`script/seo-inject-plugin.ts`

### What It Injects

| HTML Element | Source Field |
|--------------|--------------|
| `<title>` | `seo_title` |
| `<meta name="description">` | `seo_description` |
| `<meta property="og:title">` | `seo_title` |
| `<meta property="og:description">` | `seo_description` |
| `<meta property="og:image">` | `og_image` |
| `<link rel="icon">` | `logo_icon` |

### Database Query

```sql
SELECT seo_title, seo_description, og_image, logo_icon, company_name
FROM company_settings
LIMIT 1
```

## CompanySettingsContext

### Location
`client/src/context/CompanySettingsContext.tsx`

### Interface

```typescript
interface CompanySettingsContextValue {
  settings: CompanySettings | null;
  isLoading: boolean;
  isReady: boolean;  // true when fetch is complete (success or error)
}
```

### Usage

```typescript
import { useCompanySettings } from "@/context/CompanySettingsContext";

function MyComponent() {
  const { settings, isLoading, isReady } = useCompanySettings();

  // Use settings?.companyName, settings?.companyPhone, etc.
  // No need for hardcoded fallbacks - loader covers until ready
}
```

## Loading Flow

1. **HTML loads** → Initial loader (dots) is visible
2. **React boots** → `CompanySettingsProvider` starts fetching
3. **Page component mounts** → `useHideInitialLoader()` is called
4. **Hook checks** → `isInitialLoad && settingsReady`
5. **When both true** → Loader fades out, content becomes visible

This ensures users never see placeholder/default content.

## Removed Hardcoded Values

The following fallback values were removed from components:

| Component | Removed Value |
|-----------|---------------|
| Navbar | `"(303) 309 4226"` phone fallback |
| Navbar | Hardcoded logo URL fallback |
| Navbar | `"Skleanings"` company name |
| Footer | Hardcoded logo URL fallback |
| Footer | `"Skleanings"` in copyright |
| Home | `"Your 5-star cleaning company"` hero title |
| Home | `"We provide top-quality..."` hero subtitle |
| Home | `"Get Instant Price"` CTA text |
| Home | `"(303) 309 4226"` phone fallback |

## Commands

```bash
# Development (title will be empty in browser tab until API responds)
npm run dev

# Production build (injects SEO data from database)
npm run build

# Start production server
npm run start

# Type check
npm run check
```

## Important Notes

1. **Rebuild Required**: After changing SEO settings in admin, run `npm run build` to update the HTML
2. **Database Required**: Build requires `DATABASE_URL` environment variable
3. **Graceful Degradation**: If DB is unavailable during build, plugin logs warning and uses empty defaults
4. **Development Mode**: In dev, the title/description remain empty until client-side hydration

## Verification

After building, check `dist/public/index.html`:

```html
<!-- Should contain actual values from database -->
<title>Your Configured Title Here</title>
<meta name="description" content="Your configured description...">
<meta property="og:title" content="Your Configured Title Here">
<meta property="og:image" content="/path/to/your/og-image.jpg">
```

## Troubleshooting

### Title still shows default after build
- Verify `DATABASE_URL` is set
- Check build logs for `[SEO Inject]` messages
- Ensure `company_settings` table has `seo_title` populated

### Loader stays visible forever
- Check browser console for errors
- Verify `/api/company-settings` endpoint returns data
- Check `CompanySettingsProvider` is in the component tree

### Flash still occurs
- Ensure you're running production build (`npm run build && npm run start`)
- Development mode will always have empty title until API responds
