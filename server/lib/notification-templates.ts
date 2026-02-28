export type BookingNotificationPayload = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  customerAddress?: string;
  bookingDate?: string;
  startTime?: string;
  totalPrice?: string | number;
};

type NotificationSection = {
  heading: string;
  lines: string[];
};

type NotificationMessage = {
  companyName: string;
  title: string;
  titleEmoji: string;
  sections: NotificationSection[];
};

function normalizeCompanyName(companyName?: string): string {
  return (companyName || "the business").trim() || "the business";
}

function formatBookingDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDate);
}

function formatBookingTime(time?: string): string {
  if (!time) return "N/A";
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;

  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${minute} ${period}`;
}

function formatMoney(totalPrice?: string | number): string {
  if (totalPrice === undefined || totalPrice === null) return "N/A";
  const value = typeof totalPrice === "number" ? totalPrice : Number(totalPrice);
  if (Number.isNaN(value)) return String(totalPrice);
  return value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildNewChatNotification(
  conversationId: string,
  pageUrl?: string,
  companyName?: string
): NotificationMessage {
  return {
    companyName: normalizeCompanyName(companyName),
    title: "New chat started",
    titleEmoji: "🔔",
    sections: [
      {
        heading: "Conversation",
        lines: [`${conversationId.slice(0, 8)}...`],
      },
      {
        heading: "Page",
        lines: [pageUrl || "Unknown"],
      },
    ],
  };
}

export function buildBookingNotification(
  booking: BookingNotificationPayload,
  serviceNames: string[],
  companyName?: string
): NotificationMessage {
  const normalizedServices = serviceNames.length > 0 ? serviceNames : ["N/A"];

  return {
    companyName: normalizeCompanyName(companyName),
    title: "New booking confirmed",
    titleEmoji: "📥",
    sections: [
      {
        heading: "Customer",
        lines: [
          booking.customerName || "N/A",
          `Phone: ${booking.customerPhone || "N/A"}`,
          `Email: ${booking.customerEmail || "N/A"}`,
        ],
      },
      {
        heading: "Schedule",
        lines: [
          `Date: ${formatBookingDate(booking.bookingDate)}`,
          `Time: ${formatBookingTime(booking.startTime)}`,
        ],
      },
      {
        heading: "Address",
        lines: [booking.customerAddress || "N/A"],
      },
      {
        heading: "Total",
        lines: [`$${formatMoney(booking.totalPrice)}`],
      },
      {
        heading: serviceNames.length > 1 ? "Services" : "Service",
        lines: normalizedServices.map((service) => `- ${service}`),
      },
    ],
  };
}

export function renderNotificationPlain(message: NotificationMessage): string {
  const parts: string[] = [`${message.companyName}`, "", `${message.titleEmoji} ${message.title}`];

  for (const section of message.sections) {
    parts.push("", section.heading);
    parts.push(...section.lines);
  }

  return parts.join("\n");
}

export function renderNotificationHtml(message: NotificationMessage): string {
  const parts: string[] = [
    `<b>${escapeHtml(message.companyName)}</b>`,
    "",
    `${message.titleEmoji} <b>${escapeHtml(message.title)}</b>`,
  ];

  for (const section of message.sections) {
    parts.push("", `<b>${escapeHtml(section.heading)}</b>`);
    for (const line of section.lines) {
      parts.push(escapeHtml(line));
    }
  }

  return parts.join("\n");
}
