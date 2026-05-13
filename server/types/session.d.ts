import "express-session";

declare module "express-session" {
  interface SessionData {
    superAdmin?: { authenticated: true };
  }
}
