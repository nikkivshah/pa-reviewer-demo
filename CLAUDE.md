# PA Review Assistant: Project Context

A working proof of concept of a **Prior Authorization Review Assistant** for a health plan (payer). It reads a synthetic clinical document packet, extracts the clinical facts, checks them against a clinical criteria set, and presents a cited medical necessity summary in a reviewer workbench. A licensed clinician makes every decision. Every AI output and human action goes into an audit log.

Built with Next.js and real Claude calls on synthetic cases. Claude stands in for the platform's clinical text processing (extraction, summarization, evidence matching). The two API routes are where a production platform's services would plug in. Everything around them (criteria library, guardrails, workbench, audit) is the deployment configuration for the customer.

---

## Non-negotiable product rules

- **AI never recommends denial.** The recommendation schema only allows `approve` or `escalate`. Deny cannot be reached from the LLM pipeline.
- **Denials are written by a clinician.** The Deny dialog needs a typed rationale (min 40 chars), the criteria cited, physician sign-off, and an attestation.
- **Every AI claim cites the source.** The server checks each quote against the packet documents. Quotes that can't be found are flagged.
- **Approve only if every criterion is met** and the service check passes. The server enforces this after the model responds.
- **Confidence gating:** a fact with confidence below 0.7 is flagged for review. A recommendation below 0.85 is hidden, and only the evidence breakdown is shown (`THRESHOLDS` in `lib/schemas.ts`).
- **Criteria sets are chosen by rules, never by the AI.**
- **Synthetic data only.** No real PHI anywhere.

---

## How it works (request flow)

1. **Queue** (`app/page.tsx` + `components/queue/CaseQueue.tsx`): open cases with a TAT clock, CPT, document count, and the criteria set that applies. Once a reviewer records a determination, the case moves to a Completed list below (read from the audit log). When all are done the queue shows "Queue clear".
2. **Criteria resolution** (deterministic, before any AI call): `resolveCriteria()` in `lib/criteria.ts` walks the priority tiers for Medicare Advantage in order: Medicare NCD/LCD, then commercial criteria (MCG-style), then internal policy. It matches on CPT and line of business, and uses the version in effect on the case's `requestDate`. A Medicare set marked "not fully established" passes the decision to the next tier (CMS-4201-F). If nothing matches, the API returns 422 and the reviewer selects criteria manually.
3. **Extraction** (`app/api/extract/route.ts`): diagnoses, requested service, history, and findings, each with a citation and a confidence score. The citation is verified per document (`lib/quotes.ts`).
4. **Criteria matching** (`app/api/match-criteria/route.ts`):
   - Each criterion comes back `met`, `not_met`, or `missing`, with `required`, `found`, reasoning, and verified evidence quotes.
   - A service check confirms the documents request the same CPT as the request.
   - The guardrail turns any approve into escalate unless all criteria are met and the service check is consistent.
5. **Workbench** (`app/workbench/[caseId]`): source documents and the AI summary side by side. Clicking a citation switches to that document and highlights the quote. A four-action decision bar: Approve, Request Info, Escalate, Deny.
6. **Audit** (`lib/audit-store.ts`, `/audit`): an append-only log shared across cases, with a SHA-256 hash chain, access logging, and JSON/CSV export.

---

## Pages

| Route | What it shows |
|---|---|
| `/` | Case queue |
| `/workbench/[caseId]` | Reviewer workbench. Includes the criteria drawer (how the set was chosen, tier by tier, plus every criterion), the audit trail drawer, the shadow mode toggle, the PHI boundary badge, and the TAT clock |
| `/criteria` | Criteria library: sets grouped by tier, versions with effective dates, change logs, and any rejected files |
| `/audit` | Cross-case audit log, filterable by case, actor and text, with expandable JSON rows, hash chain, export, and "Reset demo data" |

---

## Repo structure

```
app/
  page.tsx                      case queue
  workbench/[caseId]/page.tsx   resolves criteria server-side, renders Workbench (generateStaticParams)
  criteria/page.tsx             criteria library
  audit/page.tsx                audit log (searchParams read inside Suspense)
  api/extract/route.ts          extraction (Layer 3)
  api/match-criteria/route.ts   criteria matching + recommendation (Layers 4 and 5)
components/
  AppHeader.tsx, TatClock.tsx
  queue/CaseQueue.tsx           open vs completed cases (client, reads audit log)
  audit/AuditLog.tsx
  workbench/                    Workbench, SourceDocumentPane, SummaryPane, CriterionCard,
                                CriteriaSetDrawer, RecommendationBanner, ConfidenceIndicator,
                                DecisionBar, AuditTrailDrawer, PHIBoundaryBadge
  ui/                           shadcn (base-nova on Base UI): badge, button, card, dialog,
                                scroll-area, separator, sheet
data/criteria/*.json            one file per criteria set: all versions + change log
lib/
  criteria.ts                   types, tiers, Zod file schema, resolveCriteria(), versionInEffect()
  criteria-repo.ts              server only: loads + validates data/criteria, resolveForRequest()
  synthetic-cases.ts            the 3 cases and their documents (source of truth for case text)
  schemas.ts                    Zod schemas for LLM output, matchingSchemaFor(ids), THRESHOLDS
  llm.ts                        callStructured(): Claude structured outputs + Zod re-validation
  quotes.ts                     findQuote / locateQuote / packetForPrompt
  pipeline-types.ts             API response types used by the UI
  audit-store.ts                client audit log (sessionStorage), hash chain
  tat.ts                        TAT deadlines
```

