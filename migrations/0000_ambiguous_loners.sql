CREATE TABLE "blog_post_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"blog_post_id" integer NOT NULL,
	"service_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"meta_description" text,
	"focus_keyword" text,
	"tags" text,
	"feature_image_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_name" text DEFAULT 'Admin',
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"service_name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 1,
	"pricing_type" text DEFAULT 'fixed_item',
	"area_size" text,
	"area_value" numeric(10, 2),
	"selected_options" jsonb,
	"selected_frequency" jsonb,
	"customer_notes" text,
	"price_breakdown" jsonb
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text NOT NULL,
	"customer_address" text NOT NULL,
	"booking_date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"total_duration_minutes" integer NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"ghl_appointment_id" text,
	"ghl_contact_id" text,
	"ghl_sync_status" text DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"order" integer DEFAULT 0,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chat_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"enabled" boolean DEFAULT false,
	"model" text DEFAULT 'gpt-4o-mini',
	"api_key" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false,
	"agent_name" text DEFAULT 'Skleanings Assistant',
	"agent_avatar_url" text DEFAULT '',
	"avg_response_time" text DEFAULT '',
	"language_selector_enabled" boolean DEFAULT false,
	"default_language" text DEFAULT 'en',
	"system_prompt" text DEFAULT 'You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services, details, and availability. Do not guess prices or availability; always use tool data when relevant. If booking is requested, gather details and direct the user to the booking page at /booking.',
	"welcome_message" text DEFAULT 'Hi! How can I help you today?',
	"calendar_provider" text DEFAULT 'gohighlevel',
	"calendar_id" text DEFAULT '',
	"calendar_staff" jsonb DEFAULT '[]'::jsonb,
	"intake_objectives" jsonb DEFAULT '[]'::jsonb,
	"excluded_url_rules" jsonb DEFAULT '[]'::jsonb,
	"use_knowledge_base" boolean DEFAULT true,
	"use_faqs" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text DEFAULT 'Skleanings',
	"industry" text DEFAULT 'cleaning',
	"company_email" text DEFAULT 'contact@skleanings.com',
	"company_phone" text DEFAULT '',
	"company_address" text DEFAULT '',
	"working_hours_start" text DEFAULT '08:00',
	"working_hours_end" text DEFAULT '18:00',
	"logo_main" text DEFAULT '',
	"logo_dark" text DEFAULT '',
	"logo_icon" text DEFAULT '',
	"sections_order" text[],
	"social_links" jsonb DEFAULT '[]'::jsonb,
	"map_embed_url" text DEFAULT 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d259505.12434421625!2d-71.37915684523166!3d42.296281796774615!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1767905922570!5m2!1sen!2sus',
	"hero_title" text DEFAULT 'Your 5-Star Cleaning Company',
	"hero_subtitle" text DEFAULT 'Book your cleaning service today and enjoy a sparkling clean home',
	"hero_image_url" text DEFAULT '',
	"cta_text" text DEFAULT 'Book Now',
	"time_format" text DEFAULT '12h',
	"time_zone" text DEFAULT 'America/New_York',
	"business_hours" jsonb,
	"minimum_booking_value" numeric(10, 2) DEFAULT '0',
	"seo_title" text DEFAULT 'Skleanings - Professional Cleaning Services',
	"seo_description" text DEFAULT 'Professional cleaning services for homes and businesses. Book your cleaning appointment online.',
	"og_image" text DEFAULT '',
	"seo_keywords" text DEFAULT '',
	"seo_author" text DEFAULT '',
	"seo_canonical_url" text DEFAULT '',
	"seo_robots_tag" text DEFAULT 'index, follow',
	"og_type" text DEFAULT 'website',
	"og_site_name" text DEFAULT '',
	"twitter_card" text DEFAULT 'summary_large_image',
	"twitter_site" text DEFAULT '',
	"twitter_creator" text DEFAULT '',
	"schema_local_business" jsonb DEFAULT '{}'::jsonb,
	"gtm_container_id" text DEFAULT '',
	"ga4_measurement_id" text DEFAULT '',
	"facebook_pixel_id" text DEFAULT '',
	"gtm_enabled" boolean DEFAULT false,
	"ga4_enabled" boolean DEFAULT false,
	"facebook_pixel_enabled" boolean DEFAULT false,
	"homepage_content" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_message_at" timestamp,
	"first_page_url" text,
	"visitor_name" text,
	"visitor_phone" text,
	"visitor_email" text,
	"visitor_address" text,
	"visitor_zipcode" text,
	"memory" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'gohighlevel' NOT NULL,
	"api_key" text,
	"location_id" text,
	"calendar_id" text DEFAULT '2irhr47AR6K0AQkFqEQl',
	"is_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"addon_service_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_frequencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"name" text NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "service_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"max_quantity" integer DEFAULT 10,
	"order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"subcategory_id" integer,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"image_url" text,
	"is_hidden" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"order" integer DEFAULT 0,
	"pricing_type" text DEFAULT 'fixed_item',
	"base_price" numeric(10, 2),
	"price_per_unit" numeric(10, 2),
	"minimum_price" numeric(10, 2),
	"area_sizes" jsonb
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "subcategories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "time_slot_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_date" date NOT NULL,
	"start_time" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twilio_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false,
	"account_sid" text,
	"auth_token" text,
	"from_phone_number" text,
	"to_phone_numbers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notify_on_new_chat" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "blog_post_services" ADD CONSTRAINT "blog_post_services_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_services" ADD CONSTRAINT "blog_post_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addons" ADD CONSTRAINT "service_addons_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addons" ADD CONSTRAINT "service_addons_addon_service_id_services_id_fk" FOREIGN KEY ("addon_service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_frequencies" ADD CONSTRAINT "service_frequencies_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_options" ADD CONSTRAINT "service_options_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");