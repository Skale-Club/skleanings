import { db } from "../db";
import {
  staffMembers, staffServiceAbilities, staffAvailability, staffGoogleCalendar, services,
  type StaffMember, type StaffServiceAbility, type StaffAvailability, type StaffGoogleCalendar, type Service,
  type InsertStaffMember, type InsertStaffServiceAbility, type InsertStaffAvailability,
  type InsertStaffGoogleCalendar,
} from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";

// ─── Staff Members ────────────────────────────────────────────────────────────

export async function getStaffMembers(includeInactive = false): Promise<StaffMember[]> {
  if (!includeInactive) {
    return await db.select().from(staffMembers)
      .where(eq(staffMembers.isActive, true))
      .orderBy(asc(staffMembers.order));
  }
  return await db.select().from(staffMembers).orderBy(asc(staffMembers.order));
}

export async function getStaffMember(id: number): Promise<StaffMember | undefined> {
  const [member] = await db.select().from(staffMembers).where(eq(staffMembers.id, id));
  return member;
}

export async function getStaffMemberByUserId(userId: string): Promise<StaffMember | undefined> {
  const [member] = await db.select().from(staffMembers).where(eq(staffMembers.userId, userId));
  return member;
}

export async function linkStaffMemberToUser(staffId: number, userId: string): Promise<void> {
  await db.update(staffMembers).set({ userId }).where(eq(staffMembers.id, staffId));
}

