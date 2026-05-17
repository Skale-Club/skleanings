import express, { type Express } from "express";
import fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { injectSeoMeta, getCachedSettings } from "./lib/seo-injector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function serveStatic(app: Express) {
  // Try multiple possible paths for the build directory
  const possiblePaths = [
    path.resolve(__dirname, "public"),              // Local dev: server/public
    path.resolve(__dirname, "..", "dist", "public"), // Build output: dist/public
    path.resolve(process.cwd(), "dist", "public"),   // Vercel: /var/task/dist/public
    path.resolve("/var/task", "dist", "public"),     // Vercel absolute path
  ];

  let distPath: string | undefined;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      distPath = p;
      console.log(`[static] Found build directory at: ${distPath}`);
      break;
    }
  }

  if (!distPath) {
    console.error(`[static] Could not find build directory. Tried: ${possiblePaths.join(", ")}`);
    console.error(`[static] Current __dirname: ${__dirname}`);
    console.error(`[static] Current cwd: ${process.cwd()}`);
    throw new Error(
      `Could not find the build directory in any of: ${possiblePaths.join(", ")}`,
    );
  }

  // Serve static assets with cache headers
  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  // index: false so GET / falls through to the SEO-injecting catch-all below.
  // Otherwise express.static would serve raw index.html with unreplaced {{TOKENS}}.
  app.use(express.static(distPath, { index: false }));

  // Phase 16: catch-all serves dynamically-injected HTML (no longer raw sendFile).
  app.use("*", async (req, res) => {
    try {
      const indexPath = path.resolve(distPath!, "index.html");
      const template = await fs.promises.readFile(indexPath, "utf-8");
      const settings = await getCachedSettings(res.locals.storage!);
      const injected = injectSeoMeta(template, settings, {
        protocol: req.protocol,
        host: req.get("host") || "",
        originalUrl: req.originalUrl,
      });
      res
        .status(200)
        .set({ "Content-Type": "text/html; charset=utf-8" })
        .end(injected);
    } catch (err) {
      console.error("[static] SEO injection failed; falling back to raw file", err);
      res.sendFile(path.resolve(distPath!, "index.html"));
    }
  });
}
