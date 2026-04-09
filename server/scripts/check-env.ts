import "dotenv/config";
import * as dotenv from "dotenv";
import { collectRuntimeEnvDiagnostics } from "../lib/runtime-env";

const env = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${env}`, override: true });
dotenv.config({ path: ".env", override: false });

const diagnostics = collectRuntimeEnvDiagnostics(process.env);

for (const warning of diagnostics.warnings) {
  console.warn(`[env:check] WARNING: ${warning}`);
}

if (diagnostics.errors.length > 0) {
  for (const error of diagnostics.errors) {
    console.error(`[env:check] ERROR: ${error}`);
  }
  process.exit(1);
}

console.log("[env:check] Environment looks valid.");
