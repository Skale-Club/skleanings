import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carregar .env
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Check your .env file!");
}

console.log('[Drizzle] Database:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
