import { Router } from "express";
import aiRouter from "./integrations/ai";
import ghlRouter from "./integrations/ghl";
import twilioRouter from "./integrations/twilio";
import telegramRouter from "./integrations/telegram";
import thumbtackRouter from "./integrations/thumbtack";
import googleCalendarRouter from "./integrations/google-calendar";
import stripeRouter from "./integrations/stripe";
import resendRouter from "./integrations/resend";

const router = Router();

router.use(aiRouter);
router.use(ghlRouter);
router.use(twilioRouter);
router.use(telegramRouter);
router.use(thumbtackRouter);
router.use(googleCalendarRouter);
router.use(stripeRouter);
router.use(resendRouter);

// POST /api/integrations/email/cron/send-reminders
// Production trigger: GitHub Actions booking-email-reminders-cron.yml
// Protected by CRON_SECRET header (Authorization: Bearer <secret>)
router.post('/email/cron/send-reminders', async (req, res) => {
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const { run24hEmailReminders } = await import('../services/booking-email-reminders');
    const result = await run24hEmailReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[EmailCron] Error:', err);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
