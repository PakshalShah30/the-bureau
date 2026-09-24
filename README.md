# The Bureau

A personal, first-party job-search workspace built with Next.js App Router, TypeScript, Tailwind CSS, Auth.js and PostgreSQL/Prisma. Track official career boards, organize applications and resumes, and assess H-1B evidence without treating past filings as a promise. The UI supports light and dark themes and mobile layouts.

> **Source policy:** Job postings come only from a company's own Greenhouse, Lever, Ashby or Workable board, a company board discovered via Y Combinator's own directory, or a direct company-apply link in the monthly HN “Who is hiring?” thread. No LinkedIn, Indeed, Glassdoor, ZipRecruiter, YC third-party job mirrors, invented job fixtures in PostgreSQL, or third-party search results. Original company URLs and HN comment URLs are retained. Postings are not employer endorsements.

## Requirements

- Node.js 20.9+ (Node 22 recommended), npm, PostgreSQL 14+ and internet access to the selected ATS/YC/HN sources.
- For AI rewrite suggestions, an optional OpenAI-compatible JSON chat-completions API key. ATS matching, built-in humanization and heuristic detector work without one.
- For actual H-1B history, locally downloaded **official** DOL/USCIS public disclosure files. No filing rows are invented for the preview.

## Try the dated preview (without PostgreSQL)

```bash
npm ci
cp .env.example .env.local
# In .env.local, set DEMO_MODE="true", NEXT_PUBLIC_DEMO_MODE="true",
# and a fresh AUTH_SECRET (e.g. `openssl rand -base64 48`).
npm run dev
```

Visit `http://localhost:3000`, choose **Explore the demo**, or sign in with `demo@thebureau.app` / `demo1234`. The local preview persists in ignored `.data/demo.json`. Delete only this file to reset the preview. Its 12 job examples are **dated source-checked snapshots from September 23, 2026**, not live postings; their descriptions are *excerpts*. Each shows a **Snapshot · Sep 23, 2026** badge, and its detail page warns that the role may have closed. A successful live refresh replaces the snapshot and removes the badge. The five sample applications and sample resume are fictional personal activity, not invented job listings. Refreshing can replace snapshots with live board data when outbound access is available. If a board cannot be reached, the refresh reports an error and keeps its existing jobs; it does **not** silently substitute fabricated postings.

**Never expose demo mode or the known demo credentials on a public deployment.** Demo mode deliberately uses local JSON instead of PostgreSQL, so it is not multi-instance durable. Do not assume a snapshot role remains open; always follow the original company URL. AI scores on excerpts are illustrative only.

For an Arena browser preview, start the server with a public `AUTH_URL` matching the proxied origin, e.g. `AUTH_URL="https://3000-${E2B_SANDBOX_ID}.e2b.app"` as well as the demo variables. The server binds to `0.0.0.0`; the browser uses relative `/api/*` URLs, never localhost.

## Production / PostgreSQL setup

1. Create an empty PostgreSQL database. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, a unique unpredictable `AUTH_SECRET`, `AUTH_URL` to your **public HTTPS origin**, and a separate `CRON_SECRET` of at least 24 random characters. Leave `DEMO_MODE` and `NEXT_PUBLIC_DEMO_MODE` **false**. Protect the env file; rotate `AUTH_SECRET` carefully, since user-supplied provider keys are encrypted with a key derived from it.
2. Install, generate the Prisma client and apply the initial migration:
   ```bash
   npm ci
   npm run db:generate
   npm run db:migrate
   npm run dev
   ```
   For deployment, run `npm run build && npm start` after migration. The checked-in SQL lives in `prisma/migrations/20260923000000_init/migration.sql` and is covered by a PostgreSQL-compatible PGlite migration test.
3. Register a personal account at `/login` or optionally enable Google OAuth by setting `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Add `https://YOUR_DOMAIN/api/auth/callback/google` as an authorized Google redirect URI. OAuth is omitted from the UI when not configured. **Credentials are hashed with bcrypt**; sessions use Auth.js JWTs. All jobs, saved roles, applications, companies and resumes are scoped to the signed-in user.
4. Track and test your own official career boards in **Tracked companies**, then **Refresh jobs**. Add a Y Combinator batch (e.g. `W25`) or industry (e.g. `B2B`) and optionally a maximum company size to import the YC directory *in pages of 32*. Only companies whose first-party board is detected on their own website and passes an official ATS test fetch are added. Continue with **Track next page** until complete; narrow filters beyond the directory's 1,000-result query cap.
5. **Demo account in PostgreSQL:** `npm run db:seed` (or `npx prisma db seed`). Outside production it runs directly; with `NODE_ENV=production` it refuses unless `SEED_DEMO=true`, because it creates a known demo password. It tracks 10 verified boards, adds labelled **illustrative sample H-1B rows** (see below) so every sponsorship badge type can appear on first load, attempts a **live** refresh (no job fixtures), and adds one fictional resume plus five fictional applications, one per pipeline stage, linked to real fetched jobs. If sources are unreachable, applications are created unlinked; **re-run the seed after a successful refresh to link them** (it is idempotent). **Do not expose the demo account publicly.**

