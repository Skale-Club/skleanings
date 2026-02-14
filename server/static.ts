import express, { type Express } from "express";
import fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

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

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath!, "index.html"));
  });
}
