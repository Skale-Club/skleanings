import { BlogGenerator } from "./blog-generator";

const isServerless = !!process.env.VERCEL;

export async function startCronJobs() {
  if (isServerless) {
    console.log("[CronService] Serverless environment detected. Skipping node-cron scheduling.");
    console.log("[CronService] Blog autopost is handled by GitHub Actions → POST /api/blog/cron/generate");
    return;
  }

  // Only run cron in persistent Node.js environments (local dev, VPS, etc.)
  try {
    const { default: cron } = await import("node-cron");

    // Run every hour to check for blog generation schedule based on postsPerDay setting
    // The actual generation frequency is controlled by BlogSettings.postsPerDay and lastRunAt
    cron.schedule("0 * * * *", async () => {
      try {
        console.log("[CronService] Hourly blog generation check...", new Date().toISOString());
        const result = await BlogGenerator.startDailyPostGeneration({ manual: false });
        if (result.skipped) {
          console.log(`[CronService] Skipped: ${result.reason}`);
        } else if (result.success) {
          console.log(`[CronService] Generated post: ${result.post?.title} (job #${result.job?.id})`);
        } else {
          console.error(`[CronService] Failed: ${result.error}`);
        }
      } catch (error) {
        console.error("[CronService] Error in scheduled blog generation:", error);
      }
    });

    // Daily at 06:00 UTC: generate recurring bookings for due subscriptions
    // Production trigger is GitHub Actions (.github/workflows/recurring-bookings-cron.yml)
    cron.schedule("0 6 * * *", async () => {
      try {
        console.log("[CronService] Daily recurring booking generation...", new Date().toISOString());
        const { runRecurringBookingGeneration } = await import("./recurring-booking-generator");
        const result = await runRecurringBookingGeneration();
        console.log(`[CronService] Recurring generation complete:`, result);
      } catch (error) {
        console.error("[CronService] Error in recurring booking generation:", error);
      }
    });

    console.log(
      "[CronService] Cron jobs scheduled: Blog generation (hourly), Recurring bookings (daily 06:00 UTC)",
      "CronService"
    );
  } catch (error) {
    console.warn("[CronService] node-cron not available. Blog scheduling requires GitHub Actions or persistent Node environment.", error);
  }
}