### Board configuration in the seed

| Company | Company-hosted ATS | Board slug | YC directory batch, if applicable |
|---|---|---|---|
| Figma | Greenhouse | `figma` | — |
| Stripe | Greenhouse | `stripe` | — |
| Legion Health | Ashby | `legionhealth` | S21 |
| PostHog | Ashby | `posthog` | W20 |
| Airbyte | Ashby | `airbyte` | W20 |
| Orpex | Ashby | `orpex` | — |
| 8090 | Ashby | `8090 Solutions Inc` | — |
| Lean Layer | Ashby | `leanlayer` | — |
| Level AI | Lever | `levelai` | — |
| Modash | Workable | `modash` | — |

URLs used by the adapters: `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`, `api.lever.co/v0/postings/{slug}?mode=json`, `api.ashbyhq.com/posting-api/job-board/{slug}`, `apply.workable.com/api/v1/widget/accounts/{slug}?details=true`. YC is read from [its public company directory](https://www.ycombinator.com/companies) / that directory's embedded public Algolia search configuration, **then** each company's own public career site and official ATS. HN's [monthly hiring thread](https://news.ycombinator.com/submitted?id=whoishiring) is located via the HN Algolia search and comments read from the HN Firebase API; only top-level comments with a role-specific first-party company application URL are kept. Workable `details=true` yields full official descriptions. Boards are validated before tracking; a schema change or network failure is reported rather than interpreted as zero jobs.

## Automatic refresh and operations

`vercel.json` calls `GET /api/cron/refresh` **hourly**. Each call refreshes only users whose last refresh is older than ~6 hours, **stalest first**, three at a time, within a ~230 s budget (under the 300 s function limit). Users that don't fit are picked up by the next hourly call, so every user is refreshed about every 6 hours without one long request. Set `CRON_SECRET` in the deployment environment. The endpoint accepts only `Authorization: Bearer <CRON_SECRET>`; in demo mode it returns 400. Vercel plans limit cron frequency (Hobby: daily): on such a platform use an external scheduler with the same endpoint:

```cron
0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/refresh
```

There is also an authenticated **Refresh jobs** button / `POST /api/jobs/refresh` (optional `{ "companyId": "..." }` to refresh one tracked board). Results and individual source errors appear in the feed; a successful board fetch is required before any missing jobs from that board are closed. Failed HN fetches/partial threads do not close HN jobs. Only one refresh per user runs at a time **across all server instances**: a lease stored in `User.refreshLockedUntil` (10 minutes, released when the run finishes, expires on its own if a worker crashes). Cron and on-demand refreshes share it. A one-minute cooldown applies to successful on-demand refreshes.

Listings retain exact original apply URLs, source badges, posted dates when provided (otherwise **Date not published**), and sponsorship evidence. Deduplication has two layers. First, the exact URL, with tracking params stripped but essential identifiers such as Greenhouse `gh_jid` kept. Second, across sources, the same company (legal suffixes ignored) plus the same normalized title (seniority abbreviations, parentheticals and location-only suffixes such as "– Vienna" ignored). An HN post merges into the board posting for that role, and the board posting stays canonical with the HN comment link kept. A policy stated in the HN post (e.g. `VISA: yes`) is kept if the board posting is silent. It never guesses: if a board lists the same title more than once and locations don't narrow it to one, the jobs stay separate (`src/lib/dedupe.ts`). Greenhouse's `updated_at` is *not* misrepresented as a posted date. Every job detail links the exact posting, plus the original HN comment for HN-sourced roles; saved/closed jobs remain accessible.

## Government H-1B evidence (opt-in import)

Download the actual public **LCA disclosure** CSV/CSV.GZ/XLSX from [DOL OFLC performance data](https://www.dol.gov/agencies/eta/foreign-labor/performance) and/or the public employer-level file from [USCIS H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub). Put large downloads in ignored `data/`, **not in Git**. Inspect the header row to ensure it contains the supported FY, employer, status/case number and approval/denial fields; the importer prints accepted-row counts and fails on zero matches.

```bash
npm run h1b:import -- --lca data/LCA_FY2026.xlsx --uscis data/USCIS_FY2026.csv
# Either --lca or --uscis can be used separately. Re-run after each government release.
# Then refresh the jobs feed to recompute badges.
```

The streaming importer accepts `.csv`, `.csv.gz` and `.xlsx`, uses H-1B **certified** LCA records from the most recent three fiscal years, deduplicates LCA case numbers, and upserts USCIS employer/year adjudication totals. DOL hourly/monthly wages are converted to an annual *offered* amount; the median is not a salary guarantee. USCIS totals are adjudications, not workers hired. The app matches conservative normalized employer names, allows a precise legal-filer alias override in company settings, and displays the actual imported titles, worksite, wage (if available), approvals/denials and official source links. A clear **no sponsorship** or **sponsorship available** policy stated in the *job itself* always overrides employer history. If neither a statement nor matching recent filings exists, the status is **Unknown**, never “doesn't sponsor.”

**Illustrative sample rows.** So every badge type is visible before you import government files, the seed (and demo mode) adds a few rows for Stripe, Figma and Airbyte from `src/lib/h1b-sample.ts`. They are **placeholders, not DOL/USCIS data**: each row has `isSample = true`, badges derived from them show a **SAMPLE** tag, and the filing panel shows a "Sample data" notice. A successful `npm run h1b:import` deletes every sample row. Refresh jobs afterwards to recompute badges. If the government file format changes, update `src/lib/h1b.ts` to map the official fields, rather than guessing or synthesizing rows. These indicators are not immigration or legal advice: confirm policy with the employer.

## Resume workflow and providers

Upload a text-based PDF/DOCX (max 5 MB) or paste text, select a job, and request an analysis.

- **ATS keywords come from the job description itself** (`extractJobKeywords` in `src/lib/ai/ats.ts`): known skills; tool names (CamelCase, `.js`, `C++`/`C#`, acronyms, and product names listed in context, e.g. "Kafka, Flink"); and domain phrases that repeat or appear in requirement bullets (e.g. "streaming data pipelines"). Terms in requirements count more. Benefits, visa and immigration wording is ignored, and everyday words that are also language names ("go") match only with exact capitalization. The score is the weighted share of these terms found on your resume, and missing terms are listed as gaps.
- **Section-by-section rewrites.** The resume is split by its headings. Summary sentences and bullets in every section can be rewritten, the skills line is reordered so job-relevant skills come first (never added or removed), and header, role/employer/date and education lines are locked. Suggestions are grouped by section with a word-level before/after diff; accept or reject each line.
- **Humanizer (always on).** An optional `LLM_API_KEY`, `LLM_BASE_URL` (OpenAI-compatible `POST /chat/completions`) and `LLM_MODEL` enable AI rewrites. With or without them, the built-in humanizer runs: it removes stock AI phrasing (keeping verb forms: "leveraging" → "using"), trims filler at Medium, uses resume shorthand at Strong (`~`, `%`, no "responsible for"), and varies repeated bullet openers inside a section using synonyms the fact-lock accepts ("Built" → "Developed"). It reverts any change that would drop an ATS keyword. **Re-humanize** escalates intensity and rotates word choices on each attempt.
- **AI-likelihood** is shown per section and per line, before and after. Lines still at 60% or higher are flagged with a re-humanize button.

Missing skills require a separate explicit confirmation and are never inserted by the model. Every suggested and re-humanized line is checked for changes to numbers/dates, achievement claims (verbs are compared by meaning group: "reduced" ≈ "cut", but "reduced" ≠ "increased"), known and job-specific tools, named entities, negation and claim retention; unsafe lines cannot be accepted or exported. The final version passes another fact-lock and ATS recheck before it is stored and linked to the application. Downloadable DOCX and PDF files are generated from that saved text. The PDF bundles open-licensed Unicode fonts so accented names are not silently stripped; an unsupported glyph produces an explicit error, while DOCX preserves the original text.

The default “AI-likelihood” score is a **simple writing-pattern heuristic**, not a reliable AI detector; neither this score nor the ATS keyword percentage is an ATS vendor score or a guarantee. The lexical fact-lock is intentionally conservative but **cannot prove semantic equivalence**: review every suggestion and exported file yourself, especially employer names, achievements, dates, numbers and formatting.

You may configure per-user humanizer/detector endpoints and API keys in Settings, or set `HUMANIZER_API_URL` / `HUMANIZER_API_KEY` and `DETECTOR_API_URL` / `DETECTOR_API_KEY` on the server. Provider contracts:

- Humanizer: `POST` JSON `{ original, text, intensity, protectedKeywords }` → `{ "text": "..." }`.
- Detector: `POST` JSON `{ text }` → `{ "score": 0..100 }`.

Both use `Authorization: Bearer <key>`, HTTPS and a timeout; failing or missing providers fall back to built-ins. User-specific keys are AES-GCM-encrypted in the DB, never sent back to the browser. **Do not point provider URLs at untrusted services:** they receive private resume text. A public-host DNS preflight and disabled redirects reduce SSRF risk, but production egress restrictions are recommended.

## Verify and maintain

```bash
npm test           # provenance, sponsorship, importer mapping, keyword extraction, humanizer, fact-lock, dedupe; all migrations applied in PGlite
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run build      # production Next.js build (requires Prisma engine binaries)
```

Routes: `/dashboard`, `/jobs`, `/jobs/[id]`, `/saved`, `/applications`, `/resumes`, `/companies`, `/settings`. `src/middleware.ts` requires a valid Auth.js session for every page and API route except `/`, `/login`, `/api/auth/*` (including registration) and `/api/cron/*` (bearer secret). Pages redirect to `/login`; APIs return 401. Route handlers still verify the session and scope all data to the user. Demo state is local; production data is PostgreSQL. Back up the PostgreSQL database and encrypted-key secret, monitor `SourceRun` errors, and keep provider credentials and government downloads out of Git. This workspace validated the SQL migration in PGlite and exercised the demo-mode API, but **could not run Prisma against a real PostgreSQL server or fetch live ATS/YC/HN sources from the sandbox**; validate those integrations in a deployment with database and network access.
