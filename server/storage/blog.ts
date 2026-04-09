import { db } from "../db";
import {
  blogPosts, blogSettings, blogGenerationJobs, blogPostServices, services,
  type BlogPost, type BlogSettings, type BlogGenerationJob, type Service,
  type InsertBlogPost, type InsertBlogSettings, type InsertBlogGenerationJob,
} from "@shared/schema";
import { eq, and, ne, desc, lte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

// ─── Blog Settings ────────────────────────────────────────────────────────────

export async function getBlogSettings(): Promise<BlogSettings | undefined> {
  const [settings] = await db.select().from(blogSettings);
  return settings;
}

export async function upsertBlogSettings(settings: InsertBlogSettings): Promise<BlogSettings> {
  const existing = await getBlogSettings();
  if (existing) {
    const [updated] = await db.update(blogSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(blogSettings.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(blogSettings).values(settings).returning();
  return created;
}

// ─── Blog Generation Jobs ─────────────────────────────────────────────────────

export async function getBlogGenerationJobs(
  status?: string,
  limit: number = 50,
  offset: number = 0,
): Promise<BlogGenerationJob[]> {
  let query = db.select().from(blogGenerationJobs).orderBy(desc(blogGenerationJobs.createdAt));
  if (status) query = query.where(eq(blogGenerationJobs.status, status)) as any;
  return await query.limit(limit).offset(offset);
}

export async function getBlogGenerationJob(id: number): Promise<BlogGenerationJob | undefined> {
  const [job] = await db.select().from(blogGenerationJobs).where(eq(blogGenerationJobs.id, id));
  return job;
}

export async function createBlogGenerationJob(job: InsertBlogGenerationJob): Promise<BlogGenerationJob> {
  const [created] = await db.insert(blogGenerationJobs).values(job).returning();
  return created;
}

export async function updateBlogGenerationJob(
  id: number,
  updates: Partial<InsertBlogGenerationJob>,
): Promise<BlogGenerationJob> {
  const [updated] = await db.update(blogGenerationJobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(blogGenerationJobs.id, id))
    .returning();
  if (!updated) throw new Error('Blog generation job not found');
  return updated;
}

export async function acquireBlogGenerationLock(
  jobId: number,
  lockedBy: string,
  ttlMs: number = 300000,
): Promise<boolean> {
  const now = new Date();

  await db.update(blogGenerationJobs)
    .set({ lockedAt: null, lockedBy: null })
    .where(and(
      eq(blogGenerationJobs.lockedBy, lockedBy),
      lte(blogGenerationJobs.lockedAt, new Date(Date.now() - ttlMs))
    ));

  const [existing] = await db.select().from(blogGenerationJobs)
    .where(eq(blogGenerationJobs.id, jobId)).limit(1);
  if (!existing) return false;
  if (existing.lockedAt && new Date(existing.lockedAt).getTime() > Date.now() - ttlMs) return false;

  const [updated] = await db.update(blogGenerationJobs)
    .set({ lockedAt: now, lockedBy, status: 'running', startedAt: now })
    .where(eq(blogGenerationJobs.id, jobId))
    .returning();
  return !!updated;
}

export async function releaseBlogGenerationLock(jobId: number, lockedBy: string): Promise<void> {
  await db.update(blogGenerationJobs)
    .set({ lockedAt: null, lockedBy: null })
    .where(and(eq(blogGenerationJobs.id, jobId), eq(blogGenerationJobs.lockedBy, lockedBy)));
}

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export async function getBlogPosts(status?: string, limit?: number, offset: number = 0): Promise<BlogPost[]> {
  let query = db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  if (status) query = query.where(eq(blogPosts.status, status)) as any;
  if (limit) return await query.limit(limit).offset(offset);
  return await query;
}

export async function getBlogPost(id: number): Promise<BlogPost | undefined> {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return post;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
  return post;
}

export async function getPublishedBlogPosts(limit: number = 10, offset: number = 0): Promise<BlogPost[]> {
  return await db.select().from(blogPosts)
    .where(eq(blogPosts.status, 'published'))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit)
    .offset(offset);
}

export async function getRelatedBlogPosts(postId: number, limit: number = 4): Promise<BlogPost[]> {
  return await db.select().from(blogPosts)
    .where(and(eq(blogPosts.status, 'published'), ne(blogPosts.id, postId)))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit);
}

export async function createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
  const { serviceIds, ...postData } = post;
  const [newPost] = await db.insert(blogPosts).values(postData).returning();
  if (serviceIds && serviceIds.length > 0) {
    await setBlogPostServices(newPost.id, serviceIds);
  }
  return newPost;
}

export async function updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
  const { serviceIds, ...postData } = post;
  const [updated] = await db.update(blogPosts)
    .set({ ...postData, updatedAt: new Date() })
    .where(eq(blogPosts.id, id))
    .returning();
  if (serviceIds !== undefined) {
    await setBlogPostServices(id, serviceIds);
  }
  return updated;
}

export async function deleteBlogPost(id: number): Promise<void> {
  await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, id));
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}

export async function getBlogPostServices(postId: number): Promise<Service[]> {
  const relations = await db.select().from(blogPostServices).where(eq(blogPostServices.blogPostId, postId));
  if (relations.length === 0) return [];
  const serviceIds = relations.map(r => r.serviceId);
  return await db.select().from(services).where(inArray(services.id, serviceIds));
}

export async function setBlogPostServices(postId: number, serviceIds: number[]): Promise<void> {
  await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, postId));
  if (serviceIds.length > 0) {
    await db.insert(blogPostServices).values(serviceIds.map(serviceId => ({ blogPostId: postId, serviceId })));
  }
}

export async function countPublishedBlogPosts(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(blogPosts)
    .where(eq(blogPosts.status, 'published'));
  return Number(result[0]?.count || 0);
}
