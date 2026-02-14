# Booking Feature Documentation

This document explains how the booking system works in Skleanings.

## Overview

The booking system allows customers to:
- Add services to cart with various pricing types
- Select available date and time slots
- Enter contact and address information
- Complete bookings with automatic calendar sync

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   BookingPage   │────>│  Booking API    │────>│   GoHighLevel   │
│   (Frontend)    │<────│  (Backend)      │<────│   Calendar      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        v                       v
┌─────────────────┐     ┌─────────────────┐
│  CartContext    │     │   PostgreSQL    │
│  (State)        │     │   Database      │
└─────────────────┘     └─────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `client/src/pages/BookingPage.tsx` | 4-step booking UI |
| `client/src/pages/Confirmation.tsx` | Success page |
| `client/src/hooks/use-booking.ts` | API hooks |
| `client/src/context/CartContext.tsx` | Cart state management |
| `server/routes.ts` | Booking API endpoints |
| `server/storage.ts` | Database operations |
| `server/integrations/ghl.ts` | GoHighLevel sync |
| `shared/schema.ts` | Database & validation schemas |

## Database Schema

### `bookings`
Main booking record:
```typescript
{
  id: serial,
  customerName: text,
  customerEmail: text,
  customerPhone: text,
  customerAddress: text,
  customerStreet: text,
  customerCity: text,
  customerState: text,
  bookingDate: date,        // YYYY-MM-DD
  startTime: text,          // HH:MM
  endTime: text,            // HH:MM
  totalDurationMinutes: integer,
  totalPrice: numeric(10,2),
  paymentMethod: text,      // "site" or "online"
  paymentStatus: text,      // "unpaid" or "paid"
  status: text,             // "pending", "confirmed", "cancelled", "completed"
  ghlAppointmentId: text,   // GoHighLevel sync
  ghlContactId: text,
  ghlSyncStatus: text,      // "pending", "synced", "failed"
  createdAt: timestamp
}
```

### `bookingItems`
Line items with price snapshots:
```typescript
{
  id: serial,
  bookingId: integer,       // FK to bookings
  serviceId: integer,       // FK to services
  serviceName: text,        // Snapshot at booking time
  price: numeric(10,2),     // Final calculated price
  quantity: integer,
  pricingType: text,        // Pricing type snapshot
  areaSize: text,           // e.g., "Medium Room"
  areaValue: numeric,       // Actual sqft
  selectedOptions: jsonb,   // Array of options
  selectedFrequency: jsonb, // Frequency discount
  customerNotes: text,
  priceBreakdown: jsonb     // Full calculation audit
}
```

### `timeSlotLocks`
Prevents race conditions:
```typescript
{
  bookingDate: date,
  startTime: text,
  conversationId: uuid,     // For chat bookings
  lockedAt: timestamp,
  expiresAt: timestamp      // 30-second TTL
}
```

## Booking Flow

### Step 1: Cart Building (Services Page)
Customer browses services and adds to cart.

### Step 2: Schedule Selection
```
1. Load monthly availability
   GET /api/availability/month?month=2026-01&duration=60
   Returns: { "2026-01-27": true, "2026-01-28": false, ... }

2. Select date, load time slots
   GET /api/availability?date=2026-01-27&totalDurationMinutes=60
   Returns: [{ time: "09:00", available: true }, ...]

3. Select time slot
```

### Step 3: Contact Information
- Customer name (required)
- Email (optional)
- Phone (required, 10+ digits)

### Step 4: Address & Payment
- Street address (required)
- City, State
- Unit/Apt (optional)
- Payment method: "Pay on Site" (default)

### Step 5: Confirmation
- Booking created
- Cart cleared
- Analytics tracked
- Redirect to confirmation page

## API Endpoints

### Core Booking Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/bookings` | Create new booking |
| GET | `/api/bookings` | List all bookings (admin) |
| GET | `/api/bookings/:id/items` | Get booking line items |
| PATCH | `/api/bookings/:id` | Update status/payment |
| DELETE | `/api/bookings/:id` | Delete booking |

