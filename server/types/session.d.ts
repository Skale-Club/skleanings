import "express-session";

declare module "express-session" {
  interface SessionData {
    superAdmin?: { authenticated: true };
    adminUser?: {
      id: string;
      email: string;
      role: string;
      tenantId?: number;
    };
  }
}
