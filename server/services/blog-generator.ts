
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../storage";
import { insertBlogPostSchema } from "@shared/schema";
import { log } from "../lib/logger";

export class BlogGenerator {

    private static async getModel() {
        let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            // Try to get from DB integration settings
            // We need to handle the case where storage might not be fully ready in some contexts,
            // but here we are in a service method called after startup.
            try {
                const integration = await storage.getChatIntegration("gemini");
                if (integration?.apiKey) {
                    apiKey = integration.apiKey;
                }
            } catch (e) {
                log(`Error fetching Gemini key from DB: ${e}`, "BlogGenerator");
            }
        }

        if (!apiKey) {
            throw new Error("Gemini API key not found in environment variables or database integration settings.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    static async startDailyPostGeneration(options: { manual?: boolean } = {}) {
        log(`Starting blog post generation (Manual: ${options.manual})`, "BlogGenerator");
        try {
            const settings = await storage.getBlogSettings();

            // Check if enabled (unless manual)
            if (!options.manual) {
                if (!settings?.enabled) {
                    log("Blog generation disabled in settings. Skipping.", "BlogGenerator");
                    return;
                }

                // Check frequency
                if (settings.lastRunAt && settings.postsPerDay > 0) {
                    const now = new Date();
                    const lastRun = new Date(settings.lastRunAt);
                    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
                    const hoursBetweenPosts = 24 / settings.postsPerDay;

                    if (hoursSinceLastRun < hoursBetweenPosts) {
                        log(`Skipping generation. Last run was ${hoursSinceLastRun.toFixed(2)} hours ago. Schedule is every ${hoursBetweenPosts.toFixed(2)} hours.`, "BlogGenerator");
                        return;
                    }
                }
            }

            const seoKeywords = settings?.seoKeywords || "";
            const enableTrendAnalysis = settings?.enableTrendAnalysis ?? true;
            const promptStyle = settings?.promptStyle || "";

            const topic = await this.generateTopic(seoKeywords, enableTrendAnalysis);
            log(`Generated topic: ${topic}`, "BlogGenerator");

            const content = await this.generatePostContent(topic, seoKeywords, promptStyle);
            log("Generated content successfully", "BlogGenerator");

            const imageUrl = await this.generatePostImage(topic);
            log(`Generated image URL: ${imageUrl}`, "BlogGenerator");

            const slug = this.slugify(content.title);

            const newPost = {
                title: content.title,
                slug: slug,
                content: content.content,
                excerpt: content.excerpt,
                metaDescription: content.metaDescription,
                focusKeyword: content.focusKeyword,
                tags: content.tags,
                featureImageUrl: imageUrl,
                status: "published",
                authorName: "AI Assistant",
                publishedAt: new Date(),
            };

            const validPost = insertBlogPostSchema.parse(newPost);
            const savedPost = await storage.createBlogPost(validPost);

            // Update last run time if settings exist
            if (settings) {
                await storage.upsertBlogSettings({ ...settings, lastRunAt: new Date() });
            }

            log(`Blog post "${content.title}" published successfully!`, "BlogGenerator");
            return savedPost;

        } catch (error) {
            console.error("Error generating blog post:", error);
            log(`Error generating blog post: ${(error as Error).message}`, "BlogGenerator");
            throw error;
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

        // Clean up markdown code blocks if Gemini includes them
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

    private static async generatePostImage(topic: string): Promise<string> {
        // For now, we'll use a high-quality placeholder from Unsplash based on keywords
        // because standard Gemini text models don't generate images directly via this API interactively 
        // without specific Imagen configuration or distinct endpoints.
        // To ensure reliability for the "MVP", we use a relevant Unsplash source.

        const keywords = topic.split(" ").slice(0, 3).join(",");
        const encodedKeywords = encodeURIComponent(keywords);
        // Use a source that redirects to a random image matching keywords
        return `https://source.unsplash.com/800x600/?cleaning,home,${encodedKeywords}`;
    }

    private static slugify(text: string): string {
        return text
            .toString()
            .toLowerCase()
            .replace(/\s+/g, "-") // Replace spaces with -
            .replace(/[^\w\-]+/g, "") // Remove all non-word chars
            .replace(/\-\-+/g, "-") // Replace multiple - with single -
            .replace(/^-+/, "") // Trim - from start of text
            .replace(/-+$/, ""); // Trim - from end of text
    }
}
