import type { Resume } from "../types";
// A curated vocabulary gives well-known skills a stable spelling and a higher weight. It is
// NOT the limit of what is matched: extractJobKeywords() also reads tools, acronyms and
// repeated domain phrases directly from each job description. Gaps are NEVER added automatically.
export const SKILLS = ["TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python", "Java", "Kotlin", "Go", "Rust", "C++", "C#", "SQL", "PostgreSQL", "MySQL", "MongoDB", "GraphQL", "REST", "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Redis", "Temporal", "Snowflake", "BigQuery", "Redshift", "dbt", "Looker", "Tableau", "Salesforce", "HubSpot", "Figma", "Git", "GitHub Actions", "CI/CD", "Terraform", "Airflow", "PyTorch", "TensorFlow", "LLM", "machine learning", "data engineering", "data modeling", "data pipelines", "ETL", "analytics", "accessibility", "user research", "product management", "design systems", "API", "microservices", "security", "customer success", "customer support", "revenue operations", "CRM", "A/B testing", "experimentation", "observability", "incident response", "CDC", "JDBC", "S3", "React Native", "Swift", "iOS", "Android"] as const;

export type Keyword = { term: string; weight: number; kind: "skill" | "tool" | "phrase" };

function escape(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
// Phrases match simple plural/singular variants ("data pipeline" ↔ "data pipelines") and
// hyphen/space variants ("real-time" ↔ "real time"). Tokens with symbols match exactly.
function termPattern(term: string) {
  const words = term.trim().split(/[\s-]+/);
  const stem = (w: string) => /(?:ss|ch|sh|x)es$/i.test(w) ? w.slice(0, -2) : /[^s]s$/i.test(w) ? w.slice(0, -1) : w;
  const body = words.map(w => /^[a-z]{3,}$/i.test(w) ? `${escape(stem(w))}(?:s|es)?` : escape(w)).join("[\\s-]+");
  return new RegExp(`(^|[^a-z\\d])${body}($|[^a-z\\d+#])`, "i");
}
// Skills that are also everyday English words only match with their exact capitalization.
const CASE_SENSITIVE = new Set(["Go", "REST", "Swift", "Rust", "Temporal", "Looker", "Git"]);
const patternCache = new Map<string, RegExp>();
export function hasTerm(text: string, term: string) {
  let re = patternCache.get(term);
  if (!re) {
    re = termPattern(term);
    if (CASE_SENSITIVE.has(term)) re = new RegExp(re.source);
    patternCache.set(term, re);
  }
  return re.test(text);
}
/** Curated skills present in a text (used for fact-lock skill checks). */
export function keywords(text: string) { return SKILLS.filter(skill => hasTerm(text, skill)); }

// Words that never make a meaningful keyword on their own or inside a phrase.
const GENERIC = new Set(("ability able about above across after again against all also always among and another any are around as at based be because been being best better between big both bring build building business but by can candidate candidates career company competitive could culture day days deep degree demonstrated description desire do does doing each eager easy effective either employee employees end equal etc even every excellent excited exciting experience experienced experiences expert expertise familiar familiarity fast fast-paced few field first focus for from fun get good great grow growing growth hands-on happy has have help high highly how ideal ideally if impact impactful in including independently individual interest into is it its job join just keen key knowledge large learn learning least level like looking love lot make many may meaningful mindset more most motivated much must need needed new nice not of offer on one only opportunity or other our out own paced part passion passionate people plus position preferred problem problems proficiency proficient proven qualifications quality real record related relevant required requirement requirements responsibilities responsible role roles salary same see self seniority senior should skill skills small so solid some someone stack start startup still strong success such team teams than that the their them then there these they thing things this those through thrive to together tools top track understanding unique up us use used using value values variety very want way ways we well what when where which while who why will with within work working world would year years you your yourself").split(" "));
const CAPS_BLOCK = new Set("US USA UK EU EMEA APAC LATAM CEO CTO CFO COO VP HR EEO EEOC OK PTO ADA NYC SF LA II III IV AM PM FAQ DEI LGBTQ LGBTQIA GPA ID TBD ASAP WFH FTE COVID LLC INC AND OR THE YOU WE OUR YOUR ABOUT ROLE TEAM JOB WHO WHAT WHY HOW ARE FOR WITH NOT ALL NEW NOW BONUS PERKS APPLY VISA YES NO NOTE REMOTE ONSITE HYBRID USD EUR GBP CA NY TX WA MA CO EAD H4 H1B TN PR OPT CPT GC STEM".split(" "));
// Immigration/benefits wording describes the employer, not a skill to put on a resume.
const NOT_A_SKILL = /visa|sponsor|citizen|authori[sz]ation|immigration|green card|benefit|insurance|equity|salary|compensation|holiday|vacation|parental|401k|pto/i;
const CAP_BLOCK = new Set("The A An We You Our Your This That These Those Is Are Be Will Can Must Should Would Could If In On At For With From By And Or But As To Of It Its They Their Who What Why How When Where About Join Apply Please Benefits Salary Equity Remote Hybrid Onsite Office Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December English Europe America Asia Africa Australia Canada India Germany France Spain London Paris Berlin York San Francisco Seattle Boston Austin Chicago United States Kingdom Inc LLC Ltd Senior Junior Staff Lead Principal Engineer Engineers Manager Director Head Intern Team Teams Company Customers Customer Users User Bonus Nice Plus Requirements Qualifications Responsibilities Experience Skills Role You'll We're What Who".split(" "));
// Duty verbs start sentences, not skills: "improve query performance" → "query performance".
const PHRASE_START = new Set("build operate improve partner own drive design develop lead create manage support ship write maintain define collaborate deliver scale grow run hire mentor champion shape set establish implement architect deploy monitor analyze analyse identify ensure provide enable apply join".split(" "));
const REQ_HEADING = /\b(requirements?|qualifications?|what you('ll| will)? (bring|need|have)|you (have|bring|are)|about you|who you are|skills|must[- ]haves?|nice[- ]to[- ]haves?|preferred|bonus|tech(nology)? stack|our stack|tools|experience with|responsibilities|what you('ll| will) do|in this role)\b/i;

/**
 * Extracts weighted ATS keywords from the job description itself: curated skills, tool names
 * (CamelCase, dotted, symbol and acronym tokens, list-context product names), and domain phrases
 * repeated in the posting or stated in its requirement bullets. Deterministic, so the browser
 * and server always agree on matched/missing terms.
 */
export function extractJobKeywords(description: string, opts: { company?: string; limit?: number } = {}): Keyword[] {
  const found = new Map<string, Keyword & { count: number }>();
  const company = (opts.company || "").toLowerCase();
  const add = (term: string, kind: Keyword["kind"], base: number, emphasis: number) => {
    const clean = term.trim().replace(/[.,:;]+$/, "");
    const key = clean.toLowerCase();
    if (!key || key.length < 2 || (company && (key === company || company.includes(key)))) return;
    const prev = found.get(key);
    if (prev) { prev.count++; prev.weight = Math.max(prev.weight, base * emphasis); if (kind === "skill") prev.kind = "skill"; return; }
    found.set(key, { term: clean, kind, weight: base * emphasis, count: 1 });
  };
  let inRequirements = false;
  const lines = description.replace(/\r/g, "").split("\n");
  const phraseCounts = new Map<string, { count: number; req: boolean }>();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.length < 70 && !/[.!?]$/.test(line) && REQ_HEADING.test(line);
    if (heading) inRequirements = true;
    else if (line.length < 60 && /:$/.test(line)) inRequirements = false;
    const bullet = /^[-•*·▪◦]\s*/.test(line);
    const emphasis = inRequirements || bullet ? 1.5 : 1;
    const allCaps = line === line.toUpperCase();
    for (const skill of SKILLS) if (hasTerm(line, skill)) add(skill, "skill", 3, emphasis);
    const tokens = new Set<string>();
    for (const m of line.matchAll(/\b[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+\b/g)) tokens.add(m[0]); // TypeScript, HubSpot
    for (const m of line.matchAll(/\b[A-Za-z]+\.(?:js|JS)\b|\.NET\b/g)) tokens.add(m[0]); // Vue.js, .NET
    for (const m of line.matchAll(/\b[A-Za-z]\+\+|\b[A-Za-z]#/g)) tokens.add(m[0]); // C++, F#
    if (!allCaps) for (const m of line.matchAll(/\b[A-Z][A-Z0-9]{1,5}s?\b/g)) if (!CAPS_BLOCK.has(m[0].replace(/s$/, ""))) tokens.add(m[0].replace(/(?<=[A-Z]{2})s$/, ""));
    // Capitalized product names in list context: "experience with Kafka, Spark or Flink".
    for (const m of line.matchAll(/(?:,|\bwith|\busing|\blike|\bsuch as|\be\.g\.|\(|\/|\bor|\band|\bin|\bon|\bvia|\bincluding)\s+([A-Z][a-z][A-Za-z0-9]{1,20})(?=\s*(?:,|\)|\/|\bor\b|\band\b|\.|;|$))/g))
      if (!CAP_BLOCK.has(m[1]) && (inRequirements || bullet || (line.match(/,/g) || []).length >= 2)) tokens.add(m[1]);
    for (const t of tokens) if (!GENERIC.has(t.toLowerCase()) && !NOT_A_SKILL.test(t)) add(t, "tool", 2, emphasis);
    // Domain phrases: 2–3 consecutive non-generic lowercase words.
    // Phrases never span punctuation ("dbt, Airflow" is two terms, not one phrase).
    for (const segment of line.toLowerCase().split(/[,.;:()!?]|\s[-–—]\s/)) {
    const words = segment.replace(/[^a-z0-9/+#\s-]/g, " ").split(/\s+/).filter(Boolean);
    for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n);
      if (gram.some(w => GENERIC.has(w) || w.length < 3 || /^\d/.test(w)) || PHRASE_START.has(gram[0])) continue;
      const key = gram.join(" ");
      const prev = phraseCounts.get(key) || { count: 0, req: false };
      phraseCounts.set(key, { count: prev.count + 1, req: prev.req || inRequirements || bullet });
    }
    }
  }
  for (const [phrase, { count, req }] of phraseCounts) {
    if (count < 2 && !(req && phrase.split(" ").length === 2)) continue;
    if (NOT_A_SKILL.test(phrase)) continue;
    if ([...found.keys()].some(k => k.includes(phrase))) continue;
    add(phrase, "phrase", 1.2 + Math.min(count - 1, 3) * 0.4, req ? 1.4 : 1);
  }
  const all = [...found.values()].map(k => ({ ...k, weight: Math.round((k.weight + Math.min(k.count - 1, 3) * 0.5) * 10) / 10 }));
  // Longer phrases that repeat a shorter selected phrase add noise; keep the most specific few.
  all.sort((a, b) => b.weight - a.weight || b.term.length - a.term.length || a.term.localeCompare(b.term));
  const picked: Keyword[] = [];
  let phrases = 0;
  for (const k of all) {
    if (k.kind === "phrase") {
      if (phrases >= 12 || picked.some(p => p.kind === "phrase" && (p.term.includes(k.term) || k.term.includes(p.term)))) continue;
      phrases++;
    }
    picked.push({ term: k.term, weight: k.weight, kind: k.kind });
    if (picked.length >= (opts.limit ?? 30)) break;
  }
  return picked;
}

export function atsScore(resume: string, description: string, opts: { company?: string } = {}) {
  const terms = extractJobKeywords(description, opts);
  const matched = terms.filter(k => hasTerm(resume, k.term));
  const missing = terms.filter(k => !hasTerm(resume, k.term));
  const total = terms.reduce((n, k) => n + k.weight, 0);
  const got = matched.reduce((n, k) => n + k.weight, 0);
  return { score: total ? Math.round(100 * got / total) : 0,
    matched: matched.map(k => k.term), missing: missing.map(k => k.term), keywords: terms, total: terms.length,
    note: terms.length ? null : "Not enough skill detail in this source posting to calculate an ATS match." };
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

// ---------- Resume structure ----------
export type LineKind = "blank" | "heading" | "bullet" | "summary" | "skills" | "fixed";
export type ResumeLine = { index: number; text: string; section: string; kind: LineKind };
const HEADING_WORDS = /^(summary|professional summary|profile|about( me)?|objective|experience|work experience|professional experience|employment( history)?|projects?|selected projects|skills|technical skills|core skills|technologies|tools|skills (and|&) tools|education|certifications?|awards|publications|volunteer(ing)?|languages|interests|leadership)\s*:?$/i;
export const BULLET = /^\s*[-•*·▪◦]\s+/;
export function sectionType(section: string): "summary" | "skills" | "other" {
  if (/summary|profile|about|objective/i.test(section)) return "summary";
  if (/skill|technolog|tools|stack|competenc/i.test(section)) return "skills";
  return "other";
}
/** Splits a resume into sections and classifies which lines may be rewritten. */
export function parseResume(text: string): ResumeLine[] {
  let section = "Header";
  return text.replace(/\r/g, "").split("\n").map((line, index) => {
    const t = line.trim();
    if (!t) return { index, text: line, section, kind: "blank" as const };
    const isHeading = !BULLET.test(t) && t.length <= 40 && (HEADING_WORDS.test(t) || (/^[A-Z][A-Z &/]{3,}:?$/.test(t) && index > 0));
    if (isHeading) { section = t.replace(/:$/, ""); return { index, text: line, section, kind: "heading" as const }; }
    if (section === "Header") return { index, text: line, section, kind: "fixed" as const };
    const type = sectionType(section);
    if (type === "skills" && /[,;|·]/.test(t)) return { index, text: line, section, kind: "skills" as const };
    if (BULLET.test(t)) return { index, text: line, section, kind: "bullet" as const };
    if (type === "summary") return { index, text: line, section, kind: "summary" as const };
    return { index, text: line, section, kind: "fixed" as const };
  });
}
function splitSkills(line: string) {
  const marker = line.match(BULLET)?.[0] || "";
  const body = line.slice(marker.length);
  const label = body.match(/^[^,;|·]{1,40}:\s*/)?.[0] || "";
  const list = body.slice(label.length);
  const sep = list.match(/\s*[,;|·]\s*/)?.[0] || ", ";
  return { prefix: marker + label, items: list.split(/\s*[,;|·]\s*/).map(s => s.trim()).filter(Boolean), sep };
}
/** Reorders a skills line so job-relevant skills lead. Never adds or removes an item. */
export function reorderSkills(line: string, jobTerms: string[]) {
  const { prefix, items, sep } = splitSkills(line);
  const relevant = (item: string) => jobTerms.some(t => hasTerm(item, t) || hasTerm(t, item));
  const sorted = [...items.filter(relevant), ...items.filter(i => !relevant(i))];
  return prefix + sorted.join(sep.includes(",") ? ", " : sep);
}
export function sameSkills(a: string, b: string) {
  const x = splitSkills(a), y = splitSkills(b);
  const norm = (v: string[]) => v.map(s => s.toLowerCase()).sort().join("\u0000");
  return x.prefix.trim() === y.prefix.trim() && norm(x.items) === norm(y.items);
}

// ---------- Fact lock ----------
// Achievement verbs are facts. Verbs inside one group are stylistic synonyms; changing to a
// different group ("reduced" → "increased", "maintained" → "built") changes the claim.
export const ACTION_GROUPS: string[][] = [
  ["reduced", "decreased", "cut", "lowered", "trimmed", "shrank"],
  ["increased", "grew", "raised", "boosted", "expanded"],
  ["improved", "enhanced", "optimized", "sped"],
  ["built", "developed", "created", "engineered", "implemented"],
  ["shipped", "launched", "delivered", "released"],
  ["designed", "architected"],
  ["led", "headed", "directed", "ran"],
  ["managed", "oversaw", "owned"],
  ["mentored", "coached", "trained"],
  ["maintained", "supported"],
  ["migrated", "moved", "ported"],
  ["automated"], ["saved"], ["wrote", "authored"],
];
const ACTION_WORDS = ACTION_GROUPS.flat();
// Stock phrasing the humanizer removes is style, not a fact.
const STYLE_WORDS = "results-driven passionate dynamic seamless seamlessly leveraged leveraging leverage utilized utilizing utilize spearheaded spearheading cutting-edge robust reliable innovative successfully effectively efficiently significantly actively consistently highly extremely truly meticulous meticulously orchestrated coordinated synergy synergies world-class best-in-class state-of-the-art modern focused responsible approximately";
const stop = new Set(("the a an and or for from with into that this through which used using have has over under to of by in on at as was were is are be it we our your new more less their them his her its across each per while helped worked made added " + ACTION_WORDS.join(" ") + " " + STYLE_WORDS).split(" "));
function contentWords(text: string) { return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g) || []).filter(w => !stop.has(w)); }
function anchors(text: string) {
  const normalized = text.replace(/(\d)\s*percent\b/gi, "$1%");
  return (normalized.match(/(?:[$€£~]?\d[\d,.]*[%kKmMxX+]?|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b)/g) || [])
    .map(s => s.toLowerCase().replace(/^~/, "").replace(/[.,]$/, ""));
}
const wordRe = (w: string) => new RegExp(`\\b${w}\\b`, "i");
export function factLock(original: string, rewritten: string, fullResume: string, confirmedSkills: string[] = [], jobTerms: string[] = []) {
  const reasons: string[] = [];
  const before = anchors(original), after = anchors(rewritten);
  if (before.some(x => !after.includes(x))) reasons.push("A number, date or metric from the original is missing or changed.");
  if (after.some(x => !before.includes(x))) reasons.push("A new number, date or metric was added.");
  const lost = ACTION_GROUPS.filter(g => g.some(v => wordRe(v).test(original)) && !g.some(v => wordRe(v).test(rewritten)));
  if (lost.length) reasons.push(`Achievement action changed or removed: ${lost.map(g => g.find(v => wordRe(v).test(original))).join(", ")}.`);
  const gained = ACTION_GROUPS.filter(g => !g.some(v => wordRe(v).test(original)) && g.some(v => wordRe(v).test(rewritten)));
  if (gained.length) reasons.push(`New achievement claim added: ${gained.map(g => g.find(v => wordRe(v).test(rewritten))).join(", ")}.`);
  const body = original.replace(BULLET, "").trim();
  // Capitalized words that open a sentence are not names ("Results-driven engineer…").
  const properNames = [...body.matchAll(/\b[A-Z][A-Za-z0-9+.]{2,}\b/g)]
    .filter(m => m.index! > 0 && !/[.!?]\s*$/.test(body.slice(0, m.index)) && !ACTION_WORDS.includes(m[0].toLowerCase()))
    .map(m => m[0]);
  if (properNames.some(name => !rewritten.toLowerCase().includes(name.toLowerCase().replace(/\.$/, "")))) reasons.push("A named entity or proper noun from the original was removed.");
  const vocabulary = [...new Set([...SKILLS, ...jobTerms])];
  const allowed = (term: string) => hasTerm(fullResume, term) || confirmedSkills.some(c => c.toLowerCase() === term.toLowerCase());
  const newSkills = vocabulary.filter(t => hasTerm(rewritten, t) && !hasTerm(original, t) && !allowed(t));
  if (newSkills.length) reasons.push(`Unverified skill added: ${newSkills.join(", ")}. Confirm it before adding.`);
  const droppedSkills = vocabulary.filter(t => hasTerm(original, t) && !hasTerm(rewritten, t));
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
export const VERIFIED_HEADING = "VERIFIED ADDITIONAL SKILLS";
export function validateFinalResume(original: string, final: string, confirmedSkills: string[] = [], jobTerms: string[] = []) {
  const parsed = parseResume(original);
  const a = parsed.map(l => l.text), b = final.replace(/\r/g, "").split("\n");
  const extras = confirmedSkills.length ? ["", VERIFIED_HEADING, confirmedSkills.join(", ")] : [];
  if (b.length !== a.length + extras.length || (extras.length && b.slice(a.length).join("\n") !== extras.join("\n")))
    return { safe: false, reasons: ["Only bullets, summary sentences, skill order and explicitly confirmed skills can change. Keep all original sections and lines."] };
  const reasons: string[] = [];
  for (const line of parsed) {
    const next = b[line.index];
    if (line.text === next) continue;
    const n = line.index + 1;
    if (line.kind === "skills") { if (!sameSkills(line.text, next)) reasons.push(`Line ${n}: skills can be reordered, not added, removed or renamed.`); continue; }
    if (line.kind === "bullet" && !BULLET.test(next)) { reasons.push(`Line ${n}: bullet marker removed.`); continue; }
    if (line.kind !== "bullet" && line.kind !== "summary") { reasons.push(`Line ${n}: a fact outside a bullet or summary was changed (employer, title, dates or heading).`); continue; }
    reasons.push(...factLock(line.text, next, original, confirmedSkills, jobTerms).reasons.map(r => `Line ${n}: ${r}`));
  }
  return { safe: reasons.length === 0, reasons };
}

/** Word-level diff for the before/after review UI. */
export function wordDiff(before: string, after: string): Array<{ type: "same" | "del" | "add"; text: string }> {
  const a = before.split(/(\s+)/), b = after.split(/(\s+)/);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Array<{ type: "same" | "del" | "add"; text: string }> = [];
  const push = (type: "same" | "del" | "add", text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text; else out.push({ type, text });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push("same", a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", a[i++]);
    else push("add", b[j++]);
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return out;
}
