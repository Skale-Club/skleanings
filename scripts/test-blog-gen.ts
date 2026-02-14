
import "dotenv/config";
import { BlogGenerator } from "../server/services/blog-generator";
import { storage } from "../server/storage";

async function main() {
    console.log("Testing BlogGenerator...");
    try {
        const post = await BlogGenerator.startDailyPostGeneration();
        console.log("Successfully generated post:", post.title);
        console.log("Slug:", post.slug);
        console.log("Image:", post.featureImageUrl);

        // Verify it's in the DB
        const dbPost = await storage.getBlogPostBySlug(post.slug);
        if (dbPost) {
            console.log("Verified: Post found in database!");
        } else {
            console.error("Error: Post not found in database after creation.");
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

main();