### Availability Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/availability` | Get time slots for date |
| GET | `/api/availability/month` | Get available dates for month |

## Create Booking Request

```typescript
POST /api/bookings

{
  customerName: "John Doe",
  customerEmail: "john@example.com",
  customerPhone: "5551234567",
  customerAddress: "123 Main St, City, ST 12345",
  customerStreet: "123 Main St",
  customerCity: "City",
  customerState: "ST",
  paymentMethod: "site",
  bookingDate: "2026-01-27",
  startTime: "10:00",
  totalDurationMinutes: 90,
  totalPrice: 150.00,
  cartItems: [
    {
      serviceId: 1,
      quantity: 1,
      calculatedPrice: 100.00,
      areaSize: "Medium Room",
      areaValue: 200,
      selectedOptions: [
        { optionId: 5, name: "Extra Bedroom", price: 25, quantity: 2 }
      ],
      selectedFrequency: { id: 2, name: "Weekly", discountPercent: 10 },
      priceBreakdown: {
        basePrice: 75,
        optionsTotal: 50,
        subtotal: 125,
        discountPercent: 10,
        discountAmount: 12.50,
        finalPrice: 112.50
      }
    }
  ]
}
```

## Pricing Types

### 1. `fixed_item`
Simple per-service price.
```
Price = service.price × quantity
```

### 2. `area_based`
Price based on square footage.
```
Options:
- Preset sizes: "Small Room" = $50, "Medium Room" = $75
- Custom: price_per_sqft × entered_sqft

Minimum price floor enforced.
```

### 3. `base_plus_addons`
Base price plus optional add-ons with frequency discount.
```
Price = (basePrice + optionsTotal) × (1 - discountPercent)

Example:
  Base: $100
  Options: Extra Bedroom ($25) × 2 = $50
  Subtotal: $150
  Frequency: Weekly (-10%)
  Final: $135
```

### 4. `custom_quote`
No fixed price, customer describes needs.

## Cart Item Structure

```typescript
interface CartItem {
  // Service data
  id: number
  name: string
  price: number
  durationMinutes: number
  pricingType: string

  // Cart-specific
  quantity: number
  calculatedPrice: number

  // Area-based pricing
  areaSize?: string
  areaValue?: number

  // Base + addons pricing
  selectedOptions?: {
    optionId: number
    name: string
    price: number
    quantity: number
  }[]

  // Frequency discount
  selectedFrequency?: {
    id: number
    name: string
    discountPercent: number
  }

  // Custom quote
  customerNotes?: string

  // Audit trail
  priceBreakdown?: {
    basePrice?: number
    areaPrice?: number
    optionsTotal?: number
    subtotal: number
    discountPercent?: number
    discountAmount?: number
    finalPrice: number
  }
}
```

## Availability Logic

### Time Slot Generation

```
1. Load business hours for day of week
   { monday: { isOpen: true, start: "08:00", end: "18:00" } }

2. If GHL enabled, fetch free slots from calendar

3. Load existing bookings for date

4. Generate 30-minute slots within business hours

5. Mark slot unavailable if:
   - Conflicts with existing booking
   - Not in GHL free slots
   - In the past (if today)
   - Duration exceeds closing time
```

### Conflict Detection

```typescript
function hasConflict(newStart, newEnd, existingBookings) {
  return existingBookings.some(booking => {
    const bookingStart = booking.startTime
    const bookingEnd = booking.endTime
    return newStart < bookingEnd && newEnd > bookingStart
  })
}
```

## GoHighLevel Integration

### Sync Flow

```
1. Booking created locally
          │
          v
2. Get/Create GHL Contact
   POST /contacts/upsert
   { email, phone, name, address }
          │
          v
3. Create GHL Appointment
   POST /calendars/events
   { calendarId, contactId, startTime, endTime }
          │
          v
4. Update booking with sync status
   { ghlContactId, ghlAppointmentId, ghlSyncStatus }
```

### Timezone Handling

