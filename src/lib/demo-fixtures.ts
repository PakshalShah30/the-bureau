/**
 * Offline preview ONLY. Posting metadata and quoted description excerpts were checked against
 * the linked first-party APIs / HN API on 2026-09-23. These are NOT described as live.
 * Production seed contains NO job fixtures; it fetches current postings from the boards.
 */
import type { Application, Company, Job, Resume, UserRecord, AtsType, JobSource, Workplace } from "./types";
import { jobKey } from "./urls";
import { resolveSponsorship } from "./sponsorship";
import { sampleFilings } from "./h1b-sample";

const checked = "2026-09-23T20:00:00.000Z";
type Row = [string, AtsType, string, string?, string?, string?, number?, string?];
const companies: Row[] = [
  ["Figma", "GREENHOUSE", "figma", undefined, undefined, "Design"],
  ["Stripe", "GREENHOUSE", "stripe", undefined, undefined, "Fintech"],
  ["Legion Health", "ASHBY", "legionhealth", "S21", "legion-health", "Healthcare"],
  ["PostHog", "ASHBY", "posthog", "W20", "posthog", "Developer Tools"],
  ["Airbyte", "ASHBY", "airbyte", "W20", "airbyte", "Developer Tools"],
  ["Orpex", "ASHBY", "orpex", undefined, undefined, "AI"],
  ["8090", "ASHBY", "8090 Solutions Inc", undefined, undefined, "Software"],
  ["Lean Layer", "ASHBY", "leanlayer", undefined, undefined, "B2B"],
  ["Level AI", "LEVER", "levelai", undefined, undefined, "AI"],
  ["Modash", "WORKABLE", "modash", undefined, undefined, "Creator Economy", 85],
];
export const demoCompanies: Company[] = companies.map(([name, atsType, slug, batch, ycSlug, industry, size]) => ({
  id: `co-${slug.toLowerCase().replace(/\W/g, "-")}`, userId: "demo", name, atsType, boardSlug: slug,
  careersUrl: atsType === "ASHBY" ? `https://jobs.ashbyhq.com/${encodeURIComponent(slug)}` : atsType === "LEVER" ? `https://jobs.lever.co/${slug}` : atsType === "WORKABLE" ? `https://apply.workable.com/${slug}/` : `https://job-boards.greenhouse.io/${slug}`,
  website: null, ycBatch: batch || null, ycUrl: ycSlug ? `https://www.ycombinator.com/companies/${ycSlug}` : null,
  industry: industry || null, teamSize: size || null, employerOverride: null,
  active: true, createdAt: checked, lastFetchedAt: checked, lastError: null,
}));

