import { storage } from "../storage";
import type { InsertNotificationLog } from "@shared/schema";

const MAX_PREVIEW_LENGTH = 5000;

export async function logNotification(entry: InsertNotificationLog): Promise<void> {
  try {
    const safeEntry: InsertNotificationLog = {
      ...entry,
      preview: entry.preview.slice(0, MAX_PREVIEW_LENGTH),
    };
    await storage.createNotificationLog(safeEntry);
  } catch (err) {
    console.error("[notification-logger] Failed to write log entry:", err);
  }
}
