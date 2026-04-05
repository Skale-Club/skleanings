import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BlogPost,
  Category,
  ChatSettings,
  CompanySettings,
  Service,
  Subcategory,
  User,
} from "@shared/schema";

let adminClient: SupabaseClient | null = null;

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function camelizeKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeKeys(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        toCamelCase(key),
        camelizeKeys(nestedValue),
      ]),
    ) as T;
  }

  return value;
}

function getAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase admin credentials are not configured");
  }

  adminClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

async function runQuery<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data as T;
}

export async function getFallbackCompanySettings(): Promise<CompanySettings | null> {
  const client = getAdminClient();
  const data = await runQuery(
    client.from("company_settings").select("*").limit(1).maybeSingle(),
  );

  return data ? camelizeKeys<CompanySettings>(data) : null;
}

export async function getFallbackChatSettings(): Promise<ChatSettings | null> {
  const client = getAdminClient();
  const data = await runQuery(
    client.from("chat_settings").select("*").limit(1).maybeSingle(),
  );

  return data ? camelizeKeys<ChatSettings>(data) : null;
}

export async function getFallbackUserById(id: string): Promise<User | null> {
  const client = getAdminClient();
  const data = await runQuery(
    client.from("users").select("*").eq("id", id).limit(1).maybeSingle(),
  );

  return data ? (camelizeKeys(data) as User) : null;
}

export async function getFallbackUserByEmail(email: string): Promise<User | null> {
  const client = getAdminClient();
  const data = await runQuery(
    client.from("users").select("*").eq("email", email).limit(1).maybeSingle(),
  );

  return data ? (camelizeKeys(data) as User) : null;
}

export async function createFallbackUser(user: Partial<User> & { id: string; email: string; role: string }): Promise<User> {
  const client = getAdminClient();
  const payload = {
    id: user.id,
    email: user.email,
    first_name: user.firstName ?? null,
    last_name: user.lastName ?? null,
    phone: user.phone ?? null,
    profile_image_url: user.profileImageUrl ?? null,
    role: user.role,
    is_admin: user.isAdmin ?? (user.role === "admin"),
  };

  const data = await runQuery(
    client.from("users").insert(payload).select("*").single(),
  );

  return camelizeKeys(data as unknown as User) as User;
}

export async function getFallbackCategories(): Promise<Category[]> {
  const client = getAdminClient();
  const data = await runQuery(
    client.from("categories").select("*").order("order", { ascending: true }).order("id", { ascending: true }),
  );

  return camelizeKeys<Category[]>(data ?? []);
}

export async function getFallbackSubcategories(categoryId?: number): Promise<Subcategory[]> {
  const client = getAdminClient();
  let query = client.from("subcategories").select("*").order("id", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const data = await runQuery(query);
  return camelizeKeys<Subcategory[]>(data ?? []);
}

export async function getFallbackServices(options: {
  categoryId?: number;
  subcategoryId?: number;
  includeHidden?: boolean;
  showOnLanding?: boolean;
} = {}): Promise<Service[]> {
  const client = getAdminClient();
  let query = client
    .from("services")
    .select("*")
    .eq("is_archived", false)
    .order("order", { ascending: true })
    .order("id", { ascending: true });

  if (!options.includeHidden) {
    query = query.eq("is_hidden", false);
  }

  if (options.showOnLanding !== undefined) {
    query = query.eq("show_on_landing", options.showOnLanding);
  }

  if (options.subcategoryId) {
    query = query.eq("subcategory_id", options.subcategoryId);
  } else if (options.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  const data = await runQuery(query);
  return camelizeKeys<Service[]>(data ?? []);
}

export async function getFallbackPublishedBlogPosts(limit = 10, offset = 0): Promise<BlogPost[]> {
  const client = getAdminClient();
  const data = await runQuery(
    client
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(offset, Math.max(offset + limit - 1, offset)),
  );

  return camelizeKeys<BlogPost[]>(data ?? []);
}

export async function getFallbackBlogPosts(status?: string, limit = 100, offset = 0): Promise<BlogPost[]> {
  const client = getAdminClient();
  let query = client
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, Math.max(offset + limit - 1, offset));

  if (status) {
    query = query.eq("status", status);
  }

  const data = await runQuery(query);
  return camelizeKeys<BlogPost[]>(data ?? []);
}

export async function getFallbackBlogPost(idOrSlug: number | string): Promise<BlogPost | null> {
  const client = getAdminClient();
  const column = typeof idOrSlug === "number" ? "id" : "slug";
  const data = await runQuery(
    client.from("blog_posts").select("*").eq(column, idOrSlug).limit(1).maybeSingle(),
  );

  return data ? camelizeKeys<BlogPost>(data) : null;
}

export async function getFallbackRelatedBlogPosts(postId: number, limit = 4): Promise<BlogPost[]> {
  const client = getAdminClient();
  const data = await runQuery(
    client
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .neq("id", postId)
      .order("published_at", { ascending: false })
      .limit(limit),
  );

  return camelizeKeys<BlogPost[]>(data ?? []);
}

export async function getFallbackBlogPostServices(postId: number): Promise<Service[]> {
  const client = getAdminClient();
  const relations = await runQuery(
    client.from("blog_post_services").select("service_id").eq("blog_post_id", postId),
  ) as Array<{ service_id: number }>;

  const serviceIds = relations.map((relation) => relation.service_id).filter((value) => typeof value === "number");

  if (!serviceIds.length) {
    return [];
  }

  const data = await runQuery(
    client
      .from("services")
      .select("*")
      .in("id", serviceIds)
      .eq("is_archived", false)
      .order("order", { ascending: true })
      .order("id", { ascending: true }),
  );

  return camelizeKeys<Service[]>(data ?? []);
}
