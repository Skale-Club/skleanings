-- Create Telegram settings table
CREATE TABLE IF NOT EXISTS "telegram_settings" (
  "id" SERIAL PRIMARY KEY,
  "enabled" BOOLEAN DEFAULT false,
  "bot_token" TEXT,
  "chat_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notify_on_new_chat" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Seed singleton row if table is empty
INSERT INTO "telegram_settings" ("enabled", "chat_ids", "notify_on_new_chat")
SELECT false, ARRAY[]::TEXT[], true
WHERE NOT EXISTS (SELECT 1 FROM "telegram_settings");
