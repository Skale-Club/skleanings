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

// ============================================================
// Phase 29 RECUR-05: Self-serve subscription management email
// ============================================================

export interface ManageEmailData {
  customerName: string;
  serviceName: string;
  frequencyName: string;
  manageUrl: string;    // full URL: https://yourdomain.com/manage-subscription/<token>
  companyName: string;
}

/**
 * Build the email sent when a recurring subscription is created.
 * Contains a permanent manage link the customer can use to pause or cancel.
 */
export function buildManageEmail(data: ManageEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const { customerName, serviceName, frequencyName, manageUrl, companyName } = data;

  const subject = `Manage your ${frequencyName.toLowerCase()} cleaning subscription — ${serviceName}`;

  const text = `Hi ${customerName},

Your ${frequencyName.toLowerCase()} cleaning subscription for ${serviceName} has been set up.

You can pause or cancel your subscription at any time using the link below:
${manageUrl}

This link is unique to your subscription. Keep it handy in case you need to make changes.

Thank you for choosing ${companyName}!`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Inter, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; }
  .container { max-width: 520px; margin: 32px auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
  h2 { font-family: Outfit, sans-serif; color: #1C53A3; margin: 0 0 16px; }
  .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 15px; }
  .label { font-weight: 600; color: #475569; min-width: 96px; }
  .cta-btn {
    display: inline-block;
    margin-top: 24px;
    padding: 12px 28px;
    background-color: #FFFF01;
    color: #000;
    font-weight: 700;
    font-family: Outfit, sans-serif;
    text-decoration: none;
    border-radius: 999px;
  }
  .footer { margin-top: 28px; font-size: 13px; color: #94a3b8; }
  .link-fallback { margin-top: 16px; font-size: 13px; color: #64748b; word-break: break-all; }
</style></head>
<body>
<div class="container">
  <h2>Your Recurring Cleaning Is Set Up</h2>
  <p>Hi ${customerName},</p>
  <p>Your <strong>${frequencyName.toLowerCase()}</strong> cleaning subscription for <strong>${serviceName}</strong> is now active. We'll automatically schedule your next cleaning based on your preferred time.</p>
  <div class="detail-row"><span class="label">Service</span><span>${serviceName}</span></div>
  <div class="detail-row"><span class="label">Frequency</span><span>${frequencyName}</span></div>
  <p style="margin-top: 24px">Need to pause or cancel? Use the button below — no login required:</p>
  <a class="cta-btn" href="${manageUrl}">Manage My Subscription</a>
  <p class="link-fallback">Or copy this link: ${manageUrl}</p>
  <div class="footer">${companyName}</div>
</div>
</body>
</html>`;

  return { subject, text, html };
}

// ============================================================
// Phase 31: Booking lifecycle transactional email templates
// Brand constants: BLUE #1C53A3, YELLOW #FFFF01 (from CLAUDE.md)
// ============================================================

/** Convert minutes integer to human-readable string. e.g. 90 -> "1 hour 30 minutes", 120 -> "2 hours" */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} minute${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
  return `${h} hour${h !== 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''}`;
}

export interface BookingConfirmationEmailData {
  customerName: string;
  bookingDate: string;       // YYYY-MM-DD
  startTime: string;         // HH:MM (24h)
  serviceName: string;
  serviceAddress: string;
  durationLabel: string | null;   // Phase 30 snapshot -- null = fallback to durationMinutes
  durationMinutes: number;
  companyName: string;
  logoUrl: string;           // companySettings.logoMain
}

export function buildBookingConfirmationEmail(data: BookingConfirmationEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const { customerName, bookingDate, startTime, serviceName, serviceAddress,
          durationLabel, durationMinutes, companyName, logoUrl } = data;
  const formattedDate = formatDate(bookingDate);
  const formattedTime = formatTime12h(startTime);
  const durationDisplay = durationLabel ?? formatDuration(durationMinutes);

  const subject = `Your booking is confirmed -- ${serviceName} on ${formattedDate}`;

  const text = `Hi ${customerName},

Your cleaning appointment is confirmed!

  Service:  ${serviceName}
  Date:     ${formattedDate}
  Time:     ${formattedTime}
  Duration: ${durationDisplay}
  Address:  ${serviceAddress}

We look forward to seeing you!
${companyName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Inter, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
  .container { max-width: 520px; margin: 32px auto; background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .logo { text-align: center; margin-bottom: 24px; }
  .logo img { max-height: 48px; max-width: 200px; object-fit: contain; }
  h2 { font-family: Outfit, sans-serif; color: #1C53A3; margin: 0 0 16px; }
  .badge { display: inline-block; background: #dcfce7; color: #15803d; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }
  .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 15px; }
  .label { font-weight: 600; color: #475569; min-width: 80px; }
  .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center; }
</style></head>
<body>
<div class="container">
  ${logoUrl ? `<div class="logo"><img src="${logoUrl}" alt="${companyName}" /></div>` : ''}
  <span class="badge">Booking Confirmed</span>
  <h2>Your appointment is booked!</h2>
  <p>Hi ${customerName},</p>
  <p>Great news -- your cleaning appointment is confirmed. Here are your booking details:</p>
  <div class="detail-row"><span class="label">Service</span><span>${serviceName}</span></div>
  <div class="detail-row"><span class="label">Date</span><span>${formattedDate}</span></div>
  <div class="detail-row"><span class="label">Time</span><span>${formattedTime}</span></div>
  <div class="detail-row"><span class="label">Duration</span><span>${durationDisplay}</span></div>
  <div class="detail-row"><span class="label">Address</span><span>${serviceAddress}</span></div>
  <p style="margin-top:24px">If you need to make any changes, please contact us as soon as possible.</p>
  <p>We look forward to seeing you!</p>
  <div class="footer">${companyName}</div>
</div>
</body>
</html>`;

  return { subject, text, html };
}

export interface Reminder24hEmailData {
  customerName: string;
  bookingDate: string;
  startTime: string;
  serviceName: string;
  serviceAddress: string;
  durationLabel: string | null;
  durationMinutes: number;
  companyName: string;
  logoUrl: string;
}

export function build24hReminderEmail(data: Reminder24hEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const { customerName, bookingDate, startTime, serviceName, serviceAddress,
          durationLabel, durationMinutes, companyName, logoUrl } = data;
  const formattedDate = formatDate(bookingDate);
  const formattedTime = formatTime12h(startTime);
  const durationDisplay = durationLabel ?? formatDuration(durationMinutes);

  const subject = `Reminder: Your cleaning appointment is tomorrow -- ${serviceName}`;

  const text = `Hi ${customerName},

Just a reminder that your cleaning appointment is tomorrow!

  Service:  ${serviceName}
  Date:     ${formattedDate}
  Time:     ${formattedTime}
  Duration: ${durationDisplay}
  Address:  ${serviceAddress}

If you need to reschedule or have any questions, please contact us right away.

See you tomorrow!
${companyName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Inter, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
  .container { max-width: 520px; margin: 32px auto; background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .logo { text-align: center; margin-bottom: 24px; }
  .logo img { max-height: 48px; max-width: 200px; object-fit: contain; }
  h2 { font-family: Outfit, sans-serif; color: #1C53A3; margin: 0 0 16px; }
  .badge { display: inline-block; background: #fefce8; color: #854d0e; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }
  .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 15px; }
  .label { font-weight: 600; color: #475569; min-width: 80px; }
  .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center; }
</style></head>
<body>
<div class="container">
  ${logoUrl ? `<div class="logo"><img src="${logoUrl}" alt="${companyName}" /></div>` : ''}
  <span class="badge">Appointment Tomorrow</span>
  <h2>Your Cleaning Reminder</h2>
  <p>Hi ${customerName},</p>
  <p>Just a friendly reminder -- your cleaning appointment is <strong>tomorrow</strong>:</p>
  <div class="detail-row"><span class="label">Service</span><span>${serviceName}</span></div>
  <div class="detail-row"><span class="label">Date</span><span>${formattedDate}</span></div>
  <div class="detail-row"><span class="label">Time</span><span>${formattedTime}</span></div>
  <div class="detail-row"><span class="label">Duration</span><span>${durationDisplay}</span></div>
  <div class="detail-row"><span class="label">Address</span><span>${serviceAddress}</span></div>
  <p style="margin-top:24px">Need to reschedule? Please contact us as soon as possible so we can accommodate you.</p>
  <p>See you tomorrow!</p>
  <div class="footer">${companyName}</div>
</div>
</body>
</html>`;

  return { subject, text, html };
}

export interface BookingCancellationEmailData {
  customerName: string;
  bookingDate: string;
  startTime: string;
  serviceName: string;
  companyName: string;
  logoUrl: string;
}

export function buildCancellationEmail(data: BookingCancellationEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const { customerName, bookingDate, startTime, serviceName, companyName, logoUrl } = data;
  const formattedDate = formatDate(bookingDate);
  const formattedTime = formatTime12h(startTime);

  const subject = `Your booking has been cancelled -- ${serviceName} on ${formattedDate}`;

  const text = `Hi ${customerName},

Your cleaning appointment has been cancelled.

  Service: ${serviceName}
  Date:    ${formattedDate}
  Time:    ${formattedTime}

If you believe this is an error or would like to rebook, please contact us.

${companyName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Inter, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
  .container { max-width: 520px; margin: 32px auto; background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .logo { text-align: center; margin-bottom: 24px; }
  .logo img { max-height: 48px; max-width: 200px; object-fit: contain; }
  h2 { font-family: Outfit, sans-serif; color: #1C53A3; margin: 0 0 16px; }
  .badge { display: inline-block; background: #fee2e2; color: #b91c1c; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }
  .detail-row { display: flex; gap: 8px; margin: 8px 0; font-size: 15px; }
  .label { font-weight: 600; color: #475569; min-width: 80px; }
  .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center; }
</style></head>
<body>
<div class="container">
  ${logoUrl ? `<div class="logo"><img src="${logoUrl}" alt="${companyName}" /></div>` : ''}
  <span class="badge">Booking Cancelled</span>
  <h2>Your Appointment Has Been Cancelled</h2>
  <p>Hi ${customerName},</p>
  <p>We're writing to let you know that your cleaning appointment has been cancelled:</p>
  <div class="detail-row"><span class="label">Service</span><span>${serviceName}</span></div>
  <div class="detail-row"><span class="label">Date</span><span>${formattedDate}</span></div>
  <div class="detail-row"><span class="label">Time</span><span>${formattedTime}</span></div>
  <p style="margin-top:24px">If you believe this is an error or would like to book another appointment, please don't hesitate to contact us.</p>
  <div class="footer">${companyName}</div>
</div>
</body>
</html>`;

  return { subject, text, html };
}
