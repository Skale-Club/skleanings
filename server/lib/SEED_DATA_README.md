# Seed Data Configuration

This folder contains configurable seed data for initializing new tenant databases in the SaaS platform.

## Overview

The seed system loads data from `seed-data.json` to populate:
- **Categories** - Service categories (e.g., "Upholstery Cleaning", "Carpet Cleaning")
- **Services** - Individual services with pricing and duration
- **FAQs** - Frequently asked questions

## Configuration

### Default Seed Data

By default, the system loads from `server/lib/seed-data.json`. This file contains example data for a cleaning service company.

### Custom Seed Data

To use custom seed data for a different tenant or industry:

1. **Option A: Edit the default file**
   ```bash
   # Edit server/lib/seed-data.json with your data
   ```

2. **Option B: Use environment variable**
   ```bash
   # Set SEED_DATA_PATH to point to your custom JSON file
   export SEED_DATA_PATH=/path/to/custom-seed-data.json
   npm run dev
   ```

## Seed Data Format

```json
{
  "categories": [
    {
      "name": "Category Name",
      "slug": "category-slug",
      "description": "Category description",
      "imageUrl": "https://...",
      "services": [
        {
          "name": "Service Name",
          "description": "Service description",
          "price": "99.00",
          "durationMinutes": 60,
          "imageUrl": "https://..."
        }
      ]
    }
  ],
  "faqs": [
    {
      "question": "What is...?",
      "answer": "The answer is...",
      "order": 1
    }
  ]
}
```

## How Seeding Works

1. **On server startup**, `server/routes.ts` calls `seedDatabase()` and `seedFaqs()`
2. **If data already exists** in the database, seeding is skipped
3. **If seed file is missing**, a warning is logged and seeding is skipped
4. **If seed file is invalid**, an error is logged and seeding is skipped

## Multi-Tenant SaaS Usage

For a multi-tenant SaaS platform, you can:

1. **Store seed data per tenant** in a database table
2. **Load seed data from S3/cloud storage** based on tenant ID
3. **Create onboarding flow** where new tenants configure their services via UI
4. **Use environment-specific seed files** (e.g., `seed-data.production.json`, `seed-data.staging.json`)

## Disabling Seed Data

To deploy without seed data (e.g., for a fresh SaaS instance):

1. Set `SEED_DATA_PATH` to a non-existent file:
   ```bash
   export SEED_DATA_PATH=/dev/null
   ```

2. Or delete/rename `server/lib/seed-data.json`

## Example: Pet Grooming Service

```json
{
  "categories": [
    {
      "name": "Dog Grooming",
      "slug": "dog-grooming",
      "description": "Professional grooming services for dogs of all sizes",
      "services": [
        {
          "name": "Small Dog Bath & Trim",
          "description": "Complete grooming for dogs under 25 lbs",
          "price": "45.00",
          "durationMinutes": 60
        },
        {
          "name": "Large Dog Bath & Trim",
          "description": "Complete grooming for dogs over 50 lbs",
          "price": "75.00",
          "durationMinutes": 90
        }
      ]
    }
  ],
  "faqs": [
    {
      "question": "Do you groom aggressive dogs?",
      "answer": "We work with dogs of all temperaments. Please let us know about any behavioral concerns when booking.",
      "order": 1
    }
  ]
}
```

## Migration from Hardcoded Values

The old system had hardcoded cleaning services in `server/lib/seeds.ts`. This has been replaced with the JSON-based configuration system. No database migration is needed - existing data is preserved.
