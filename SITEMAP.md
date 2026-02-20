# SKLeanings Project Sitemap

## Public Pages (Client-Side Routes)

### Main Pages
- `/` - Home page
- `/services` - Services listing page
- `/booking` - Booking form page
- `/confirmation` - Booking confirmation page
- `/service-areas` - Service areas coverage page
- `/team` - Team members page

### Information Pages
- `/about` - About Us page
- `/contact` - Contact page
- `/faq` - Frequently Asked Questions
- `/blog` - Blog listing page
- `/blog/:slug` - Individual blog post page

### Legal Pages
- `/privacy-policy` - Privacy Policy
- `/terms-of-service` - Terms of Service

### Admin Pages
- `/admin/login` - Admin login page
- `/admin` - Admin dashboard (protected)
- `/admin/*` - Admin sub-routes (protected)

### Error Pages
- `*` (404) - Not Found page

## API Endpoints

### Authentication (`/api`)
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/session` - Get current admin session
- OAuth callback routes (integrated via auth routes)

### Users (`/api/users`)
- `GET /api/users` - List all users (admin)
- `POST /api/users` - Create new user (admin)
- `PUT /api/users/:id` - Update user (admin)
- `DELETE /api/users/:id` - Delete user (admin)

### Chat (`/api`)
- `POST /api/chat` - Send chat message
- `GET /api/conversations` - Get conversations list
- `GET /api/conversations/:id` - Get conversation by ID
- `DELETE /api/conversations/:id` - Delete conversation

### Integrations (`/api/integrations`)
- `POST /api/integrations/openai` - OpenAI integration endpoint
- `POST /api/integrations/ghl` - GoHighLevel integration endpoint
- Additional integration endpoints

### Catalog (`/api`)
- `GET /api/categories` - Get service categories
- `POST /api/categories` - Create category (admin)
- `PUT /api/categories/:id` - Update category (admin)
- `DELETE /api/categories/:id` - Delete category (admin)
- `GET /api/services` - Get services list
- `POST /api/services` - Create service (admin)
- `PUT /api/services/:id` - Update service (admin)
- `DELETE /api/services/:id` - Delete service (admin)

### Availability (`/api`)
- `GET /api/availability` - Get availability slots
- `GET /api/availability/month` - Get month availability
- `POST /api/availability` - Create availability (admin)
- `PUT /api/availability/:id` - Update availability (admin)
- `DELETE /api/availability/:id` - Delete availability (admin)

### Bookings (`/api/bookings`)
- `GET /api/bookings` - Get bookings list (admin)
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id` - Update booking (admin)
- `DELETE /api/bookings/:id` - Delete booking (admin)

### Blog (`/api/blog`)
- `GET /api/blog` - Get blog posts list
- `GET /api/blog/:slug` - Get blog post by slug
- `POST /api/blog` - Create blog post (admin)
- `PUT /api/blog/:id` - Update blog post (admin)
- `DELETE /api/blog/:id` - Delete blog post (admin)

### FAQs (`/api/faqs`)
- `GET /api/faqs` - Get FAQs list
- `POST /api/faqs` - Create FAQ (admin)
- `PUT /api/faqs/:id` - Update FAQ (admin)
- `DELETE /api/faqs/:id` - Delete FAQ (admin)

### Service Areas (`/api/service-areas`)
- `GET /api/service-areas` - Get service areas list
- `POST /api/service-areas` - Create service area (admin)
- `PUT /api/service-areas/:id` - Update service area (admin)
- `DELETE /api/service-areas/:id` - Delete service area (admin)

### Company Settings (`/api`)
- `GET /api/company-settings` - Get company settings
- `PUT /api/company-settings` - Update company settings (admin)

### SEO & Static Files
- `GET /robots.txt` - Robots.txt file
- `GET /sitemap.xml` - XML sitemap for search engines

## Component Structure

### Layout Components
- `Navbar` - Main navigation bar
- `Footer` - Site footer
- `ChatWidget` - Live chat widget

### Admin Components
- `client/src/pages/admin/UserDialog.tsx` - User management dialog
- `client/src/pages/admin/BlogSettings.tsx` - Blog settings panel
- `client/src/pages/admin/UsersSection.tsx` - Users management section

## Context Providers
- `ThemeProvider` - Theme management
- `CompanySettingsProvider` - Company settings state
- `AuthProvider` - Admin authentication
- `CartProvider` - Shopping cart state
- `QueryClientProvider` - React Query client
- `TooltipProvider` - UI tooltips
- `AnalyticsProvider` - Analytics tracking (GTM, GA4, Facebook Pixel)
- `SEOProvider` - SEO metadata management

## External Integrations
- Google Tag Manager (GTM)
- Google Analytics 4 (GA4)
- Facebook Pixel
- Vercel Analytics
- Vercel Speed Insights
- OpenAI API
- GoHighLevel CRM

## Database Schema Location
- `shared/schema.ts` - Drizzle tables + Zod schemas

## Build Output
- `dist/` - Production build output
