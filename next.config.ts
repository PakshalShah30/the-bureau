import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFs and Word parsing use Node APIs; all upload/export routes run on Node.
  serverExternalPackages: ["pdf-parse", "mammoth", "exceljs"],
  // Local preview is proxied through a dynamic hostname.
  allowedDevOrigins: ["*.e2b.app"],
  // Include Unicode PDF fonts when deploying as a traced serverless function.
  outputFileTracingIncludes: { "/api/resumes/[id]/download": ["./assets/fonts/*.ttf"] },
};
export default nextConfig;
