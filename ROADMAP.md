# The Bureau — roadmap

Where the app is going, in order. Each phase should leave `npm test`, `npm run lint`
and `npm run typecheck` green. The standing rules from the README still apply to every
item: first-party sources only, no invented postings, sponsorship history is evidence
rather than a promise, and nothing is added to a resume without the user's confirmation.

## Done: fixes (September 2026)

- [x] **Skill matching read everyday English as skills.** "go-to-market" counted as Go and
  "the rest of the team" as REST, which inflated the number of skills a role asks for.
  Go and REST now use their own case-sensitive patterns, with tests.
- [x] **Sponsorship detection missed common phrasings.** "unable to sponsor visas", "We do
  not sponsor.", "not eligible for visa sponsorship", "We offer H-1B sponsorship" and "We
  sponsor visas" all came back Unknown (a plural "visas" broke the old patterns). The
  patterns are rebuilt, with tests for 11 real phrasings plus 3 that must *not* count
  ("We sponsor hackathons").
- [x] **An employer with only USCIS denials was labelled a likely sponsor.** The refresh
  job used "any recent filing" while the core rule required an approval or certified LCA.
  Both now share `hasSponsorHistory()`.
- [x] **Fact-lock gave false reasons.** Changing "Decreased" to "Cut" was reported as a
  changed date ("Dec") and a removed name. Months are now whole capitalised words, and a
  bullet's opening verb is no longer treated as a proper noun.

## Phase 1: better matching (in progress)

- [x] **Skill aliases:** Postgres → PostgreSQL, k8s → Kubernetes, JS → JavaScript, ReactJS,
  NodeJS, Amazon Web Services, and others.
- [x] **Business-analysis, QA and delivery vocabulary:** Jira, Confluence, Postman, Selenium,
  Cypress, Playwright, UAT, test cases and plans, API testing, regression and manual
  testing, requirements gathering (BRD/FRD), user stories and acceptance criteria, Agile,
  Scrum, Kanban, BPMN and process mapping, stakeholder management, Power BI, Excel, JSON,
  XML, SOAP, Azure DevOps.
- [x] **Required vs nice-to-have:** skills under a "Nice to have", "Preferred" or "Bonus"
  heading, or phrased as "X is a plus", count half. The match now also reports
  `missingRequired`.
- [x] **Rank the job feed by resume fit.** The Job feed's Sort menu has "Best fit · <resume>".
  Each card shows a fit badge, with the missing required skills in its tooltip. Listings
  that name no recognisable skills show "Fit unknown" and sort last, instead of looking
  like a 0% match. API: `GET /api/jobs?resumeId=…&minFit=50&sort=newest`.
- [x] **Applications CSV export:** Excel-friendly UTF-8, and protected against spreadsheet
  formula injection.
- [ ] Show "fit" on the dashboard's "Fresh from the source" list, using the most recent resume.
- [ ] Let the user add their own skills to the vocabulary (Settings), stored per user.

## Phase 2: the daily loop

- [ ] **Saved searches + alerts:** save a filter set ("remote QA, sponsors, fit ≥ 60") and
  get a daily email digest of new matches after the 6-hourly refresh (Resend or SMTP;
  opt-in, with an unsubscribe link).
- [ ] **Follow-up reminders:** an "Up next" list for due follow-ups, and an `.ics` calendar
  file per application.
- [ ] **Application timeline:** record each status change with its date, and report time
  from applied to response per company.
- [ ] **Kanban drag-and-drop** on the Applications board, usable from the keyboard.
- [ ] **Duplicate-role detection:** the same title at the same company seen on HN and on
  the company's own board becomes one card with both links.

## Phase 3: deeper tailoring

- [ ] **Cover-letter drafts** built only from facts already in the resume, protected by
  fact-lock and editable before export.
- [ ] **Interview prep sheet** per application: the posting's requirements mapped to the
  resume bullets that prove them, plus the gaps to prepare for.
- [ ] **Resume version compare:** a side-by-side diff between any two versions, with their ATS
  scores.
- [ ] **Salary context:** the median offered wage from imported DOL LCA rows for the same
  title and employer, clearly labelled as filings, not offers.

## Phase 4: operations and scale

- [ ] **Pagination and filtering in SQL** instead of in memory (today every job is loaded and
  filtered in JavaScript, which is fine for hundreds but not tens of thousands).
- [ ] **Distributed refresh lock** (Postgres advisory lock), so two server instances can't
  refresh the same user at the same time, and a queue for the cron job.
- [ ] **Registration controls:** an invite-only or allow-listed email setting for public
  deployments, and rate limiting on `/api/auth/register` and sign-in.
- [ ] **Playwright end-to-end tests** of the demo (sign in → feed → tailor → export) in CI.
- [ ] **CI workflow:** lint, typecheck, unit tests and build on every pull request.

## Known limits (by design)

- The ATS match is a transparent keyword check, not an ATS vendor's score.
- The AI-likelihood score is a writing-pattern heuristic, not proof of authorship.
- Fact-lock is lexical: it blocks many unsafe edits, but it cannot prove two sentences
  mean the same thing, so every exported line still needs your own read.
