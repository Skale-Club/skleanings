
import "dotenv/config";
import { db } from "../server/db";
import { chatIntegrations } from "@shared/schema";

async function main() {
    console.log("Checking chat_integrations table...");
    try {
        const integrations = await db.select().from(chatIntegrations);
        console.log("Found integrations:", integrations.length);
        integrations.forEach(i => {
            console.log(`- Provider: ${i.provider}, Enabled: ${i.enabled}, HasKey: ${!!i.apiKey}`);
        });
    } catch (error) {
        console.error("Error checking integrations:", error);
    }
}

main();
