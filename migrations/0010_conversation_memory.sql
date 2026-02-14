-- Add memory field to conversations for structured state tracking
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "memory" jsonb DEFAULT '{}';

-- Add visitor_address field to store collected address
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "visitor_address" text;

-- Add visitor_zipcode field to store collected zipcode  
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "visitor_zipcode" text;
