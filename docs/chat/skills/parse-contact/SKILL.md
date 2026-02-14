---
name: parse-contact
description: Extract and validate customer contact information (name, phone, email, address) from free-form text messages. Use when processing user messages that may contain contact data.
---

# Parse Contact Skill

Extract structured contact data from customer messages. Returns only valid, clean data.

## Name Extraction

### Valid names
- 1-3 words, typically capitalized
- Examples: "John", "Maria Silva", "John Paul Smith"

### Invalid - NEVER save as name
- Sentences with verbs: "I need sofa cleaning", "Do you do commercial cleaning?"
- Greetings: "hi", "hello", "hey", "oi", "ola", "bom dia"
- Service descriptions: "a sofa", "3 seater", "loveseat", "carpet"
- Questions (contains "?")
- Single common words: "yes", "no", "ok", "sure", "thanks"
- Messages longer than 4 words (likely a sentence, not a name)

### Validation regex
```
/^[A-Z][a-zA-Z'-]+(?: [A-Z][a-zA-Z'-]+){0,2}$/
```
Allows: "John", "Maria Silva", "Jean-Pierre Dupont"
Rejects: "I need cleaning", "a sofa", "hello"

## Phone Extraction

### Extract ONLY the number
- Input: "my phone is 617-555-1234" → Output: "617-555-1234"
- Input: "Meu telefone e 617-555-3333" → Output: "617-555-3333"
- Input: "call me at (508) 740-2109 please" → Output: "(508) 740-2109"

### Valid formats
- 10-digit: 6175551234
- Formatted: 617-555-1234, (617) 555-1234, 617.555.1234
- With country code: +1 617-555-1234, 1-617-555-1234
- 7-digit local: 555-1234 (less reliable, ask for area code)

### Extraction regex
```
/(?:\+?1[-.\s]?)?(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/
```

### CRITICAL: Return only the matched phone, not the surrounding text

## Email Extraction

### Regex
```
/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
```

## Address Extraction

### Must contain
- Street number + street name at minimum
- Example: "123 Main St" is valid
- "Boston" alone is NOT an address

### Extract zip code from address
- "123 Main St Boston MA 02101" → address AND zip code "02101"
- Save both address and zip to avoid asking for zip separately

### Partial address handling
- If only street: ask for city and state
- If no zip: extract from context or ask later (not urgently)
