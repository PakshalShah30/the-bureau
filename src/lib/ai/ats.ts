import type { Resume } from "../types";
// A finite, transparent vocabulary. Gaps are NEVER added to the resume automatically.
export const SKILLS = ["TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python", "Java", "Kotlin", "Go", "Rust", "C++", "C#", "SQL", "PostgreSQL", "MySQL", "MongoDB", "GraphQL", "REST", "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Redis", "Temporal", "Snowflake", "BigQuery", "Redshift", "dbt", "Looker", "Tableau", "Salesforce", "HubSpot", "Figma", "Git", "GitHub Actions", "CI/CD", "Terraform", "Airflow", "PyTorch", "TensorFlow", "LLM", "machine learning", "data engineering", "data modeling", "data pipelines", "ETL", "analytics", "accessibility", "user research", "product management", "design systems", "API", "microservices", "security", "customer success", "customer support", "revenue operations", "CRM", "A/B testing", "experimentation", "observability", "incident response", "CDC", "JDBC", "S3", "React Native", "Swift", "iOS", "Android"] as const;
function has(text: string, skill: string) {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z\d])${escaped}($|[^a-z\d])`, "i").test(text);
}
export function keywords(text: string) { return SKILLS.filter(skill => has(text, skill)); }
export function atsScore(resume: string, description: string) {
  const required = keywords(description);
  const matched = required.filter(skill => has(resume, skill));
  const missing = required.filter(skill => !has(resume, skill));
  return { score: required.length ? Math.round(100 * matched.length / required.length) : 0,
    matched, missing, total: required.length, note: required.length ? null : "Not enough skill detail in this source posting to calculate an ATS match." };
}
export function formattingCheck(resume: Pick<Resume, "content" | "mimeType" | "filename">) {
  const text = resume.content;
  const checks = [
    { label: "Standard section headings", passed: /\b(experience|work experience|employment)\b/i.test(text) && /\b(skills|technical skills)\b/i.test(text), detail: "Use Experience and Skills headings so parsers can find them." },
    { label: "Parseable dates", passed: /\b(?:20\d{2}|19\d{2})\b/.test(text), detail: "Include four-digit years for each role." },
    { label: "Single-column text", passed: !/(?:\t.{2,}\t|\|\s{4,}\|)/.test(text), detail: "Avoid tabbed columns or complex tables in critical sections." },
    { label: "Recruiter-friendly file", passed: !resume.filename || /\.(pdf|docx|txt)$/i.test(resume.filename), detail: "Use a selectable-text PDF or DOCX." },
  ];
  return { checks, notice: "Layout and graphics cannot be reliably verified from extracted text. Review the exported file visually." };
}
const stop = new Set("the a an and or for from with into that this through which used using have has over under to of by in on at as was were is are be it we our your new more less their them his her its across each per while helped built worked owned led improved shipped designed developed created reduced increased managed made added".split(" "));
function contentWords(text: string) { return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g) || []).filter(w => !stop.has(w)); }
function anchors(text: string) { return (text.match(/(?:[$€£]?\d[\d,.]*%?|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b)/gi) || []).map(s => s.toLowerCase()); }
export function factLock(original: string, rewritten: string, fullResume: string, confirmedSkills: string[] = []) {
  const reasons: string[] = [];
  const before = anchors(original), after = anchors(rewritten);
  if (before.some(x => !after.includes(x))) reasons.push("A number, date or metric from the original is missing or changed.");
  if (after.some(x => !before.includes(x))) reasons.push("A new number, date or metric was added.");
  // Directional/achievement verbs are factual: swapping "reduced" for "increased" is not a stylistic edit.
  const actions = ["reduced", "increased", "improved", "decreased", "grew", "saved", "cut", "boosted", "shipped", "designed", "built", "led", "managed", "mentored", "delivered", "maintained", "created", "developed", "migrated", "launched", "automated", "optimized", "raised", "lowered", "wrote"];
  const originalActions = actions.filter(v => new RegExp(`\\b${v}\\b`, "i").test(original));
  const changedActions = originalActions.filter(v => !new RegExp(`\\b${v}\\b`, "i").test(rewritten));
  if (changedActions.length) reasons.push(`Achievement action changed or removed: ${changedActions.join(", ")}.`);
  const properNames = (original.match(/\b[A-Z][A-Za-z0-9+.]{2,}\b/g) || []).filter(name => !/^(Built|Developed|Led|Designed|Improved|Created|Managed|Mentored|Shipped|Worked|Wrote|Reduced|Increased|Maintained|Launched|Optimized|Automated)$/.test(name));
  if (properNames.some(name => !rewritten.toLowerCase().includes(name.toLowerCase()))) reasons.push("A named entity or proper noun from the original was removed.");
  const sourceSkills = keywords(fullResume);
  const newSkills = keywords(rewritten).filter(s => !sourceSkills.includes(s) && !confirmedSkills.includes(s));
  if (newSkills.length) reasons.push(`Unverified skill added: ${newSkills.join(", ")}. Confirm it before adding.`);
  const originalSkills = keywords(original);
  const droppedSkills = originalSkills.filter(s => !has(rewritten, s));
  if (droppedSkills.length) reasons.push(`Original tool/skill was dropped: ${droppedSkills.join(", ")}.`);
  // A conservative lexical check fails closed when a rewording drops too many concrete claims.
  const facts = [...new Set(contentWords(original))];
  const kept = facts.filter(w => contentWords(rewritten).includes(w));
  if (facts.length >= 4 && kept.length / facts.length < 0.7) reasons.push("Too many concrete words changed; the meaning may have shifted.");
  if (rewritten.trim().length < original.trim().length * 0.55) reasons.push("Much of the original claim was removed.");
  if (rewritten.length > original.length * 1.7 && rewritten.length - original.length > 35) reasons.push("The rewrite adds substantial new claims.");
  if (/\b(never|not|no longer|without)\b/i.test(rewritten) !== /\b(never|not|no longer|without)\b/i.test(original)) reasons.push("Negation changed the meaning.");
  return { safe: reasons.length === 0, reasons };
}
export function validateFinalResume(original: string, final: string, confirmedSkills: string[] = []) {
  const a = original.replace(/\r/g, "").split("\n"), b = final.replace(/\r/g, "").split("\n");
  const extras = confirmedSkills.length ? ["", "VERIFIED ADDITIONAL SKILLS", confirmedSkills.join(", ")] : [];
  if (b.length !== a.length + extras.length || (extras.length && b.slice(a.length).join("\n") !== extras.join("\n")))
    return { safe: false, reasons: ["Only individual bullets and explicitly confirmed skills can change. Keep all original sections and lines."] };
  const reasons: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (!/^\s*[-•*]\s+/.test(a[i]) || !/^\s*[-•*]\s+/.test(b[i])) { reasons.push(`Line ${i + 1}: a fact outside a bullet was changed.`); continue; }
    const guard = factLock(a[i], b[i], original, confirmedSkills);
    reasons.push(...guard.reasons.map(r => `Line ${i + 1}: ${r}`));
  }
  return { safe: reasons.length === 0, reasons };
}
