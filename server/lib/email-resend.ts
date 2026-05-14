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

/**
 * Build the password reset email content.
 * Pure function — no side effects, no DB calls.
 * Caller passes resetUrl and companyName, then calls sendResendEmail() with the result.
 *
 * @param resetUrl    Full URL: ${SITE_URL}/reset-password?token=${rawToken}
 * @param companyName Tenant company name from companySettings
 */
export function buildPasswordResetEmail(
  resetUrl: string,
  companyName: string
): { subject: string; html: string; text: string } {
  const subject = `Reset your ${companyName} admin password`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Inter, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="font-family: Outfit, sans-serif; color: #1C53A3; margin-top: 0;">Password Reset Request</h2>
    <p style="color: #374151;">You requested a password reset for your <strong>${companyName}</strong> admin account.</p>
    <p style="color: #374151;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}"
         style="background: #FFFF01; color: #000; font-weight: 700; font-family: Outfit, sans-serif;
                padding: 14px 32px; border-radius: 9999px; text-decoration: none; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">
      If you did not request this, you can safely ignore this email. Your password will not change.
    </p>
    <p style="color: #6b7280; font-size: 13px;">
      Or copy this link into your browser:<br />
      <a href="${resetUrl}" style="color: #1C53A3; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>
</body>
</html>`;

  const text = `Reset your ${companyName} admin password\n\nVisit this link to reset your password (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`;

  return { subject, html, text };
}
