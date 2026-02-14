# Vercel Deployment

This guide explains how to deploy the application on Vercel.

## Required Configuration

### 1. Environment Variables

Configure the following environment variables in the Vercel dashboard:

**Required:**
- `DATABASE_URL` - PostgreSQL connection URL
- `SESSION_SECRET` - Secret key for sessions (generate a random string)
- `ADMIN_EMAIL` - Administrator email
- `ADMIN_PASSWORD_HASH` - Admin password hash (use bcrypt)

**Optional (depending on features used):**
- `TWILIO_ACCOUNT_SID` - For Twilio integration
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Twilio phone number
- `GHL_API_KEY` - GoHighLevel API key
- `GHL_LOCATION_ID` - GoHighLevel location ID
- `OPENAI_API_KEY` - OpenAI API key (for chat)

### 2. Database

The project uses PostgreSQL. Recommendations:
- **Vercel Postgres** - Native integration
- **Supabase** - Free managed PostgreSQL
- **Neon** - Serverless PostgreSQL

### 3. Configuration Files

The following files have been configured for Vercel:

#### `vercel.json`
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ],
  "functions": {
    "api/index.js": {
      "maxDuration": 30
    }
  }
}
```

#### `api/index.ts`
Serverless handler that processes all requests (API + static assets).

## Deployment Steps

### 1. Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your Git repository
4. Configure environment variables
5. Click "Deploy"

### 2. Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 3. Configure Database

After the first deployment:

```bash
# Push schema to database
npm run db:push
```

Or configure manually by running migrations in `migrations/`.

## Build Structure

```
dist/
├── public/           # Static assets (HTML, CSS, JS from client)
└── index.cjs         # Server bundle (not used on Vercel)

api/
├── index.ts          # Handler source
└── index.js          # Compiled handler (generated on build)
```

## Troubleshooting

### Database connection error
- Verify that `DATABASE_URL` is configured
- Confirm that the database allows connections from Vercel
- Use SSL if necessary: `?sslmode=require`

### Request timeout
- Adjust `maxDuration` in `vercel.json` (max: 300s on Pro)
- Optimize slow queries

### Assets not loading
- Verify that the build generated `dist/public/`
- Confirm that `outputDirectory` is correct

### Sessions not persisting
- Configure `SESSION_SECRET` in environment variables
- For multiple instances, use session store (Redis/Postgres)

## Performance

### Cold Starts
- First request may be slow (~2-5s)
- Subsequent requests are fast (<100ms)

### Optimizations
- Bundle includes critical dependencies (allowlist in build.ts)
- Minification enabled
- Static asset caching

## Limitations

- **Maximum execution:** 10s (Hobby), 60s (Pro), 900s (Enterprise)
- **Bundle size:** 50MB uncompressed
- **Region:** Configure in Settings → Functions → Region

## Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
