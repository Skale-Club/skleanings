---
name: validate-booking
description: Validate all booking data before creating an appointment. Ensures required fields are present, services match the cart, and time slots are available.
---

# Validate Booking Skill

Pre-flight validation before calling `create_booking`.

## Required Fields Check

Before creating a booking, verify ALL required fields are present:

| Field | Source | Validation |
|-------|--------|------------|
| Service(s) | Cart (get_cart) | At least 1 service, valid service IDs |
| Booking date | memory.collectedData.date | ISO format, not in the past |
| Start time | memory.collectedData.time | HH:MM format, within business hours |
| Customer name | conversation.visitorName | Valid name (not a sentence) |
| Customer phone | conversation.visitorPhone | Valid phone number (digits only) |
| Customer address | memory.collectedData.address | Street number + street name minimum |

## Service Validation

### Cart is the source of truth
- Use services from `get_cart`, not from the conversation text
- NEVER substitute services to meet a minimum booking value
- If cart is empty, ask customer to select a service first
- Each service must have a valid `service_id`

### Minimum booking value
- If total is below minimum, INFORM the customer
- Suggest adding another service: "Your total is $X. Our minimum booking is $Y. Would you like to add another service?"
- NEVER silently swap services

## Date/Time Validation

### Date rules
- Must be today or in the future
- Must be within the booking window (typically 1-60 days)
- Weekends may have different availability

### Time rules
- Must be within business hours
- Must not conflict with existing bookings (checked by suggest_booking_dates)
- Must have a valid time slot lock

## Error Response Guidelines

If validation fails, tell the customer what's missing:
- Missing name: "I just need your name to complete the booking."
- Missing phone: "What's the best phone number to reach you?"
- Missing address: "What's the address for the cleaning?"
- Past date: "That date has already passed. When would you like to reschedule?"
- No services: "Let's pick a service first. What do you need cleaned?"

## GHL Sync Fallback

If the booking is created locally but GHL sync fails:
1. Still confirm the booking to the customer
2. Mark as `ghlSyncStatus: 'failed'`
3. Admin will manually sync later
4. Customer message: "You're all set! You'll receive a confirmation shortly."
