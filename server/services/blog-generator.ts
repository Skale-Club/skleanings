
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { storage } from "../storage";
import { insertBlogPostSchema } from "@shared/schema";
import type { BlogPost, BlogGenerationJob } from "@shared/schema";
import { log } from "../lib/logger";
import { storageService } from "./storage";

interface GenerationResult {
    success: boolean;
    post?: BlogPost;
    job?: BlogGenerationJob;
    skipped?: boolean;
    reason?: string;
    error?: string;
}

export class BlogGenerator {

    private static async getGeminiApiKey(): Promise<string> {
        let apiKey = process.env.BLOG_GEMINI_API_KEY;

        if (!apiKey) {
            apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        }

        if (!apiKey) {
            try {
                const integration = await storage.getChatIntegration("gemini");
                if (integration?.apiKey) {
                    apiKey = integration.apiKey;
                    log("Using Gemini API key from chat integrations (consider migrating to BLOG_GEMINI_API_KEY env var)", "BlogGenerator");
                }
            } catch (e) {
                log(`Error fetching Gemini key from DB: ${e}`, "BlogGenerator");
            }
        }

        if (!apiKey) {
            throw new Error("Gemini API key not found. Set BLOG_GEMINI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY environment variable, or configure Gemini in chat integrations.");
        }

        return apiKey;
    }

