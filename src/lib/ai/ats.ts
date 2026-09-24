import type { Resume } from "../types";
/**
 * A finite, transparent skill vocabulary. Gaps are NEVER added to the resume automatically.
 *
 * Each skill can carry aliases ("Postgres" → PostgreSQL) and, for words that are also
 * everyday English, a custom matcher: "go-to-market" is not the Go language and "the
 * rest of the team" is not REST.
 */
type SkillDef = { name: string; aliases?: string[]; match?: RegExp };
const DEFS: SkillDef[] = [
  { name: "TypeScript" }, { name: "JavaScript", aliases: ["JS", "ES6", "ECMAScript"] },
  { name: "React", aliases: ["React.js", "ReactJS"] }, { name: "Next.js", aliases: ["NextJS", "Next js"] },
  { name: "Node.js", aliases: ["NodeJS", "Node js"] }, { name: "Python" }, { name: "Java" }, { name: "Kotlin" },
  // Case-sensitive, not "Go to…", not "go-to-market"; "Golang" always counts.
  { name: "Go", match: /(?<![\w-])(?:Go(?![\w-])(?!\s+(?:to|for|live|beyond|above)\b)|[Gg]olang)(?![\w-])/ },
  { name: "Rust" }, { name: "C++" }, { name: "C#" }, { name: "SQL" }, { name: "PostgreSQL", aliases: ["Postgres"] },
  { name: "MySQL" }, { name: "MongoDB", aliases: ["Mongo"] }, { name: "GraphQL" },
  // Upper-case REST / RESTful only: "the rest of the team" must not count.
  { name: "REST", match: /(?<![\w-])(?:REST(?:ful)?|[Rr]estful)(?![\w-])/ },
  { name: "AWS", aliases: ["Amazon Web Services"] }, { name: "GCP", aliases: ["Google Cloud", "Google Cloud Platform"] },
  { name: "Azure" }, { name: "Docker" }, { name: "Kubernetes", aliases: ["k8s"] }, { name: "Redis" }, { name: "Temporal", match: /(?<![\w-])Temporal(?![\w-])/ },
  { name: "Snowflake" }, { name: "BigQuery" }, { name: "Redshift" }, { name: "dbt", match: /(?<![\w-])dbt(?![\w-])/ },
  { name: "Looker" }, { name: "Tableau" }, { name: "Power BI", aliases: ["PowerBI"] }, { name: "Excel", match: /(?<![\w-])(?:MS |Microsoft )?Excel(?![\w-])/ },
  { name: "Salesforce" }, { name: "HubSpot" }, { name: "Figma" }, { name: "Git" }, { name: "GitHub Actions" },
  { name: "CI/CD", aliases: ["continuous integration", "continuous delivery", "continuous deployment"] },
  { name: "Terraform" }, { name: "Airflow" }, { name: "PyTorch" }, { name: "TensorFlow" },
  { name: "LLM", aliases: ["LLMs", "large language model", "large language models"] },
  { name: "machine learning", aliases: ["ML"], match: /(?<![\w-])(?:[Mm]achine [Ll]earning|ML)(?![\w-])/ },
  { name: "data engineering" }, { name: "data modeling", aliases: ["data modelling"] }, { name: "data pipelines", aliases: ["data pipeline"] },
  { name: "ETL", aliases: ["ELT"] }, { name: "analytics" }, { name: "accessibility", aliases: ["a11y", "WCAG"] },
  { name: "user research" }, { name: "product management" }, { name: "design systems", aliases: ["design system"] },
  { name: "API", aliases: ["APIs"] }, { name: "microservices" }, { name: "security" }, { name: "customer success" },
  { name: "customer support" }, { name: "revenue operations", aliases: ["RevOps"] }, { name: "CRM" },
  { name: "A/B testing", aliases: ["AB testing", "split testing"] }, { name: "experimentation" }, { name: "observability" },
  { name: "incident response" }, { name: "CDC", match: /(?<![\w-])CDC(?![\w-])/ }, { name: "JDBC" }, { name: "S3", match: /(?<![\w-])S3(?![\w-])/ },
  { name: "React Native" }, { name: "Swift", match: /(?<![\w-])Swift(?:UI)?(?![\w-])/ }, { name: "iOS" }, { name: "Android" },
  // Business analysis, QA and delivery — common in BA/QA and product roles.
  { name: "Jira" }, { name: "Confluence" }, { name: "Postman" }, { name: "Selenium" }, { name: "Cypress" },
  { name: "Playwright" }, { name: "test automation", aliases: ["automated testing", "automation testing"] },
  { name: "manual testing" }, { name: "regression testing" }, { name: "UAT", aliases: ["user acceptance testing"] },
  { name: "API testing" }, { name: "test cases", aliases: ["test case"] }, { name: "test plans", aliases: ["test plan"] },
  { name: "requirements gathering", aliases: ["requirements analysis", "requirements elicitation", "business requirements", "BRD", "FRD"] },
  { name: "user stories", aliases: ["user story", "acceptance criteria"] }, { name: "Agile" }, { name: "Scrum" }, { name: "Kanban" },
  { name: "process mapping", aliases: ["BPMN", "process modeling", "process modelling"] }, { name: "stakeholder management" },
  { name: "JSON", match: /(?<![\w-])JSON(?![\w-])/ }, { name: "XML", match: /(?<![\w-])XML(?![\w-])/ }, { name: "SOAP", match: /(?<![\w-])SOAP(?![\w-])/ },
  { name: "Linux" }, { name: "Azure DevOps" },
];
export const SKILLS = DEFS.map(d => d.name);
export type Skill = string;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = new Map(DEFS.map(d => [d.name, d.match
  ? [d.match]
  : [d.name, ...(d.aliases || [])].map(term => new RegExp(`(?<![a-z\\d])${escape(term)}(?![a-z\\d])`, "i"))]));
