# Skleanings

A full-stack service booking platform for a cleaning company. Customers can browse services by category, add items to cart, select available time slots, and complete bookings. Includes an admin dashboard and GoHighLevel CRM integration.

## Features

- **Service Catalog** - Browse cleaning services organized by categories and subcategories
- **Shopping Cart** - Add multiple services, view totals, and manage selections
- **Booking System** - Select available time slots based on business hours and existing bookings
- **Admin Dashboard** - Manage services, categories, bookings, and business settings
- **GoHighLevel Integration** - Sync bookings and contacts with GHL CRM
- **Responsive Design** - Mobile-friendly interface built with Tailwind CSS

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Wouter for routing
- TanStack React Query for server state
- shadcn/ui + Radix UI components
- Tailwind CSS for styling
- Framer Motion for animations

### Backend
- Express.js with TypeScript
- Drizzle ORM with PostgreSQL
- Session-based authentication with bcrypt
- Zod for validation

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Environment Variables

Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env
npm run env:check
```

Minimum variables to boot locally:

```env
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-session-secret
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
ADMIN_EMAIL=admin@example.com
```

Important production notes:

- On Vercel/serverless, configure `POSTGRES_URL` with the pooled Supabase connection string.
- Keep `DATABASE_URL` and `POSTGRES_URL` pointed at the same database project.
- Set `CRON_SECRET` if you use the blog autopost cron endpoint.
- Never commit real `.env` files, Vercel env pulls, or connection strings with credentials.

**Note:** See [SUPABASE_AUTH_SETUP.md](docs/SUPABASE_AUTH_SETUP.md) for detailed Supabase configuration instructions.

### GitHub Actions Keepalive

The Supabase keepalive runs via GitHub Actions at `.github/workflows/supabase-keepalive.yml`.
It pings Supabase's REST API directly, without depending on Vercel or app endpoints.

Configure these repository secrets:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon API key used for the keepalive probe

### Installation

```bash
# Install dependencies
npm install

# Validate env
npm run env:check

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run check` | TypeScript type checking |
| `npm run env:check` | Validate required env vars and common deployment mistakes |
| `npm run db:push` | Apply database schema changes |

## Project Structure

```
client/src/
├── pages/           # Route components (Home, Services, Admin, Booking)
├── components/      # UI components (ui/ contains shadcn components)
├── hooks/           # Custom hooks (useAuth, useBooking, useSEO)
├── context/         # CartContext, AuthContext
└── lib/             # Utilities

server/
├── index.ts         # Express setup and middleware
├── routes.ts        # API endpoints
├── storage.ts       # Database queries via IStorage interface
├── db.ts            # Database connection
└── integrations/    # GoHighLevel API integration

shared/
├── schema.ts        # Drizzle tables + Zod schemas
└── routes.ts        # Type-safe API route definitions
```

## Database Schema

- `categories` - Service categories
- `subcategories` - Service subcategories
- `services` - Individual cleaning services with pricing
- `serviceAddons` - Cross-sell relationships between services
- `bookings` - Customer booking records
- `bookingItems` - Services included in each booking
- `companySettings` - Business hours, SEO, analytics config
- `integrationSettings` - GoHighLevel credentials
- `faqs` - FAQ entries

## Brand Guidelines

- **Primary Blue**: `#1C53A3`
- **Brand Yellow**: `#FFFF01` (for CTAs)
- **Fonts**: Outfit (headings), Inter (body)

## License

MIT

## Open-Source Hardening

If this repository becomes public, keep these rules in place:

- Treat `.env.example` as the only public source of configuration shape. It should contain placeholders only.
- Rotate all existing production secrets before opening the repository.
- Keep GitHub Actions secrets such as `CRON_SECRET` in repository/environment secrets, never in workflow files.
- Require `npm run env:check` before deploys and when provisioning new environments.
- Prefer pooled Postgres URLs (`POSTGRES_URL`) on serverless platforms like Vercel.
- Keep one canonical production checklist for forks: database, Supabase auth, cron secret, site URL, and provider API keys.
