# Technology Stack

**Analysis Date:** 2026-04-04

## Languages

**Primary:**
- TypeScript 5.6.3 - Full-stack (client, server, shared)

**Secondary:**
- JavaScript (ES2018 target via Vite transpilation)

## Runtime

**Environment:**
- Node.js 20.x (LTS)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present

## Frameworks

**Frontend:**
- React 18.3.1 - UI framework
- Vite 5.4.11 - Build tool and dev server
- wouter 3.3.5 - Routing

**Backend:**
- Express 4.21.2 - HTTP server framework

**Database:**
- PostgreSQL - Primary database
- Drizzle ORM 0.39.3 - Query builder and ORM
- Drizzle Kit 0.31.8 - CLI for migrations

**Testing:**
- Not configured (manual testing per AGENTS.md)

**Build/Dev:**
- tsx 4.20.5 - TypeScript execution
- esbuild 0.27.2 - Bundling
- TypeScript 5.6.3 - Type checking

## UI Libraries

**Component Libraries:**
- Radix UI primitives (13 components) - Dialog, Dropdown, Select, etc.
- @dnd-kit - Drag and drop functionality
- embla-carousel-react 8.6.0 - Carousel component
- lucide-react 0.453.0 - Icons
- react-icons 5.4.0 - Additional icons

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- tailwindcss-animate 1.0.7 - Animation utilities
- @tailwindcss/typography 0.5.15 - Prose styling
- clsx 2.1.1 - Conditional class joining
- tailwind-merge 2.6.0 - Tailwind class merging

**Forms & Validation:**
- react-hook-form 7.55.0 - Form management
- @hookform/resolvers 3.10.0 - Form validation resolvers
- zod 3.24.2 - Schema validation

**State & Data:**
- @tanstack/react-query 5.60.5 - Server state management
- @supabase/supabase-js 2.89.0 - Supabase client

**Animations:**
- framer-motion 11.18.2 - Motion library for React
- tw-animate-css 1.2.5 - Animation utilities

**Charts:**
- recharts 2.15.2 - Charting library

**Date Handling:**
- date-fns 3.6.0 - Date utilities
- react-day-picker 8.10.1 - Date picker component

## Key Backend Dependencies

**AI & Machine Learning:**
- ai 6.0.116 - AI SDK for React
- @ai-sdk/openai 3.0.41 - OpenAI integration
- @ai-sdk/react 3.0.118 - React hooks for AI
- openai 4.104.0 - OpenAI API client
- @google/generative-ai 0.24.1 - Gemini integration
- google-auth-library 10.5.0 - Google OAuth

**Authentication:**
- passport 0.7.0 - Authentication middleware
- passport-local 1.0.0 - Local strategy
- openid-client 6.8.1 - OpenID Connect
- bcrypt 6.0.0 - Password hashing
- express-session 1.18.2 - Session management
- memorystore 1.6.7 - Session storage

**Database:**
- pg 8.16.3 - PostgreSQL driver
- drizzle-orm 0.39.3 - ORM
- drizzle-zod 0.7.0 - Zod integration
- connect-pg-simple 10.0.0 - PostgreSQL session store

**Payments:**
- stripe 21.0.1 - Payment processing

**Communications:**
- twilio 5.11.2 - SMS and voice

**File Storage:**
- @google-cloud/storage 7.18.0 - Google Cloud Storage
- @uppy/aws-s3 5.1.0 - S3 uploads
- @uppy/core 5.2.0 - Upload UI framework
- @uppy/dashboard 5.1.0 - Upload dashboard

**Utilities:**
- dotenv 17.2.3 - Environment loading
- dompurify 3.3.3 - HTML sanitization
- zod-validation-error 3.4.0 - Zod error formatting
- ws 8.18.0 - WebSocket support
- node-cron 4.2.1 - Cron scheduling

## Dev Dependencies

**TypeScript Support:**
- @types/react 18.3.11
- @types/react-dom 18.3.1
- @types/node 20.19.27
- @types/express 4.17.21
- @types/ws 8.5.13
- @types/bcrypt 6.0.0
- @types/passport 1.0.17

**Build Tools:**
- cross-env 10.1.0 - Cross-platform env vars
- @vitejs/plugin-react 4.3.4 - React Vite plugin

**Vercel:**
- @vercel/node 3.0.0 - Vercel runtime
- @vercel/analytics 1.6.1 - Analytics
- @vercel/speed-insights 1.3.1 - Performance monitoring

**Development Experience:**
- @replit/vite-plugin-cartographer 0.4.4 - Component mapping
- @replit/vite-plugin-dev-banner 0.1.1 - Dev banner
- @replit/vite-plugin-runtime-error-modal 0.0.3 - Error display

## Configuration Files

**TypeScript:**
- `tsconfig.json` - Target ES2018, strict mode enabled

**Vite:**
- `vite.config.ts` - React plugin, path aliases (@, @shared)

**Tailwind:**
- `tailwind.config.ts` - Custom colors, animations, typography

**PostCSS:**
- `postcss.config.js` - Autoprefixer integration

**Drizzle:**
- `drizzle.config.ts` - PostgreSQL migrations

**Component Registry:**
- `components.json` - shadcn/ui component tracking

## Platform Requirements

**Development:**
- Node.js 20.x
- PostgreSQL database (local or cloud)
- Environment variables in `.env`

**Production:**
- Vercel deployment (inferred from vercel.json and @vercel/* packages)
- PostgreSQL database (Supabase or similar)
- Environment variables injected by platform

---

*Stack analysis: 2026-04-04*