type JobFixture = {
  company: string; title: string; externalId: string; url: string; postedAt: string;
  location: string; workplace: Workplace; department: string; description: string;
  source?: JobSource; hnUrl?: string;
};
const fixtures: JobFixture[] = [
  { company: "PostHog", title: "Technical Customer Success Manager - EMEA", externalId: "0be1b52c-2401-4ae2-b7fc-5d018c1ff96f",
    url: "https://jobs.ashbyhq.com/posthog/0be1b52c-2401-4ae2-b7fc-5d018c1ff96f", postedAt: "2026-09-18T08:41:19.683Z", location: "Remote (EMEA)", workplace: "REMOTE", department: "Sales & Customer Success",
    description: "PostHog makes products self-driving. It's the only platform that acts like a co-pilot for you (and your AI agents) to do it all – autonomously.\n\nA customer-obsessed person to take care of a large number of our larger customers. You’ll engage with them regularly to ensure their continued retention and growth.\n\nTechnically capable. You don't need to be an engineer, but you should be comfortable working with code. You troubleshoot issues customers run into (and sometimes even raise PRs yourself to fix bugs)." },
  { company: "Orpex", title: "Founding Engineer", externalId: "229f9a36-53cd-498d-809e-77142e9d48c1",
    url: "https://jobs.ashbyhq.com/orpex/229f9a36-53cd-498d-809e-77142e9d48c1", postedAt: "2026-09-12T19:09:31.743Z", location: "San Francisco", workplace: "ONSITE", department: "Engineering",
    description: "The next generation of service companies won't scale through headcount. They'll be built by tiny teams orchestrating AI workforces with 1000x the output.\n\nApplied LLMs. You've shipped production agent systems: orchestration, tool calling, long-running tasks, evals. Opinions earned through pain, not blog posts.\n\nProven builder. Track record of fast, production-grade shipping across the full stack (TypeScript/Python, modern infra).\n\nSan Francisco in person - Visa sponsorship possible" },
  { company: "Orpex", title: "Founding Engineer (m/w/d) - Vienna", externalId: "ce5fd6cb-3450-4971-acfb-73750dc0c1d1",
    url: "https://jobs.ashbyhq.com/orpex/ce5fd6cb-3450-4971-acfb-73750dc0c1d1", postedAt: "2026-09-12T19:26:54.403Z", location: "Vienna", workplace: "HYBRID", department: "Engineering",
    description: "Founding Engineer. Du bist der erste Hire und hast die Chance das gesamte technische Fundament von Orpex aufzubauen, du wählst den Stack und setzt den Standard für alle.\n\nRelocation nach San Francisco. Umzug und Visa Sponsorship übernehmen wir vollständig." },
  { company: "Figma", title: "Account Executive, Mid-Market, Mandarin Speaking (Singapore)", externalId: "6161021004",
    url: "https://boards.greenhouse.io/figma/jobs/6161021004?gh_jid=6161021004", postedAt: "2026-09-08T04:37:26-04:00", location: "Singapore", workplace: "UNSPECIFIED", department: "Sales",
    description: "" },
  { company: "Modash", title: "Senior Product Data Engineer (remote, Europe)", externalId: "97D6FCDD7B",
    url: "https://apply.workable.com/j/97D6FCDD7B", postedAt: "2026-09-08", location: "Tallinn, Estonia", workplace: "REMOTE", department: "Data",
    description: "" },
  { company: "Stripe", title: "Software Engineer, New Grad - Frontend", externalId: "8130927",
    url: "https://job-boards.greenhouse.io/stripe/jobs/8130927", postedAt: "2026-08-31T22:51:48.632Z", location: "Barcelona", workplace: "UNSPECIFIED", department: "University",
    description: "Experience and familiarity with programming, either through side projects or classwork. We work mostly in Java, Ruby, JavaScript, Scala, and Go. We believe new programming languages can be learned if the fundamentals and general knowledge are present.\n\nClear written communication skills, with the ability to explain your work to stakeholders, team members, and other Stripes." },
  { company: "8090", title: "Full Stack Engineer", externalId: "0cd9781c-e158-4b0c-9979-04ead270933a",
    url: "https://jobs.ashbyhq.com/8090%20Solutions%20Inc/0cd9781c-e158-4b0c-9979-04ead270933a", postedAt: "2026-05-04T21:30:16.461Z", location: "Redwood City", workplace: "ONSITE", department: "Engineering",
    description: "Expertise in and extensive professional experience with full-stack web development is a must we use Python, Typescript, React, Data Structures, and AWS.\n\nVisa Information - We do not provide new work visa sponsorship.\n\nThis position is only open to candidates who are citizens, permanent residents or are transferring an existing H-1B, O-1, L-1, H4 EAD or TN Visa." },
  { company: "Airbyte", title: "Customer Support Developer (Databases)", externalId: "99c417bc-a996-4265-9401-f967b3076c9f",
    url: "https://jobs.ashbyhq.com/airbyte/99c417bc-a996-4265-9401-f967b3076c9f", postedAt: "2026-04-27T17:14:00.440Z", location: "United States", workplace: "REMOTE", department: "Technical Support",
    description: "As a Customer Support Developer (Databases) at Airbyte, you'll combine hands-on development skills with deep technical empathy to support our growing cloud, embedded, and open-source integration platform.\n\nYou'll be writing Java and Kotlin, shipping contributions to our open-source database source and destination connectors, digging into query plans and transaction logs.\n\nFluency in SQL, with hands-on experience investigating query plans, isolation levels, and performance bottlenecks." },
  { company: "Lean Layer", title: "RevOps Analytics Engineer", externalId: "395cb6c6-5bdb-41da-add0-b5de20c39c04",
    url: "https://jobs.ashbyhq.com/leanlayer/395cb6c6-5bdb-41da-add0-b5de20c39c04", postedAt: "2026-03-19T15:27:11.660Z", location: "United States", workplace: "REMOTE", department: "Technical Consultant",
    description: "We are looking for a RevOps Analytics Engineer with deep Revenue Operations expertise to own and maintain the data infrastructure that powers revenue analytics and reporting across our client environments.\n\nStrong SQL skills. Experience working with data warehouses (BigQuery, Snowflake, Redshift, etc.).\n\nVisa Sponsorship: Please note that we are not currently able to offer U.S. visa sponsorship or transfer for this position." },
  { company: "Level AI", title: "Software Engineer 2026", externalId: "97951083-5465-4382-bb4d-ac9d89458a21",
    url: "https://jobs.lever.co/levelai/97951083-5465-4382-bb4d-ac9d89458a21", postedAt: "2026-02-10", location: "Noida", workplace: "HYBRID", department: "Engineering",
    description: "" },
  { company: "Legion Health", title: "Consumer AI Lifecycle Product and Marketing Lead (backed by Y Combinator, $5M+ ARR, $23M+ raised)", externalId: "3a007cb1-faad-4854-a847-e4b77eaf3a42",
    url: "https://jobs.ashbyhq.com/legionhealth/3a007cb1-faad-4854-a847-e4b77eaf3a42", postedAt: "2026-01-02T02:51:12.062Z", location: "San Francisco", workplace: "ONSITE", department: "Growth",
    description: "Legion is building autonomous medical care (the AI doctor), starting with psychiatry.\n\nJob Type: Full-Time. Role Type: Lifecycle Marketing / CRM / AI-Native Patient Engagement / Retention / Growth. Location: In-Person in San Francisco, CA. US Visa Sponsorship: Yes.\n\nBuild Legion’s AI-native lifecycle engine across activation, booking, visit completion, follow-up adherence, medication renewal support, retention, reactivation, and winback." },
  { company: "Modash", title: "Senior Product Engineer", externalId: "49522903",
    url: "https://apply.workable.com/modash/j/C1507B65C3", postedAt: "2026-09-01T15:01:54.000Z", location: "Remote (Europe)", workplace: "REMOTE", department: "Engineering", source: "HN_HIRING", hnUrl: "https://news.ycombinator.com/item?id=49522903",
    description: "Modash.io | Senior Product Engineer | Remote (Europe) | Full-time | €75k–110k\n\nWe're looking for Senior Product Engineers who like owning ambiguous problems end-to-end. No perfectly shaped tickets. You talk to customers, understand messy workflows, make product decisions, ship, and own whether it actually works.\n\nEngineering is fully remote across Europe. Apply: https://apply.workable.com/modash/j/C1507B65C3" },
];
export const demoJobs: Job[] = fixtures.map(row => {
  const co = demoCompanies.find(c => c.name === row.company)!;
  const signal = resolveSponsorship(row.description, sampleFilings(), co.name);
  return { id: `job-${row.externalId}`, userId: "demo", companyId: co.id, companyName: co.name,
    title: row.title, source: row.source || (co.ycBatch ? "YC_STARTUP" : "COMPANY_BOARD"),
    atsType: co.atsType, externalId: row.externalId, originalUrl: row.url, canonicalKey: jobKey(row.url),
    sourceUrl: row.hnUrl ? "https://news.ycombinator.com/item?id=49522897" : co.ycUrl || co.careersUrl, hnUrl: row.hnUrl || null,
    description: row.description, department: row.department, location: row.location, workplace: row.workplace,
    ycBatch: co.ycBatch, companySize: co.teamSize, postedAt: new Date(row.postedAt).toISOString(),
    firstSeenAt: checked, lastSeenAt: checked, closedAt: null, snapshotAt: checked,
    sponsorship: signal.status, sponsorshipEvidence: signal.evidence, evidenceSource: signal.evidenceSource };
});
export const demoUser: UserRecord = { id: "demo", email: "demo@thebureau.app", name: "Alex Morgan", passwordHash: null,
  lastVisitedAt: "2026-09-16T12:00:00.000Z", humanizationIntensity: "MEDIUM", humanizerKey: null, detectorKey: null, humanizerUrl: null, detectorUrl: null };
