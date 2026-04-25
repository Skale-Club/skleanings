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

    console.log("Cron jobs scheduled: Blog generation check (hourly, frequency controlled by postsPerDay setting)", "CronService");
  } catch (error) {
    console.warn("[CronService] node-cron not available. Blog scheduling requires GitHub Actions or persistent Node environment.", error);
  }
}
