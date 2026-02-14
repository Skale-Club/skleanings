
import cron from "node-cron";
import { BlogGenerator } from "./blog-generator";
import { log } from "../lib/logger";

export function startCronJobs() {
    log("Initializing cron jobs...", "CronService");

    // Run every hour to check for blog generation schedule
    cron.schedule("0 * * * *", async () => {
        log("Running scheduled daily blog post generation...", "CronService");
        try {
            await BlogGenerator.startDailyPostGeneration();
        } catch (error) {
            console.error("Scheduled blog generation failed:", error);
        }
    });

    log("Cron jobs scheduled: Daily Blog Post (09:00 AM)", "CronService");
}
