import { normalizeEmployer } from "./sponsorship";

type RoleLike = { companyName: string; title: string; location: string | null };
const PLACE_WORDS = new Set("remote hybrid onsite on site office us usa united states uk eu europe emea apac americas north america global worldwide anywhere timezone time zone est pst cet utc only".split(" "));
export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\b[mfwd](?:\/[mfwd]){1,3}\b/g, " ")
    .replace(/\bsr\b\.?/g, "senior").replace(/\bjr\b\.?/g, "junior").replace(/\beng\b\.?/g, "engineer").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function placeWords(location: string | null) { return new Set((location || "").toLowerCase().match(/[a-z]{2,}/g) || []); }
/** Same title, or one title is the other plus only a location/workplace suffix ("Engineer - Vienna"). */
export function sameTitle(a: RoleLike, b: RoleLike) {
  const x = normalizeTitle(a.title), y = normalizeTitle(b.title);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  if (!long.startsWith(short + " ")) return false;
  const places = new Set([...placeWords(a.location), ...placeWords(b.location), ...PLACE_WORDS]);
  return long.slice(short.length).trim().split(" ").every(w => places.has(w));
}
export function sameCompany(a: string, b: string) {
  const x = normalizeEmployer(a), y = normalizeEmployer(b);
  return !!x && x === y;
}
function locationsOverlap(a: string | null, b: string | null) {
  if (!a || !b) return true;
  const x = placeWords(a), y = placeWords(b);
  return [...x].some(w => y.has(w) && w.length > 2);
}
/**
 * Finds the one job describing the same role at the same company. Returns null when zero or
 * several candidates match (a board can list one title in many locations): never guess.
 */
export function pickSameRole<T extends RoleLike>(input: RoleLike, candidates: T[]): T | null {
  const matches = candidates.filter(c => sameCompany(c.companyName, input.companyName) && sameTitle(c, input));
  if (matches.length === 1) return matches[0];
  const narrowed = matches.filter(c => locationsOverlap(c.location, input.location));
  return narrowed.length === 1 ? narrowed[0] : null;
}
export function companySearchToken(name: string) { return normalizeEmployer(name).split(" ").find(w => w.length >= 2) || ""; }
type SponsorFields = { sponsorship: string; sponsorshipEvidence: string | null; evidenceSource: string | null };
const stated = (s: string) => s === "SPONSORS_STATED" || s === "NO_SPONSORSHIP_STATED";
/** When a board posting and an HN post merge, a policy stated in either one wins over history. */
export function mergedSponsorship<T extends SponsorFields>(board: T, hn: SponsorFields): SponsorFields | null {
  if (stated(board.sponsorship) || !stated(hn.sponsorship)) return null;
  return { sponsorship: hn.sponsorship, sponsorshipEvidence: hn.sponsorshipEvidence,
    evidenceSource: hn.evidenceSource?.startsWith("HN") ? hn.evidenceSource : "HN Who is Hiring post" };
}