function has(text: string, skill: string) {
  return (MATCHERS.get(skill) || [new RegExp(`(?<![a-z\\d])${escape(skill)}(?![a-z\\d])`, "i")]).some(re => re.test(text));
}
export function keywords(text: string) { return SKILLS.filter(skill => has(text, skill)); }

/**
 * Split a posting into "required" and "preferred" parts. Skills that appear only
 * under a Nice-to-have / Preferred / Bonus heading count half as much, so a
 * resume is not scored as a poor fit for missing optional extras.
 */
const PREFERRED_HEAD = /^\s*(?:#+\s*)?(?:[\w\s]{0,20})?(?:nice[\s-]to[\s-]haves?|preferred(?:\s+qualifications|\s+skills)?|bonus(?:\s+points)?|pluses|it'?s?\s+a\s+plus|would\s+be\s+(?:great|nice)|extra\s+credit)\b[^.\n]{0,40}:?\s*$/i;
const REQUIRED_HEAD = /^\s*(?:#+\s*)?(?:requirements?|(?:minimum\s+|basic\s+)?qualifications|what\s+you(?:'ll|\s+will)?\s+(?:need|bring)|you\s+(?:have|bring|are)|must[\s-]haves?|about\s+you|responsibilities|what\s+you(?:'ll|\s+will)\s+do)\b[^.\n]{0,40}:?\s*$/i;
export function splitRequirements(description: string) {
  const required: string[] = [], preferred: string[] = [];
  let mode: "required" | "preferred" = "required";
  for (const line of description.replace(/\r/g, "").split("\n")) {
    if (PREFERRED_HEAD.test(line)) { mode = "preferred"; continue; }
    if (REQUIRED_HEAD.test(line)) { mode = "required"; continue; }
    // Inline markers: "Bonus: Kubernetes" / "Nice to have: Rust"
    if (/^\s*[-•*]?\s*(?:bonus|nice to have|preferred|a plus)\s*:/i.test(line) || /\b(?:is|are|would be)\s+a\s+(?:plus|bonus)\b/i.test(line)) { preferred.push(line); continue; }
    (mode === "required" ? required : preferred).push(line);
  }
  return { required: required.join("\n"), preferred: preferred.join("\n") };
}

export function atsScore(resume: string, description: string) {
  const parts = splitRequirements(description);
  const requiredSkills = keywords(parts.required);
  const preferredSkills = keywords(parts.preferred).filter(s => !requiredSkills.includes(s));
  const all = [...requiredSkills, ...preferredSkills];
  const weight = (skill: string) => requiredSkills.includes(skill) ? 1 : 0.5;
  const matched = all.filter(skill => has(resume, skill));
  const missing = all.filter(skill => !has(resume, skill));
  const total = all.reduce((n, s) => n + weight(s), 0);
  const got = matched.reduce((n, s) => n + weight(s), 0);
  return { score: total ? Math.round(100 * got / total) : 0,
    matched, missing, total: all.length,
    required: requiredSkills, preferred: preferredSkills,
    missingRequired: missing.filter(s => requiredSkills.includes(s)),
    note: all.length ? null : "Not enough skill detail in this source posting to calculate an ATS match." };
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
// Numbers, money, percentages and month names. Months are matched as whole, capitalised
// words only: the old pattern read "Decreased" as December and "Marketing" as March.
const MONTH = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b\.?/g;
function anchors(text: string) {
  const numbers = text.match(/[$€£]?\d[\d,.]*%?/g) || [];
  const months = (text.match(MONTH) || []).map(m => m.replace(/\.$/, ""));
  return [...numbers, ...months].map(s => s.toLowerCase().replace(/[.,]$/, ""));
}
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
  // A capitalised word is a name unless it is the bullet's opening verb ("Decreased",
  // "Partnered") — rephrasing the verb is covered by the action check above.
  const opening = original.replace(/^\s*[-•*]\s*/, "").split(/\s+/)[0] || "";
  const properNames = (original.match(/\b[A-Z][A-Za-z0-9+.]{2,}\b/g) || []).filter(name => name !== opening
    && !actions.includes(name.toLowerCase()) && !/^(Built|Developed|Led|Designed|Improved|Created|Managed|Mentored|Shipped|Worked|Wrote|Reduced|Increased|Maintained|Launched|Optimized|Automated)$/.test(name));
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
