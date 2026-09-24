// Edge-safe (no Node imports): shared by Auth.js and the route-protection middleware.
const DEMO_AUTH_SECRET = "preview-only-do-not-use-in-production-64f8ad";
export function isDemoEnv() { return process.env.DEMO_MODE === "true" || (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL); }
export function authSecret() { return process.env.AUTH_SECRET || (isDemoEnv() ? DEMO_AUTH_SECRET : undefined); }
