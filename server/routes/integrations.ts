import { Router } from "express";
import aiRouter from "./integrations/ai";
import ghlRouter from "./integrations/ghl";
import twilioRouter from "./integrations/twilio";
import telegramRouter from "./integrations/telegram";
import thumbtackRouter from "./integrations/thumbtack";
import googleCalendarRouter from "./integrations/google-calendar";
import stripeRouter from "./integrations/stripe";

const router = Router();

router.use(aiRouter);
router.use(ghlRouter);
router.use(twilioRouter);
router.use(telegramRouter);
router.use(thumbtackRouter);
router.use(googleCalendarRouter);
router.use(stripeRouter);

export default router;
