import { demoStore } from "./demo";
import { prismaStore } from "./prisma";
export const isDemo = process.env.DEMO_MODE === "true" || (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL);
export const store = isDemo ? demoStore : prismaStore;
