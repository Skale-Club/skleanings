# Chat System Architecture

This folder contains all documentation, prompts, and skills for the AI chat booking assistant.

## Structure

```
docs/chat/
├── README.md              # This file - architecture overview
├── prompt.md              # Main system prompt (loaded at runtime by server/routes.ts)
├── agents/                # Sub-agent prompts for specific responsibilities
│   ├── intake.md          # Collect customer info step by step
│   ├── service-match.md   # Match services and manage cart
│   ├── booking.md         # Date selection, availability, booking creation
│   └── faq.md             # FAQ and out-of-flow question handling
└── skills/                # Reusable validation/parsing skills
    ├── parse-contact/     # Extract name, phone, email from free text
    │   └── SKILL.md
    ├── validate-booking/  # Validate all booking data before creation
    │   └── SKILL.md
    └── format-response/   # Consistent response formatting
        └── SKILL.md
```

## How It Works

The main `prompt.md` is loaded by `server/routes.ts` at startup. It defines the AI's personality, rules, and references the sub-agents for specific tasks.

**Sub-agents** are focused instruction sets. The main prompt delegates to them based on context:
- When collecting customer info → `agents/intake.md` rules apply
- When matching services → `agents/service-match.md` rules apply
- When scheduling/booking → `agents/booking.md` rules apply
- When answering questions → `agents/faq.md` rules apply

**Skills** are validation/parsing utilities referenced in the prompt. They define how to extract structured data from free-form customer messages.

## Key Files in Codebase

| File | Purpose |
|------|---------|
| `client/src/components/chat/ChatWidget.tsx` | Chat widget UI |
| `server/routes.ts` | Chat API endpoints + message handler |
| `server/storage.ts` | Database queries for conversations |
| `server/integrations/ghl.ts` | GoHighLevel calendar integration |
| `server/integrations/twilio.ts` | SMS notifications |
| `shared/schema.ts` | Database table definitions |

## Known Issues

See `plan/chat-improvements.md` for the full list of bugs found in 132 real conversations, with root causes and fix locations.
