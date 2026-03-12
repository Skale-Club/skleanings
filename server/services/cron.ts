
import cron from "node-cron";
import { BlogGenerator } from "./blog-generator";
import { log } from "../lib/logger";

export function startCronJobs() {
    log("Initializing cron jobs...", "CronService");

    // Run every hour to check for blog generation schedule based on postsPerDay setting
    // The actual generation frequency is controlled by BlogSettings.postsPerDay and lastRunAt
    cron.schedule("0 * * * *", async () => {
        log("Running hourly blog generation check...", "CronService");
        try {
            await BlogGenerator.startDailyPostGeneration();
        } catch (error) {
            console.error("Scheduled blog generation failed:", error);
        }
    });

    log("Cron jobs scheduled: Blog generation check (hourly, frequency controlled by postsPerDay setting)", "CronService");
}
