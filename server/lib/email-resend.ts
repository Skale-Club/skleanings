/**
 * Resend transactional email module — Phase 31
 * Parallel to server/lib/email.ts (nodemailer). Do NOT modify email.ts.
 * Reads API key from emailSettings DB table, falls back to RESEND_API_KEY env var.
 * Non-throwing: logs errors to notificationLogs and returns silently.
 */
import { Resend } from 'resend';
import type { IStorage } from '../storage';

async function getResendClient(storage: IStorage): Promise<{ client: Resend; from: string } | null> {
  const settings = await storage.getEmailSettings();
  const apiKey = settings?.resendApiKey || process.env.RESEND_API_KEY;
  const from = settings?.fromAddress || process.env.RESEND_FROM || '';

  if (!apiKey) {
    console.warn('[Resend] API key not configured — skipping email send');
    return null;
  }
  if (!from) {
    console.warn('[Resend] From address not configured — skipping email send');
    return null;
  }
  return { client: new Resend(apiKey), from };
}

/**
 * Send a transactional email via Resend SDK.
 * Always logs outcome to notificationLogs (sent | failed | skipped).
 * Never throws — safe to use as fire-and-forget void call.
 *
 * @param to        Recipient email address
 * @param subject   Email subject line
 * @param html      HTML body
 * @param text      Plain-text fallback body
 * @param bookingId Optional booking ID for notificationLogs FK
 * @param trigger   Trigger name: 'booking_confirmed' | 'appointment_reminder_24h' | 'booking_cancelled' | 'test_send'
 */
export async function sendResendEmail(
  storage: IStorage,
  to: string,
  subject: string,
  html: string,
  text: string,
  bookingId?: number,
  trigger: string = 'unknown'
): Promise<void> {
  // Check if email is enabled in settings before sending
  const settings = await storage.getEmailSettings();
  if (!settings?.enabled) {
    // Log skipped send so admin can audit
    try {
      await storage.createNotificationLog({
        bookingId: bookingId ?? null,
        channel: 'email',
        trigger,
        recipient: to,
        preview: subject.slice(0, 500),
        status: 'skipped',
        errorMessage: 'Email integration disabled',
        providerMessageId: null,
        conversationId: null,
      });
    } catch (logErr) {
      console.error('[Resend] Failed to write skipped log:', logErr);
    }
    return;
  }

  const ctx = await getResendClient(storage);
  if (!ctx) {
    try {
      await storage.createNotificationLog({
        bookingId: bookingId ?? null,
        channel: 'email',
        trigger,
        recipient: to,
        preview: subject.slice(0, 500),
        status: 'skipped',
        errorMessage: 'Resend not configured (no API key or from address)',
        providerMessageId: null,
        conversationId: null,
      });
    } catch (logErr) {
      console.error('[Resend] Failed to write skipped log:', logErr);
    }
    return;
  }

  const { data, error } = await ctx.client.emails.send({
    from: ctx.from,
    to,
    subject,
    html,
    text,
  });

  try {
    await storage.createNotificationLog({
      bookingId: bookingId ?? null,
      channel: 'email',
      trigger,
      recipient: to,
      preview: subject.slice(0, 500),
      status: error ? 'failed' : 'sent',
      errorMessage: error ? JSON.stringify(error) : null,
      providerMessageId: data?.id ?? null,
      conversationId: null,
    });
  } catch (logErr) {
    console.error('[Resend] Failed to write notification log:', logErr);
  }

  if (error) {
    console.error('[Resend] Send error:', JSON.stringify(error));
  }
}
