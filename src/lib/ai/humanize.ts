import type { Intensity } from "../types";
import { BULLET, hasTerm } from "./ats";

// Deterministic, fact-preserving humanizer. It never touches numbers, names or tools: it
// removes stock AI phrasing, trims filler, and varies bullet openers only with verbs that
// the fact-lock treats as synonyms (see ACTION_GROUPS in ./ats).
const CLICHES: Array<[RegExp, string]> = [
  [/\bspearheaded\b/gi, "led"], [/\bspearheading\b/gi, "leading"],
  // Keep the verb form: leveraged → used, leveraging → using, leverages → uses.
  [/\b(?:leveraged|utilized)\b/gi, "used"], [/\b(?:leveraging|utilizing)\b/gi, "using"], [/\b(?:leverages|utilizes)\b/gi, "uses"], [/\b(?:leverage|utilize)\b/gi, "use"],
  [/\borchestrated\b/gi, "coordinated"], [/\bseamless(ly)?\s+/gi, ""], [/\bdynamic\s+/gi, ""], [/\bresults[- ]driven\s+/gi, ""],
  [/\bpassionate about\b/gi, "focused on"], [/\bcutting[- ]edge\b/gi, "modern"], [/\bstate[- ]of[- ]the[- ]art\b/gi, "modern"],
  [/\bbest[- ]in[- ]class\s+/gi, ""], [/\bworld[- ]class\s+/gi, ""], [/\bsynerg(y|ies)\b/gi, "collaboration"],
  [/\bin order to\b/gi, "to"], [/\ba (wide )?(range|variety) of\b/gi, "many"], [/\bfostered\b/gi, "built up"],
  [/\bplayed a (key|pivotal|crucial) role in\b/gi, "helped with"], [/\b(a )?testament to\b/gi, "evidence of"],
  [/\bmeticulous(ly)?\s+/gi, ""], [/\brobust\b/gi, "reliable"], [/\bdelve(d)? into\b/gi, "dug into"],
];
const FILLER_MEDIUM = /\b(successfully|effectively|efficiently)\s+/gi;
const FILLER_STRONG = /\b(significantly|actively|consistently|highly|extremely|truly|very)\s+/gi;
// Opener alternatives, each within one ACTION_GROUPS group so meaning and fact-lock are kept.
const OPENERS: Record<string, string[]> = {
  built: ["Developed", "Created", "Engineered"], developed: ["Built", "Created", "Engineered"], created: ["Built", "Developed"],
  implemented: ["Built", "Developed"], engineered: ["Built", "Developed"],
  reduced: ["Cut", "Lowered", "Decreased"], cut: ["Reduced", "Lowered"], lowered: ["Reduced", "Cut"], decreased: ["Reduced", "Cut"],
  increased: ["Grew", "Boosted", "Raised"], grew: ["Increased", "Expanded"], boosted: ["Increased", "Raised"],
  improved: ["Enhanced", "Optimized"], optimized: ["Improved", "Enhanced"], enhanced: ["Improved"],
  shipped: ["Launched", "Delivered", "Released"], launched: ["Shipped", "Delivered"], delivered: ["Shipped", "Launched"], released: ["Shipped"],
  designed: ["Architected"], architected: ["Designed"],
  led: ["Headed", "Directed", "Ran"], headed: ["Led"], directed: ["Led", "Ran"], ran: ["Led"],
  managed: ["Oversaw", "Owned"], oversaw: ["Managed"], owned: ["Managed"],
  mentored: ["Coached", "Trained"], coached: ["Mentored"], trained: ["Coached"],
  maintained: ["Supported"], supported: ["Maintained"], migrated: ["Moved", "Ported"], wrote: ["Authored"], authored: ["Wrote"],
};
function matchCase(word: string, like: string) { return !word ? "" : like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word.toLowerCase(); }
export function opener(line: string) { return line.replace(BULLET, "").trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") || ""; }

export type HumanizeOptions = { intensity?: Intensity; avoidOpeners?: string[]; variant?: number; keepTerms?: string[] };
export function builtInHumanize(text: string, opts: HumanizeOptions = {}) {
  const intensity = opts.intensity || "MEDIUM";
  const marker = text.match(BULLET)?.[0] || "";
  let body = text.slice(marker.length);
  for (const [re, to] of CLICHES) body = body.replace(re, m => matchCase(to, m));
  if (intensity !== "LIGHT") body = body.replace(FILLER_MEDIUM, "");
  if (intensity === "STRONG") {
    // Resume shorthand: tighter wording, symbols where they read naturally.
    body = body.replace(FILLER_STRONG, "").replace(/\b(\d+(?:\.\d+)?)\s*percent\b/gi, "$1%")
      .replace(/\bapproximately\s+/gi, "~").replace(/\bfor example\b/gi, "e.g.").replace(/\bas well as\b/gi, "and")
      .replace(/\bwas responsible for\s+/gi, "").replace(/\bresponsible for\s+/gi, "");
  }
  body = body.replace(/\s{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  if (body) body = body[0].toUpperCase() + body.slice(1);
  const first = opener(body);
  if (intensity !== "LIGHT" && first && opts.avoidOpeners?.includes(first) && OPENERS[first]) {
    // Synonyms of synonyms widen the rotation so each re-humanize attempt reads differently.
    const pool = [...new Set([...OPENERS[first], ...OPENERS[first].flatMap(c => OPENERS[c.toLowerCase()] || [])])];
    const choices = pool.filter(c => c.toLowerCase() !== first && !opts.avoidOpeners!.includes(c.toLowerCase()));
    if (choices.length) body = body.replace(/^\S+/, choices[(opts.variant || 0) % choices.length]);
  }
  const result = marker + body;
  // Never let humanizing drop a job keyword the proposal already contained.
  if (opts.keepTerms?.some(t => hasTerm(text, t) && !hasTerm(result, t))) return text;
  return result;
}
/** Cross-line pass: bullets in one section should not all open with the same verb. */
export function varyOpeners(lines: string[], intensity: Intensity = "MEDIUM") {
  if (intensity === "LIGHT") return lines;
  const used: string[] = [];
  return lines.map((line, i) => {
    const next = builtInHumanize(line, { intensity, avoidOpeners: used, variant: i });
    used.push(opener(next));
    return next;
  });
}