- All times stored in `America/New_York`
- DST automatically handled (EST/EDT)
- Format: `2026-01-27T10:00:00-05:00`

### Error Handling

GHL sync is **non-blocking**:
- If sync fails, booking still succeeds
- `ghlSyncStatus` set to "failed"
- Admin can retry sync later

## Chat Booking Flow

The AI chat can create bookings directly:

```
1. Check booking limit (max 3/hour per conversation)
2. Acquire time slot lock (30-second TTL)
3. Validate all required fields
4. Check GHL availability
5. Create booking locally
6. Sync to GHL
7. Release lock
8. Return confirmation
```

### Time Slot Locks

Prevents double-booking during concurrent requests:
```typescript
await storage.acquireTimeSlotLock(date, time, conversationId, 30000)
// ... create booking ...
await storage.releaseTimeSlotLock(date, time, conversationId)
```

## Business Configuration

### Company Settings

```typescript
{
  businessHours: {
    monday: { isOpen: true, start: "08:00", end: "18:00" },
    tuesday: { isOpen: true, start: "08:00", end: "18:00" },
    // ...
    saturday: { isOpen: false },
    sunday: { isOpen: false }
  },
  minimumBookingValue: 75.00,
  timeZone: "America/New_York"
}
```

### Integration Settings

```typescript
{
  provider: "gohighlevel",
  apiKey: "***",
  locationId: "abc123",
  calendarId: "2irhr47AR6K0AQkFqEQl",
  isEnabled: true
}
```

## Validation Rules

### Required Fields
- `customerName` - Non-empty string
- `customerPhone` - 10+ digits
- `customerAddress` - 5+ characters
- `bookingDate` - Valid YYYY-MM-DD
- `startTime` - Valid HH:MM
- At least one service in cart

### Business Rules
- Date must be tomorrow or later
- Time must be within business hours
- Duration must fit before closing
- No conflicts with existing bookings
- Total price >= minimum booking value

## Error Responses

| Status | Meaning |
|--------|---------|
| 201 | Booking created successfully |
| 400 | Validation error (missing fields) |
| 409 | Time slot conflict |
| 404 | Booking not found |

## Analytics Tracking

Events tracked on booking completion:
```typescript
trackPurchase({
  transactionId: `booking_${Date.now()}`,
  items: cartItems.map(item => ({
    id: item.id,
    name: item.name,
    price: item.calculatedPrice,
    quantity: item.quantity
  })),
  value: totalPrice
})
```

## Admin Features

### Booking Management
- View all bookings with filters
- Update booking status
- Update payment status
- Delete bookings
- View booking items detail

### GHL Sync Management
- View sync status per booking
- Manual resync option
- Test GHL connection

## Frontend Hooks

### `useBooking()`
```typescript
const { createBooking, isCreating } = useBooking()
await createBooking(bookingData)
```

### `useAvailability(date, duration)`
```typescript
const { data: slots, isLoading } = useAvailability("2026-01-27", 60)
// slots: [{ time: "09:00", available: true }, ...]
```

### `useMonthAvailability(month, duration)`
```typescript
const { data: dates } = useMonthAvailability("2026-01", 60)
// dates: { "2026-01-27": true, "2026-01-28": false }
```

## Storage Methods

```typescript
interface IStorage {
  // Create & Retrieve
  createBooking(data): Promise<Booking>
  getBookings(): Promise<Booking[]>
  getBookingsByDate(date): Promise<Booking[]>
  getBooking(id): Promise<Booking | undefined>
  getBookingItems(bookingId): Promise<BookingItem[]>

  // Update & Delete
  updateBooking(id, updates): Promise<Booking>
  deleteBooking(id): Promise<void>

  // GHL Sync
  updateBookingGHLSync(bookingId, contactId, appointmentId, status)
  getBookingsPendingSync(): Promise<Booking[]>

  // Time Slot Locks
  acquireTimeSlotLock(date, time, conversationId, ttl)
  releaseTimeSlotLock(date, time, conversationId)
  cleanExpiredTimeSlotLocks(): Promise<number>
}
```
