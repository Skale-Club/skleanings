
import { storage } from "../storage";
import { db } from "../db";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import * as path from "path";

// ✅ CONFIGURABLE SEED DATA: Load from JSON file instead of hardcoded values
// To customize for different tenants, edit server/lib/seed-data.json or set SEED_DATA_PATH env var
const SEED_DATA_PATH = process.env.SEED_DATA_PATH || path.join(__dirname, 'seed-data.json');

interface SeedData {
    categories: Array<{
        name: string;
        slug: string;
        description: string;
        imageUrl?: string;
        services: Array<{
            name: string;
            description: string;
            price: string;
            durationMinutes: number;
            imageUrl?: string;
        }>;
    }>;
    faqs: Array<{
        question: string;
        answer: string;
        order: number;
    }>;
}

function loadSeedData(): SeedData | null {
    try {
        if (!fs.existsSync(SEED_DATA_PATH)) {
            console.warn(`[Seed] No seed data file found at ${SEED_DATA_PATH}. Skipping seed.`);
            return null;
        }

        const rawData = fs.readFileSync(SEED_DATA_PATH, 'utf-8');
        const seedData = JSON.parse(rawData) as SeedData;
        console.log(`[Seed] Loaded seed data from ${SEED_DATA_PATH}`);
        return seedData;
    } catch (error) {
        console.error(`[Seed] Failed to load seed data:`, error);
        return null;
    }
}

export async function seedFaqs() {
    const existingFaqs = await storage.getFaqs(true);
    if (existingFaqs.length > 0) return;

    const seedData = loadSeedData();
    if (!seedData || !seedData.faqs || seedData.faqs.length === 0) {
        console.log('[Seed] No FAQs to seed');
        return;
    }

    for (const faq of seedData.faqs) {
        await storage.createFaq(faq);
    }
    console.log(`[Seed] Created ${seedData.faqs.length} FAQ entries`);
}

export async function seedDatabase() {
    const existingCategories = await storage.getCategories();
    if (existingCategories.length > 0) return;

    const seedData = loadSeedData();
    if (!seedData || !seedData.categories || seedData.categories.length === 0) {
        console.log('[Seed] No categories/services to seed');
        return;
    }

    for (const categoryData of seedData.categories) {
        const category = await storage.createCategory({
            name: categoryData.name,
            slug: categoryData.slug,
            description: categoryData.description,
            imageUrl: categoryData.imageUrl
        });

        console.log(`[Seed] Created category: ${category.name}`);

        if (categoryData.services && categoryData.services.length > 0) {
            for (const serviceData of categoryData.services) {
                await storage.createService({
                    categoryId: category.id,
                    name: serviceData.name,
                    description: serviceData.description,
                    price: serviceData.price,
                    durationMinutes: serviceData.durationMinutes,
                    imageUrl: serviceData.imageUrl
                });
            }
            console.log(`[Seed] Created ${categoryData.services.length} services for ${category.name}`);
        }
    }

    console.log(`[Seed] Seeding complete: ${seedData.categories.length} categories created`);
}