---

## Synthetic cases

All three are requests for an in-lab sleep study (polysomnography, CPT 95810), Medicare Advantage. Each has three documents: a fax cover sheet or portal form, a referral letter, and an encounter note, all marked "SYNTHETIC DATA: NOT REAL PHI". The `expected` block on each case is for QA only and is stripped before reaching the UI.

| Case | Patient | Intake | Expected outcome |
|---|---|---|---|
| SYN-00001 | Mark T., 60M | Fax | APPROVE (all 6 met) |
| SYN-00002 | Sarah K., 54F | Portal | ESCALATE (mix of not met and missing) |
| SYN-00003 | Robert M., 42M | Fax | ESCALATE (several not met; a home sleep test fits better). Strongest teaching moment: the evidence doesn't support approval, and the AI still escalates rather than denies. |

Expected per-criterion results (PSG-INLAB-DEMO v2):

| Criterion | Mark T. | Sarah K. | Robert M. |
|---|---|---|---|
| C1 symptoms (2 of 3: snoring, witnessed apneas, sleepiness) | met | met | not met |
| C2 STOP-BANG ≥3 | met (6) | met (4) | not met (2) |
| C3 sleepiness scale (ESS) | met (14) | missing | met (7) |
| C4 comorbidity warranting in-lab | met | not met | not met |
| C5 BMI ≥30 / Mallampati III-IV / neck | met | not met | not met |
| C6 non-drug counseling documented | met | missing | met (declined counts) |

Last verified: 18/18 criteria, 3/3 recommendations, 0 unverified quotes.

---

## Criteria library

- Three sets in `data/criteria/`:
  - `medicare-sleep-testing.json`: MEDICARE-SLEEP-TEST-DEMO, Medicare tier, not fully established. A synthetic stand-in, not real CMS text.
  - `psg-inlab.json`: PSG-INLAB-DEMO, commercial tier, v1 (2025, retired) and v2 (2026, current).
  - `hsat.json`: HSAT-DEMO for home sleep tests (95800/95806/G0399). No case uses it.
- Files are Zod-validated on load. Invalid files are rejected, listed on `/criteria`, and never used.
- `next.config.ts` `outputFileTracingIncludes` ships the JSON with the deploy.
- To add a set: drop a new JSON file in `data/criteria/` following `CriteriaFileSchema`.

---

## Key technical patterns

- **Structured outputs:** `callStructured()` uses `client.messages.parse` with `output_config: { format: zodOutputFormat(schema) }`, then re-validates with Zod. Forced tool use is not supported on `claude-sonnet-5-5` (400 error).
- **Model:** `claude-sonnet-5-5` by default. Override with the `ANTHROPIC_MODEL` env var. `claude-haiku-5-5` is the faster fallback.
- **Per-set matching schema:** `matchingSchemaFor(ids)` restricts `criterionId` to the set's IDs and requires exactly one result per criterion.
- **Keeping people straight:** prompts get patient name/age/sex and the requesting provider, plus a rule to name who reported each symptom.
- **Case status:** a case is completed once the audit log has a `Determination:` event for it (`useCaseOutcomes()`). Reopening a decided case restores the decision, and "Next case" skips completed ones.
- **Caching:** pipeline results are cached per browser session (a module-level Map), so revisiting a case is instant.
- **Next.js 16:** `cacheComponents` is on. Dynamic params/searchParams must be inside `<Suspense>` or use `generateStaticParams`, or `next build` fails.

---

## UI design system

- **Fonts:** Inter Tight for headings (300 for big titles and numbers, 500 for buttons), Inter for body.
- **Palette** (tokens in `app/globals.css`):
  - violet primary `#731FE3`, text `#0D061F`, muted `#5B5768`, borders `#E3DFDE`
  - warm page background `#F9F7F6`
  - lavender `#F8F4FE` / `#F1EAFB`
  - navy `#0A0545` / `#040145`; the header gradient runs navy to violet
- **Color rule:**
  - lavender surface + violet sparkle = AI-generated content
  - green / amber / red = met / missing / not met
  - neutral = human controls
  - Never recolor status with brand violet.
- Buttons have an 8px radius, cards 10px. The workbench stays dense.

---

## Known limitations

- No real OCR, FHIR, database, auth, or EHR integration.
- The audit log lives in browser sessionStorage.

---

## Deployment

- Live: https://pa-reviewer-demo.vercel.app (Vercel, auto-deploys on push to `main`)
- Repo: https://github.com/nikkivshah/pa-reviewer-demo
- `ANTHROPIC_API_KEY` is set in Vercel project settings. API routes have `maxDuration = 60`.

---

## Next steps

1. Offline fallback: saved AI results in case the API is slow or down during a live demo.
2. Visual click-through in a real browser and polish.
3. Record a backup walkthrough video.

---

## Run

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build check
npx tsc --noEmit && npm run lint

curl -X POST http://localhost:3000/api/extract -H "Content-Type: application/json" -d '{"caseId":"SYN-00001"}'
curl -X POST http://localhost:3000/api/match-criteria -H "Content-Type: application/json" -d '{"caseId":"SYN-00001"}'
```

`ANTHROPIC_API_KEY` goes in `.env.local`.

---

## Writing conventions (UI copy and docs)

- No em dashes. Use commas, periods, or colons.
- No "it's not X, it's Y" sentences.
- Plain language for medical terms.
