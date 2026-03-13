import "dotenv/config";
import { runSeedData } from "../lib/seeds";
import { storage } from "../storage";

async function main() {
  await storage.initializeRuntimeState();
  await runSeedData();
}

main()
  .then(() => {
    console.log("[Seed] Manual seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Seed] Manual seed failed:", error);
    process.exit(1);
  });
