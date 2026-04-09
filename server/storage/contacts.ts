import { db } from "../db";
import {
  contacts, bookings,
  type Contact, type Booking,
} from "@shared/schema";
import { eq, or, asc, desc, ilike, sql } from "drizzle-orm";

export async function upsertContact(data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  ghlContactId?: string;
}): Promise<Contact> {
  if (data.email) {
    const existing = await db.select().from(contacts).where(eq(contacts.email, data.email)).limit(1);
    if (existing[0]) return existing[0];
  }
  if (data.phone) {
    const existing = await db.select().from(contacts).where(eq(contacts.phone, data.phone)).limit(1);
    if (existing[0]) return existing[0];
  }
  const [created] = await db.insert(contacts).values({
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    ghlContactId: data.ghlContactId ?? null,
  }).returning();
  return created;
}

export async function getContact(id: number): Promise<Contact | undefined> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return contact;
}

export async function getContactByEmailOrPhone(email?: string, phone?: string): Promise<Contact | undefined> {
  if (email) {
    const [found] = await db.select().from(contacts).where(eq(contacts.email, email)).limit(1);
    if (found) return found;
  }
  if (phone) {
    const [found] = await db.select().from(contacts).where(eq(contacts.phone, phone)).limit(1);
    if (found) return found;
  }
  return undefined;
}

export async function listContacts(search?: string, limit: number = 100): Promise<Contact[]> {
  if (search) {
    return await db.select().from(contacts).where(
      or(ilike(contacts.name, `%${search}%`), ilike(contacts.email, `%${search}%`), ilike(contacts.phone, `%${search}%`))
    ).orderBy(asc(contacts.name)).limit(limit);
  }
  return await db.select().from(contacts).orderBy(asc(contacts.name)).limit(limit);
}

export async function getContactBookings(contactId: number): Promise<Booking[]> {
  return await db.select().from(bookings)
    .where(eq(bookings.contactId, contactId))
    .orderBy(desc(bookings.bookingDate));
}

export async function updateContact(
  id: number,
  data: Partial<Pick<Contact, 'name' | 'email' | 'phone' | 'address' | 'notes'>>,
): Promise<Contact> {
  const [updated] = await db.update(contacts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  return updated;
}

export async function listContactsWithStats(
  search?: string,
  limit: number = 100,
): Promise<(Contact & { bookingCount: number; totalSpend: number; lastBookingDate: string | null })[]> {
  const searchClause = search
    ? sql`AND (c.name ILIKE ${`%${search}%`} OR c.email ILIKE ${`%${search}%`} OR c.phone ILIKE ${`%${search}%`})`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      c.*,
      COALESCE(b.booking_count, 0)::int AS "bookingCount",
      COALESCE(b.total_spend, 0)::numeric AS "totalSpend",
      b.last_booking_date AS "lastBookingDate"
    FROM contacts c
    LEFT JOIN (
      SELECT
        contact_id,
        COUNT(*)::int AS booking_count,
        SUM(total_price::numeric) AS total_spend,
        MAX(booking_date) AS last_booking_date
      FROM bookings
      WHERE contact_id IS NOT NULL
      GROUP BY contact_id
    ) b ON b.contact_id = c.id
    WHERE TRUE ${searchClause}
    ORDER BY c.name ASC
    LIMIT ${limit}
  `);

  return rows as unknown as (Contact & { bookingCount: number; totalSpend: number; lastBookingDate: string | null })[];
}
