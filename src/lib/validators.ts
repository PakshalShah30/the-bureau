import { z } from "zod";
export const companySchema = z.object({ name: z.string().trim().min(2).max(100), atsType: z.enum(["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE"]),
  boardSlug: z.string().trim().min(1).max(120).regex(/^[\w.\- ]+$/, "Use the board slug, not a URL"),
  careersUrl: z.url().startsWith("https:").nullable().optional(), website: z.url().startsWith("https:").nullable().optional(),
  ycBatch: z.string().trim().max(20).nullable().optional(), ycUrl: z.url().startsWith("https:").nullable().optional(),
  industry: z.string().trim().max(100).nullable().optional(), teamSize: z.number().int().positive().nullable().optional(),
  employerOverride: z.string().trim().max(150).nullable().optional(), active: z.boolean().optional() });

export const applicationSchema = z.object({ jobId: z.string().nullable().optional(), title: z.string().trim().min(2).max(200),
  companyName: z.string().trim().min(2).max(120), status: z.enum(["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"]).default("SAVED"),
  appliedAt: z.iso.datetime({ offset: true }).nullable().optional(), followUpAt: z.iso.datetime({ offset: true }).nullable().optional(),
  resumeId: z.string().nullable().optional(), notes: z.string().max(5000).default("") });
