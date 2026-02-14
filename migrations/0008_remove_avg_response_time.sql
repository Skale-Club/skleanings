-- Remove avg_response_time column from chatSettings table
ALTER TABLE "chatSettings" DROP COLUMN IF EXISTS "avg_response_time";
