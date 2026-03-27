# Plan: Nano Banana 2 Image Gen + GitHub/Vercel CLI Setup

## 1. GitHub Actions Secrets/Variables (via `gh cli`)

```bash
# Generate and set CRON_SECRET
gh secret set CRON_SECRET --repo Skale-Club/skleanings --body "$(openssl rand -hex 32)"

# Set APP_URL variable
gh variable set APP_URL --repo Skale-Club/skleanings --body "https://skleanings.com"
```

## 2. Vercel Environment Variable (via `vercel cli`)

```bash
# Set CRON_SECRET on Vercel (all environments: production, preview, development)
vercel env add CRON_SECRET production
vercel env add CRON_SECRET preview
vercel env add CRON_SECRET development
# (each will prompt for value - use same value as GitHub secret)
```

## 3. Nano Banana 2 Integration

### Current state
- `server/services/blog-generator.ts:243-247` — `generatePostImage()` returns a broken Unsplash URL placeholder
- Blog generator uses `@google/generative-ai` SDK with `gemini-1.5-flash` for text
- `server/services/storage.ts:1-30` — `StorageService` exists with `uploadFile()` and `getPublicUrl()` but is unused by blog
- No image upload happens; `featureImageUrl` stores raw URLs

### Changes needed

#### A. Update `generatePostImage` in `server/services/blog-generator.ts`

Replace the Unsplash placeholder with actual Nano Banana 2 image generation:

1. Create a Gemini model instance with `gemini-3.1-flash-image-preview`
2. Build a descriptive prompt based on the blog topic + company context
3. Call `generateContent()` with `generationConfig: { responseModalities: ['Text', 'Image'] }`
4. Extract base64 image data from `response.candidates[0].content.parts`
5. Upload the decoded image buffer to Supabase Storage via `StorageService`
6. Return the public Supabase URL

Key implementation details:
- Use `@google/generative-ai` SDK (already imported)
- Model: `gemini-3.1-flash-image-preview`
- Prompt should be descriptive for blog cover images (e.g., "A professional blog cover image about [topic], clean modern style, 16:9 aspect ratio")
- Upload path: `blog/{slug}-{timestamp}.png`
- Content type: `image/png`
- Bucket: from `SUPABASE_BUCKET_NAME` env var (defaults to `uploads`)

#### B. Import StorageService in blog-generator.ts

```typescript
import { storageService } from "../services/storage";
```

#### C. Error handling

- If image generation fails, fall back to a gradient placeholder SVG data URL (not broken Unsplash)
- Log the error but don't fail the entire post generation
- The post should still be created as draft even if image fails

### Files to modify
- `server/services/blog-generator.ts` — Replace `generatePostImage` method + add StorageService import

### No schema changes needed
- `featureImageUrl` already stores URL strings
- Supabase Storage bucket already exists (`uploads`)
