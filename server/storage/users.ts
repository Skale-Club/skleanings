import { db } from "../db";
import {
  users, staffMembers,
  type User, type UpsertUser, type UserRole,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getUsers(): Promise<User[]> {
  return await db.select().from(users);
}

export async function getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User> {
  const [updated] = await db.update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function createUser(user: UpsertUser): Promise<User> {
  const [newUser] = await db.insert(users).values(user).returning();
  return newUser;
}

export async function updateUser(id: string, user: Partial<UpsertUser>): Promise<User> {
  const [updated] = await db.update(users)
    .set({ ...user, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated;
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

export async function linkStaffToUser(staffMemberId: number, userId: string): Promise<void> {
  await db.update(staffMembers)
    .set({ userId, updatedAt: new Date() })
    .where(eq(staffMembers.id, staffMemberId));
}