export const demoResumes: Resume[] = [{ id: "resume-demo", userId: "demo", name: "Alex Morgan · Product Engineer", filename: "alex-morgan-resume.txt",
  mimeType: "text/plain", content: `ALEX MORGAN\nSan Francisco, CA | alex@example.com | linkedin.com/in/alexmorgan\n\nSUMMARY\nProduct engineer with 6 years building tools for growing teams. Comfortable moving from customer conversations to production code.\n\nEXPERIENCE\nSenior Software Engineer | Northstar Labs | Jan 2022 – Present\n• Built a React and TypeScript dashboard used by 12,000 customers; reduced page load time by 38%.\n• Designed PostgreSQL reporting queries and Node.js APIs for the analytics team.\n• Mentored 3 engineers and shipped a new onboarding flow that improved activation by 19%.\n\nSoftware Engineer | Fern Studio | Jun 2019 – Dec 2021\n• Developed GraphQL services in Node.js and TypeScript for the customer-facing product.\n• Worked with designers to improve accessibility across 8 product screens.\n\nSKILLS\nTypeScript, React, Node.js, PostgreSQL, GraphQL, Python, SQL, AWS, Git\n\nEDUCATION\nB.S. Computer Science | University of Washington | 2019`,
  version: 1, parentId: null, jobId: null, atsScore: null, aiLikelihood: null, createdAt: checked }];
const stages = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;
const appJobs = ["Airbyte", "PostHog", "Orpex", "Stripe", "Lean Layer"];
export const demoApplications: Application[] = stages.map((status, i) => {
  const job = demoJobs.find(j => j.companyName === appJobs[i])!;
  return { id: `app-${i + 1}`, userId: "demo", jobId: job.id, title: job.title, companyName: job.companyName,
    status, appliedAt: status === "SAVED" ? null : `2026-09-${String(12 - i * 2).padStart(2, "0")}T10:00:00.000Z`,
    followUpAt: i === 1 ? "2026-09-26T09:00:00.000Z" : i === 2 ? "2026-09-29T09:00:00.000Z" : null,
    resumeId: i === 0 ? null : "resume-demo", notes: i === 2 ? "Prepare questions about the engineering team." : "",
    createdAt: checked, updatedAt: checked };
});
