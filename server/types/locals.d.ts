import "express";
import type { DatabaseStorage } from "../storage";
import type { tenants } from "@shared/schema";

declare global {
  namespace Express {
    interface Locals {
      tenant?: typeof tenants.$inferSelect;
      storage?: InstanceType<typeof DatabaseStorage>;
    }
  }
}

export {};
