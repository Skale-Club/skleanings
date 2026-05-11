/**
 * Email transport utility — Phase 28 RECUR-03
 *
 * Uses nodemailer with configurable SMTP env vars.
 * Gracefully skips (logs warning, does not throw) when vars are absent.
 * This is the first transactional email capability in this codebase (SEED-019 gap).
 *
 * Required env vars:
 *   EMAIL_HOST    — SMTP server hostname
 *   EMAIL_PORT    — SMTP port (default: 587)
 *   EMAIL_USER    — SMTP username / login email
 *   EMAIL_PASS    — SMTP password / app password
 *   EMAIL_FROM    — "From" display address (defaults to EMAIL_USER)
 */
import nodemailer from "nodemailer";

function createTransporter(): nodemailer.Transporter | null {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.EMAIL_PORT ?? "587") || 587;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Send a transactional email.
 * Non-throwing: if SMTP is not configured, logs a warning and returns silently.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn("[Email] Transport not configured — skipping email to", to);
    return;
  }

  const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;
  const mailOptions: nodemailer.SendMailOptions = { from, to, subject, text };
  if (html !== undefined) {
    mailOptions.html = html;
  }

  await transporter.sendMail(mailOptions);
}