    private static async getModel() {
        const apiKey = await this.getGeminiApiKey();
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    static async startDailyPostGeneration(options: { manual?: boolean; autoPublish?: boolean } = {}): Promise<GenerationResult> {
        const isManual = options.manual ?? false;
        const lockIdentity = isManual ? "manual" : "cron";
        const LOCK_TTL_MS = 300000;

        log(`Starting blog post generation (Manual: ${isManual})`, "BlogGenerator");

        const settings = await storage.getBlogSettings();

        if (!settings) {
            log("Blog settings not found. Skipping.", "BlogGenerator");
            return { success: false, skipped: true, reason: "no_settings" };
        }

        if (!isManual) {
            if (!settings.enabled) {
                log("Blog generation disabled in settings. Skipping.", "BlogGenerator");
                return { success: false, skipped: true, reason: "disabled" };
            }

            if (settings.postsPerDay <= 0) {
                log("Automatic scheduling disabled (postsPerDay <= 0). Skipping.", "BlogGenerator");
                return { success: false, skipped: true, reason: "disabled" };
            }

            if (settings.lastRunAt) {
                const now = new Date();
                const lastRun = new Date(settings.lastRunAt);
                const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
                const hoursBetweenPosts = 24 / settings.postsPerDay;

                if (hoursSinceLastRun < hoursBetweenPosts) {
                    log(`Skipping generation. Last run was ${hoursSinceLastRun.toFixed(2)} hours ago. Schedule is every ${hoursBetweenPosts.toFixed(2)} hours.`, "BlogGenerator");
                    return { success: false, skipped: true, reason: "too_soon" };
                }
            }
        }

        const seoKeywords = settings.seoKeywords || "";
        const enableTrendAnalysis = settings.enableTrendAnalysis ?? true;
        const promptStyle = settings.promptStyle || "";

        const job = await storage.createBlogGenerationJob({
            postId: 0,
            status: "pending",
            scheduledAt: new Date(),
            config: { manual: isManual, autoPublish: options.autoPublish ?? false },
        });

        const lockAcquired = await storage.acquireBlogGenerationLock(job.id, lockIdentity, LOCK_TTL_MS);

        if (!lockAcquired) {
            log(`Could not acquire lock for job ${job.id}. Another instance may be running.`, "BlogGenerator");
            await storage.updateBlogGenerationJob(job.id, { status: "failed", errorMessage: "Could not acquire lock - concurrent execution detected" });
            return { success: false, skipped: true, reason: "locked", job };
        }

        try {
            await storage.updateBlogGenerationJob(job.id, { status: "in_progress", startedAt: new Date() });

            const topic = await this.generateTopic(seoKeywords, enableTrendAnalysis);
            log(`Generated topic: ${topic}`, "BlogGenerator");

            const content = await this.generatePostContent(topic, seoKeywords, promptStyle);
            log("Generated content successfully", "BlogGenerator");

            const imageUrl = await this.generatePostImage(topic);
            log(`Generated image URL: ${imageUrl}`, "BlogGenerator");

            const slug = await this.generateUniqueSlug(content.title);

            const newPost = {
                title: content.title,
                slug: slug,
                content: content.content,
                excerpt: content.excerpt,
                metaDescription: content.metaDescription,
                focusKeyword: content.focusKeyword,
                tags: content.tags,
                featureImageUrl: imageUrl,
                status: "draft",
                authorName: "AI Assistant",
            };

            const validPost = insertBlogPostSchema.parse(newPost);
            const savedPost = await storage.createBlogPost(validPost);

            await storage.updateBlogGenerationJob(job.id, {
                status: "completed",
                completedAt: new Date(),
                postId: savedPost.id,
                publishedPostId: savedPost.id,
            });

            await storage.upsertBlogSettings({ ...settings, lastRunAt: new Date() });

            log(`Blog post "${content.title}" created as draft successfully!`, "BlogGenerator");

            return { success: true, post: savedPost, job };

        } catch (error) {
            const errorMsg = (error as Error).message;
            console.error("Error generating blog post:", error);
            log(`Error generating blog post: ${errorMsg}`, "BlogGenerator");

            const updatedJob = await storage.updateBlogGenerationJob(job.id, {
                status: "failed",
                errorMessage: errorMsg,
                completedAt: new Date(),
                attempts: (job.attempts ?? 0) + 1,
            });

            return { success: false, job: updatedJob, error: errorMsg };
        } finally {
            try {
                await storage.releaseBlogGenerationLock(job.id, lockIdentity);
            } catch (e) {
                log(`Error releasing lock for job ${job.id}: ${(e as Error).message}`, "BlogGenerator");
            }
        }
    }

    private static async generateTopic(keywords: string, trendAnalysis: boolean): Promise<string> {
        let prompt = `Generate a single, engaging blog post topic for a professional cleaning service company. 
    The topic should be relevant to homeowners or business owners interested in cleaning, organization, or home maintenance.`;

        if (keywords) {
            prompt += ` Incorporate one or more of these SEO keywords if natural: ${keywords}.`;
        }

        if (trendAnalysis) {
            prompt += ` Try to align the topic with current seasonal trends or common cleaning concerns for the current time of year.`;
        }

        prompt += ` Return ONLY the topic string, nothing else.`;

        const model = await this.getModel();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    }

    private static async generatePostContent(topic: string, keywords: string, style: string): Promise<{
        title: string;
        content: string;
        excerpt: string;
        metaDescription: string;
        focusKeyword: string;
        tags: string;
    }> {
        let prompt = `Write a comprehensive, SEO-optimized blog post about "${topic}" for a cleaning service company.`;

        if (keywords) {
            prompt += ` Ensure the content is optimized for these keywords: ${keywords}.`;
        }

        if (style) {
            prompt += ` Follow this style/tone guide: ${style}.`;
        }

        prompt += `
    Return the response in strictly valid JSON format with the following structure:
    {
      "title": "Catchy and SEO-friendly title",
      "content": "Full HTML content of the blog post (use <h2>, <h3>, <p>, <ul>, <li> tags, but NO <h1> or <html>/<body> tags). Make it informative and engaging.",
      "excerpt": "A short summary (1-2 sentences) for the blog listing page.",
      "metaDescription": "SEO meta description (under 160 characters).",
      "focusKeyword": "Primary SEO keyword for the post.",
      "tags": "Comma-separated list of 3-5 relevant tags."
    }
    
    Do not include markdown code blocks (like \`\`\`json). Just return the raw JSON string.`;

        const model = await this.getModel();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        if (text.startsWith("```json")) {
            text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (text.startsWith("```")) {
            text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON from Gemini:", text);
            throw new Error("Failed to parse generated blog content");
        }
    }

    private static async getImageModel() {
        const apiKey = await this.getGeminiApiKey();
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-image-preview",
            generationConfig: {
                responseModalities: ["image", "text"],
            } as Record<string, unknown>,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            ],
        });
    }

    private static async generatePostImage(topic: string): Promise<string> {
        try {
            const model = await this.getImageModel();
            const prompt = `Generate a professional, high-quality photograph-style image for a blog post about "${topic}" for a cleaning service company. 
The image should be clean, bright, and inviting - showing a spotless, organized space.
Style: Professional real estate or lifestyle photography.
Aspect ratio: 16:9 landscape.
No text, watermarks, or logos in the image.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            const candidate = response.candidates?.[0];
            if (!candidate?.content?.parts) {
                log("No image parts in response, falling back", "BlogGenerator");
                return this.generateFallbackImage(topic);
            }

            for (const part of candidate.content.parts) {
                if (part.inlineData?.mimeType?.startsWith("image/") && part.inlineData?.data) {
                    const base64Data = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType;
                    const extension = mimeType.split("/")[1] || "png";
                    
                    const buffer = Buffer.from(base64Data, "base64");
                    const timestamp = Date.now();
                    const sanitizedTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 50);
                    const path = `blog-images/${sanitizedTopic}-${timestamp}.${extension}`;
                    
                    const publicUrl = await storageService.uploadFile(
                        "images",
                        path,
                        buffer,
                        mimeType
                    );
                    
                    log(`Image uploaded successfully: ${publicUrl}`, "BlogGenerator");
                    return publicUrl;
                }
            }

            log("No image data found in response parts, falling back", "BlogGenerator");
            return this.generateFallbackImage(topic);
        } catch (error) {
            log(`Image generation failed: ${error}. Falling back to placeholder`, "BlogGenerator");
            return this.generateFallbackImage(topic);
        }
    }

    private static generateFallbackImage(topic: string): string {
        const keywords = topic.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).slice(0, 3).join(",");
        return `https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=450&fit=crop`;
    }

    private static slugify(text: string): string {
        return text
            .toString()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]+/g, "")
            .replace(/\-\-+/g, "-")
            .replace(/^-+/, "")
            .replace(/-+$/, "");
    }

    private static async generateUniqueSlug(title: string): Promise<string> {
        const baseSlug = this.slugify(title);
        let slug = baseSlug;
        let suffix = 2;

        while (true) {
            const existingPost = await storage.getBlogPostBySlug(slug);
            if (!existingPost) {
                break;
            }
            slug = `${baseSlug}-${suffix}`;
            suffix++;
        }

        return slug;
    }
}