export async function getStaffCount(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` })
    .from(staffMembers)
    .where(eq(staffMembers.isActive, true));
  return row?.count ?? 0;
}

export async function createStaffMember(staff: InsertStaffMember): Promise<StaffMember> {
  const [created] = await db.insert(staffMembers).values(staff).returning();
  return created;
}

export async function updateStaffMember(id: number, staff: Partial<InsertStaffMember>): Promise<StaffMember> {
  const [updated] = await db.update(staffMembers)
    .set({ ...staff, updatedAt: new Date() })
    .where(eq(staffMembers.id, id))
    .returning();
  return updated;
}

export async function deleteStaffMember(id: number): Promise<void> {
  await db.delete(staffMembers).where(eq(staffMembers.id, id));
}

export async function reorderStaffMembers(updates: { id: number; order: number }[]): Promise<void> {
  await Promise.all(
    updates.map(({ id, order }) => db.update(staffMembers).set({ order }).where(eq(staffMembers.id, id)))
  );
}

// ─── Staff Service Abilities ──────────────────────────────────────────────────

export async function getStaffMembersByService(serviceId: number): Promise<StaffMember[]> {
  const rows = await db.select({ staffMembers })
    .from(staffMembers)
    .innerJoin(staffServiceAbilities, eq(staffServiceAbilities.staffMemberId, staffMembers.id))
    .where(and(eq(staffServiceAbilities.serviceId, serviceId), eq(staffMembers.isActive, true)))
    .orderBy(asc(staffMembers.order));
  return rows.map(r => r.staffMembers);
}

export async function getServicesByStaffMember(staffMemberId: number): Promise<Service[]> {
  const rows = await db.select({ services })
    .from(services)
    .innerJoin(staffServiceAbilities, eq(staffServiceAbilities.serviceId, services.id))
    .where(eq(staffServiceAbilities.staffMemberId, staffMemberId));
  return rows.map(r => r.services);
}

export async function getStaffMembersByServiceId(serviceId: number): Promise<StaffMember[]> {
  const rows = await db.select({ staffMembers })
    .from(staffMembers)
    .innerJoin(staffServiceAbilities, eq(staffServiceAbilities.staffMemberId, staffMembers.id))
    .where(and(eq(staffServiceAbilities.serviceId, serviceId), eq(staffMembers.isActive, true)));
  return rows.map(r => r.staffMembers);
}

export async function setStaffServiceAbilities(staffMemberId: number, serviceIds: number[]): Promise<void> {
  await db.delete(staffServiceAbilities).where(eq(staffServiceAbilities.staffMemberId, staffMemberId));
  if (serviceIds.length > 0) {
    await db.insert(staffServiceAbilities).values(serviceIds.map(serviceId => ({ staffMemberId, serviceId })));
  }
}

// ─── Staff Availability ───────────────────────────────────────────────────────

export async function getStaffAvailability(staffMemberId: number): Promise<StaffAvailability[]> {
  return await db.select().from(staffAvailability)
    .where(eq(staffAvailability.staffMemberId, staffMemberId))
    .orderBy(asc(staffAvailability.dayOfWeek));
}

export async function setStaffAvailability(
  staffMemberId: number,
  availability: Omit<InsertStaffAvailability, 'staffMemberId'>[],
): Promise<StaffAvailability[]> {
  await db.delete(staffAvailability).where(eq(staffAvailability.staffMemberId, staffMemberId));
  if (availability.length === 0) return [];
  return await db.insert(staffAvailability)
    .values(availability.map(a => ({ ...a, staffMemberId })))
    .returning();
}

// ─── Staff Google Calendar ────────────────────────────────────────────────────

export async function getStaffGoogleCalendar(staffMemberId: number): Promise<StaffGoogleCalendar | undefined> {
  const [row] = await db.select().from(staffGoogleCalendar)
    .where(eq(staffGoogleCalendar.staffMemberId, staffMemberId));
  return row;
}

export async function upsertStaffGoogleCalendar(calendar: InsertStaffGoogleCalendar): Promise<StaffGoogleCalendar> {
  const [row] = await db.insert(staffGoogleCalendar)
    .values(calendar)
    .onConflictDoUpdate({
      target: staffGoogleCalendar.staffMemberId,
      set: {
        accessToken: calendar.accessToken,
        refreshToken: calendar.refreshToken,
        calendarId: calendar.calendarId,
        tokenExpiresAt: calendar.tokenExpiresAt,
      },
    })
    .returning();
  return row;
}

export async function deleteStaffGoogleCalendar(staffMemberId: number): Promise<void> {
  await db.delete(staffGoogleCalendar).where(eq(staffGoogleCalendar.staffMemberId, staffMemberId));
}

export async function markCalendarNeedsReconnect(staffMemberId: number): Promise<void> {
  await db.update(staffGoogleCalendar)
    .set({ needsReconnect: true, lastDisconnectedAt: new Date() })
    .where(and(
      eq(staffGoogleCalendar.staffMemberId, staffMemberId),
      eq(staffGoogleCalendar.needsReconnect, false)
    ));
}

export async function clearCalendarNeedsReconnect(staffMemberId: number): Promise<void> {
  await db.update(staffGoogleCalendar)
    .set({ needsReconnect: false })
    .where(eq(staffGoogleCalendar.staffMemberId, staffMemberId));
}

export async function getAllCalendarStatuses(): Promise<Array<{
  staffMemberId: number;
  firstName: string;
  lastName: string;
  connected: boolean;
  needsReconnect: boolean;
  lastDisconnectedAt: Date | null;
}>> {
  const rows = await db.select({
    staffMemberId: staffMembers.id,
    firstName: staffMembers.firstName,
    lastName: staffMembers.lastName,
    calendarId: staffGoogleCalendar.id,
    needsReconnect: staffGoogleCalendar.needsReconnect,
    lastDisconnectedAt: staffGoogleCalendar.lastDisconnectedAt,
  })
    .from(staffMembers)
    .leftJoin(staffGoogleCalendar, eq(staffGoogleCalendar.staffMemberId, staffMembers.id))
    .where(eq(staffMembers.isActive, true));

  return rows.map((row) => ({
    staffMemberId: row.staffMemberId,
    firstName: row.firstName,
    lastName: row.lastName,
    connected: row.calendarId !== null && row.needsReconnect !== true,
    needsReconnect: row.needsReconnect ?? false,
    lastDisconnectedAt: row.lastDisconnectedAt ?? null,
  }));
}
