import type { Application, Resume } from "./types";

/**
 * One CSV cell. Quotes when needed, and neutralises spreadsheet formulas: a
 * company name or note starting with = + - @ would otherwise run as a formula
 * when the file is opened in Excel or Google Sheets (CSV injection).
 */
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function applicationsCsv(applications: Application[], resumes: Resume[] = []) {
  const resumeName = new Map(resumes.map(r => [r.id, r.name]));
  const header = ["Company", "Role", "Status", "Applied", "Follow up", "Resume", "Apply link", "Notes", "Last updated"];
  const day = (v: string | null) => (v ? v.slice(0, 10) : "");
  const rows = applications.map(a => [a.companyName, a.title, a.status, day(a.appliedAt), day(a.followUpAt),
    a.resumeId ? resumeName.get(a.resumeId) || "" : "", a.job?.originalUrl || "", a.notes, day(a.updatedAt)]);
  // BOM so Excel opens UTF-8 names (accents, non-Latin scripts) correctly.
  return "﻿" + [header, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
