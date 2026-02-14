-- Migration: Hierarchical Service Areas
-- Create new tables for area groups (regions) and cities within those groups

-- Create service_area_groups table (regions like "MetroWest", "Greater Boston")
CREATE TABLE IF NOT EXISTS "service_area_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create service_area_cities table (cities within each group)
CREATE TABLE IF NOT EXISTS "service_area_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_group_id" integer NOT NULL,
	"name" text NOT NULL,
	"zipcode" text,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_area_cities_area_group_id_service_area_groups_id_fk" 
		FOREIGN KEY ("area_group_id") REFERENCES "service_area_groups"("id") ON DELETE CASCADE
);

-- Migrate existing data from service_areas to the new structure
-- Step 1: Extract unique regions and create area groups
INSERT INTO "service_area_groups" ("name", "slug", "description", "order", "is_active")
SELECT DISTINCT 
	region AS name,
	LOWER(REGEXP_REPLACE(region, '[^a-zA-Z0-9]+', '-', 'g')) AS slug,
	NULL AS description,
	0 AS "order",
	true AS is_active
FROM "service_areas"
WHERE region IS NOT NULL AND region != ''
ORDER BY region;

-- Step 2: Migrate cities to service_area_cities with proper foreign keys
INSERT INTO "service_area_cities" ("area_group_id", "name", "zipcode", "order", "is_active")
SELECT 
	sag.id AS area_group_id,
	sa.name,
	sa.zipcode,
	sa."order",
	sa.is_active
FROM "service_areas" sa
INNER JOIN "service_area_groups" sag ON sa.region = sag.name
ORDER BY sa."order";

-- Note: service_areas table is kept for backward compatibility
-- It can be dropped after confirming the migration was successful
-- To drop it later, run: DROP TABLE IF EXISTS "service_areas";
