/**
 * Email templates — Phase 28 RECUR-03
 * Composes transactional email content for recurring booking reminders.
 */

export interface ReminderEmailData {
  customerName: string;
  bookingDate: string;   // YYYY-MM-DD
  startTime: string;     // HH:MM (24h)
  serviceName: string;
  companyName: string;
  frequencyName: string; // e.g. "Weekly", "Biweekly"
}

/**
 * Format a YYYY-MM-DD date string to "Month Day, Year" (e.g. "June 15, 2026").
 * Uses UTC to avoid timezone shifts on date-only strings.
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a HH:MM 24h time string to 12h format (e.g. "9:00 AM").
 */
function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Build a 48-hour reminder email for a recurring cleaning appointment.
 * Returns subject, plain-text body, and HTML body.
 */
export function buildReminderEmail(data: ReminderEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const { customerName, bookingDate, startTime, serviceName, companyName, frequencyName } = data;
  const formattedDate = formatDate(bookingDate);
  const formattedTime = formatTime12h(startTime);

  const subject = `Reminder: Your ${frequencyName.toLowerCase()} cleaning is coming up — ${serviceName}`;

  const text = `Hi ${customerName},

Just a reminder that your ${frequencyName.toLowerCase()} cleaning is scheduled for:

  Date:    ${formattedDate}
  Time:    ${formattedTime}
  Service: ${serviceName}

If you need to reschedule or have any questions, please reply to this email or contact us directly.

See you soon!
${companyName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Inter, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; }
  .container { max-width: 520px; margin: 32px auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
  h2 { font-family: Outfit, sans-serif; color: #1C53A3; margin: 0 0 16px; }
  .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 15px; }
  .label { font-weight: 600; color: #475569; min-width: 72px; }
  .footer { margin-top: 28px; font-size: 13px; color: #94a3b8; }
</style></head>
<body>
<div class="container">
  <h2>Your Cleaning Reminder</h2>
  <p>Hi ${customerName},</p>
  <p>Just a reminder that your <strong>${frequencyName.toLowerCase()}</strong> cleaning is coming up:</p>
  <div class="detail-row"><span class="label">Date</span><span>${formattedDate}</span></div>
  <div class="detail-row"><span class="label">Time</span><span>${formattedTime}</span></div>
  <div class="detail-row"><span class="label">Service</span><span>${serviceName}</span></div>
  <p style="margin-top:24px">If you need to reschedule or have any questions, please reply to this email or contact us directly.</p>
  <p>See you soon!</p>
  <div class="footer">${companyName}</div>
</div>
</body>
</html>`;

  return { subject, text, html };
}
