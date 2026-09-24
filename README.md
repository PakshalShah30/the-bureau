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

Visit `http://localhost:3000`, choose **Explore the demo**, or sign in with `demo@thebureau.app` / `demo1234`. The local preview persists in ignored `.data/demo.json`. Delete only this file to reset the preview. Its 12 job examples are **dated source-checked snapshots from September 23, 2026**, not live postings; their descriptions are *excerpts*. The five sample applications and sample resume are fictional personal activity, not invented job listings. Refreshing can replace snapshots with live board data when outbound access is available. If a board cannot be reached, the refresh reports an error and keeps its existing jobs; it does **not** silently substitute fabricated postings.

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
5. **Optional demo account in PostgreSQL:** `SEED_DEMO=true npm run db:seed`. This opts into a known demo password, tracks 10 verified boards, attempts a **live** refresh (no job fixtures), adds one fictional personal resume and five fictional application-stage examples linked to real fetched jobs when available. **Do not do this on a public server unless you immediately change or disable the demo account.** If sources fail, the account has no fake jobs.

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

`vercel.json` configures `GET /api/cron/refresh` for **00:00, 06:00, 12:00 and 18:00 UTC**. Set `CRON_SECRET` in the deployment environment. The endpoint accepts only `Authorization: Bearer <CRON_SECRET>`; in demo mode it returns 400. Vercel plans have different cron frequency/runtime limits: on a platform that cannot run a six-hour cron, use an external scheduler with the same endpoint, for example:

```cron
0 */6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/refresh
```

There is also an authenticated **Refresh jobs** button / `POST /api/jobs/refresh` (optional `{ "companyId": "..." }` to refresh one tracked board). Results and individual source errors appear in the feed; a successful board fetch is required before any missing jobs from that board are closed. Failed HN fetches/partial threads do not close HN jobs. Runs are deduplicated in-process per user, not across server instances; for multi-instance production use a distributed job lock or queue. The cron currently iterates users sequentially; use an external worker/queue at larger scale. A one-minute cooldown applies to successful on-demand refreshes.

Listings retain exact original apply URLs, source badges, posted dates when provided (otherwise **Date not published**), and sponsorship evidence. Canonical deduplication strips tracking params while preserving essential identifiers such as Greenhouse `gh_jid` on company career URLs. Greenhouse's `updated_at` is *not* misrepresented as a posted date. Every job detail links the exact posting, plus the original HN comment for HN-sourced roles; saved/closed jobs remain accessible.

## Government H-1B evidence (opt-in import)

Download the actual public **LCA disclosure** CSV/CSV.GZ/XLSX from [DOL OFLC performance data](https://www.dol.gov/agencies/eta/foreign-labor/performance) and/or the public employer-level file from [USCIS H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub). Put large downloads in ignored `data/`, **not in Git**. Inspect the header row to ensure it contains the supported FY, employer, status/case number and approval/denial fields; the importer prints accepted-row counts and fails on zero matches.

```bash
npm run h1b:import -- --lca data/LCA_FY2026.xlsx --uscis data/USCIS_FY2026.csv
# Either --lca or --uscis can be used separately. Re-run after each government release.
# Then refresh the jobs feed to recompute badges.
```

The streaming importer accepts `.csv`, `.csv.gz` and `.xlsx`, uses H-1B **certified** LCA records from the most recent three fiscal years, deduplicates LCA case numbers, and upserts USCIS employer/year adjudication totals. DOL hourly/monthly wages are converted to an annual *offered* amount; the median is not a salary guarantee. USCIS totals are adjudications, not workers hired. The app matches conservative normalized employer names, allows a precise legal-filer alias override in company settings, and displays the actual imported titles, worksite, wage (if available), approvals/denials and official source links. A clear **no sponsorship** or **sponsorship available** policy stated in the *job itself* always overrides employer history. If neither a statement nor matching recent filings exists, the status is **Unknown**, never “doesn't sponsor.” If the government file format changes, update `src/lib/h1b.ts` to map the official fields, rather than guessing or synthesizing rows. These indicators are not immigration or legal advice: confirm policy with the employer.

## Resume workflow and providers

Upload a text-based PDF/DOCX (max 5 MB) or paste text, select a job, and request a keyword/formatting analysis. An optional `LLM_API_KEY`, `LLM_BASE_URL` (OpenAI-compatible `POST /chat/completions`) and `LLM_MODEL` enable AI rewrite suggestions. The built-in humanizer is **always run**, including when no key is configured or a pluggable provider fails; user intensity is set in Settings. Suggestions are **opt-in per bullet**. Missing skills require a separate explicit confirmation and are never inserted by the model. Each suggested and re-humanized line is checked for changes to numbers/dates, achievement actions, known tools/skills, named entities, negation and claim retention; unsafe lines cannot be accepted or exported. The final version passes another fact-lock and ATS recheck before it is stored and linked to the application. Downloadable DOCX and PDF files are generated from that saved text. The PDF bundles open-licensed Unicode fonts so accented names are not silently stripped; an unsupported glyph produces an explicit error, while DOCX preserves the original text.

The default “AI-likelihood” score is a **simple writing-pattern heuristic**, not a reliable AI detector; neither this score nor the ATS keyword percentage is an ATS vendor score or a guarantee. The lexical fact-lock is intentionally conservative but **cannot prove semantic equivalence**: review every suggestion and exported file yourself, especially employer names, achievements, dates, numbers and formatting.

You may configure per-user humanizer/detector endpoints and API keys in Settings, or set `HUMANIZER_API_URL` / `HUMANIZER_API_KEY` and `DETECTOR_API_URL` / `DETECTOR_API_KEY` on the server. Provider contracts:

- Humanizer: `POST` JSON `{ original, text, intensity, protectedKeywords }` → `{ "text": "..." }`.
- Detector: `POST` JSON `{ text }` → `{ "score": 0..100 }`.

Both use `Authorization: Bearer <key>`, HTTPS and a timeout; failing or missing providers fall back to built-ins. User-specific keys are AES-GCM-encrypted in the DB, never sent back to the browser. **Do not point provider URLs at untrusted services:** they receive private resume text. A public-host DNS preflight and disabled redirects reduce SSRF risk, but production egress restrictions are recommended.

## Verify and maintain

```bash
npm test           # unit tests for provenance, sponsorship, importer mapping, fact-lock; migration applied in PGlite
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run build      # production Next.js build (requires Prisma engine binaries)
```

Routes: `/dashboard`, `/jobs`, `/jobs/[id]`, `/saved`, `/applications`, `/resumes`, `/companies`, `/settings`. API requests are same-origin, authenticated (except registration and Auth.js handlers), validated and user-scoped. Demo state is local; production data is PostgreSQL. Back up the PostgreSQL database and encrypted-key secret, monitor `SourceRun` errors, and keep provider credentials and government downloads out of Git. This workspace validated the SQL migration in PGlite and exercised the demo-mode API, but **could not run Prisma against a real PostgreSQL server or fetch live ATS/YC/HN sources from the sandbox**; validate those integrations in a deployment with database and network access.
