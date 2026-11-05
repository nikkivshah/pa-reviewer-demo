// Layers 4 + 5: Criteria/evidence matching and the medical necessity summary.
// POST { caseId } or { document, cptCode }, optionally with { extraction } from /api/extract.
// Returns per-criterion met / not_met / missing, plus a confidence-gated recommendation
// that can only ever be "approve" or "escalate".

import type { ResolvedCriteriaSet } from "@/lib/criteria";
import { resolveForRequest } from "@/lib/criteria-repo";
import { callStructured } from "@/lib/llm";
import { locateQuote, packetForPrompt, type QuotableDocument } from "@/lib/quotes";
import { matchingSchemaFor, THRESHOLDS, type VerifiedExtraction } from "@/lib/schemas";
import { getCase } from "@/lib/synthetic-cases";

// LLM calls take 10-20s; give Vercel functions headroom.
export const maxDuration = 60;

const SYSTEM = `You are a clinical criteria matching assistant supporting licensed prior authorization reviewers at a Medicare Advantage health plan.

You compare documented clinical evidence against a fixed set of medical necessity criteria and prepare a summary a nurse reviewer can read in under a minute. The packet may contain several documents. Use all of them.

Rules:
- Judge each criterion ONLY from what the documents explicitly state. Never assume facts that are not written.
- Status definitions:
  - met: the documents show the criterion is satisfied.
  - not_met: the documents address the criterion and show it is not satisfied.
  - missing: the documents do not address the criterion at all (a Request for Information could resolve it).
- For every criterion, state the threshold ("required") and exactly what was found against it ("found"), so the reviewer can see the gap at a glance.
- Every evidence item must be an exact verbatim quote from one document.
- Keep people straight. The patient, the requesting provider, and family members are different people. Notes often use "she" or "he" for a family member. Refer to the patient by name or as "the patient", use pronouns matching the patient's documented sex, and say who reported each symptom when it was not the patient.
- Recommendation: you may only recommend "approve" or "escalate".
  - "approve" ONLY if every criterion is met.
  - Otherwise "escalate" so a licensed clinician reviews the case.
  - You never recommend denial. Adverse determinations are made only by licensed clinicians.
- Write in plain, neutral clinical language.`;

function criteriaBlock(set: ResolvedCriteriaSet) {
  return set.criteria
    .map((c) => `${c.id}: ${c.title}\n  Requirement: ${c.description}\n  Evidence needed: ${c.evidenceRequired}`)
    .join("\n\n");
}

export async function POST(request: Request) {
  let body: { caseId?: string; document?: string; cptCode?: string; requestDate?: string; extraction?: VerifiedExtraction };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Body must be JSON: { caseId } or { document, cptCode }, optional { extraction }" },
      { status: 400 }
    );
  }

  const c = body.caseId ? getCase(body.caseId) : undefined;
  const docs: QuotableDocument[] | undefined = c
    ? c.documents
    : body.document
      ? [{ id: "D1", title: "Submitted document", text: body.document }]
      : undefined;
  if (!docs) {
    return Response.json({ error: "Unknown caseId or empty document" }, { status: 400 });
  }

  // Step 1, deterministic: resolve the criteria set by precedence (Medicare rules first for MA),
  // CPT code, line of business, and the version in effect on the request date.
  const cptCode = c?.cptCode ?? body.cptCode;
  const lob = c?.lineOfBusiness ?? "Medicare Advantage";
  const asOf = c?.requestDate ?? body.requestDate ?? new Date().toISOString().slice(0, 10);
  const resolution = cptCode ? resolveForRequest({ cptCode, lineOfBusiness: lob, asOf }) : null;
  const set = resolution?.selected;
  if (!resolution || !set) {
    return Response.json(
      {
        error: "No criteria set applies to this service. Reviewer selects criteria manually.",
        detail: resolution
          ? resolution.chain.map((s) => `${s.tierLabel}: ${s.reason}`).join(" | ")
          : "Request has no CPT code",
      },
      { status: 422 }
    );
  }

  // Step 2, deterministic: confirm the documents ask for the same service the request says.
  // A mismatch means the wrong criteria could be applied, so the reviewer is told up front.
  const docsMentionCpt = docs.some((d) => d.text.includes(cptCode!));
  const extractedService = body.extraction?.requestedService;
  const extractedMentionsCpt = extractedService
    ? `${extractedService.value} ${extractedService.citation}`.includes(cptCode!)
    : null;
  const serviceCheck = {
    requestCpt: cptCode!,
    documentsMentionCpt: docsMentionCpt,
    extractedServiceMatches: extractedMentionsCpt,
    consistent: docsMentionCpt && extractedMentionsCpt !== false,
  };

  const extractionContext = body.extraction
    ? `\n\n<extracted_facts>\n${JSON.stringify(body.extraction, null, 2)}\n</extracted_facts>\n(Extracted facts are a convenience. The documents are the source of truth; quote the documents.)`
    : "";
  const requestContext = c
    ? `<request patient="${c.patientName}" age="${c.age}" sex="${c.sex === "M" ? "male" : "female"}" requesting_provider="${c.requestingProvider}" cpt="${c.cptCode}" />\n\n`
    : "";

  const ids = set.criteria.map((x) => x.id) as [string, ...string[]];

  try {
    const result = await callStructured({
      schema: matchingSchemaFor(ids),
      system: SYSTEM,
      user: `${requestContext}<criteria_set name="${set.name}" id="${set.id}" version="${set.version}">\n${criteriaBlock(set)}\n</criteria_set>\n\n<packet>\n${packetForPrompt(docs)}\n</packet>${extractionContext}\n\nEvaluate all ${ids.length} criteria (${ids.join(", ")}, in order) and produce the summary.`,
    });

    const m = result.data;

    // Every criterion exactly once.
    const got = m.criteria.map((x) => x.criterionId).sort().join(",");
    if (got !== [...ids].sort().join(",")) {
      throw new Error(`Expected one result per criterion ${ids.join(", ")}, got: ${got}`);
    }

    // Verify every evidence quote against the packet, and record which document it came from.
    const criteria = ids.map((id) => {
      const r = m.criteria.find((x) => x.criterionId === id)!;
      const def = set.criteria.find((x) => x.id === id)!;
      const evidence = r.evidence.map((quote) => {
        const doc = locateQuote(quote, docs);
        return { quote, verified: doc !== null, docId: doc?.id ?? null, docTitle: doc?.title ?? null };
      });
      return {
        ...r,
        title: def.title,
        definition: { description: def.description, evidenceRequired: def.evidenceRequired },
        evidence,
        needsReview: !evidence.every((e) => e.verified) || r.confidence < THRESHOLDS.extractionReview,
      };
    });

    // Deterministic guardrail: the model cannot approve unless every criterion is met
    // and the service on the request matches the documents. (The schema already makes "deny" impossible.)
    const allMet = criteria.every((x) => x.status === "met");
    const guardrailApplied = m.recommendation.action === "approve" && (!allMet || !serviceCheck.consistent);
    const recommendation = {
      ...m.recommendation,
      action: guardrailApplied ? ("escalate" as const) : m.recommendation.action,
      // Confidence gate: below threshold, the UI shows the evidence breakdown only.
      displayed: m.recommendation.confidence >= THRESHOLDS.recommendationDisplay,
      guardrailApplied,
    };

    const flags = [...m.flags];
    if (!serviceCheck.consistent) {
      flags.unshift(
        `Service mismatch: the request is for CPT ${cptCode}, but the documents do not clearly request it. Confirm the right criteria set before deciding.`
      );
    }

    const counts = {
      met: criteria.filter((x) => x.status === "met").length,
      not_met: criteria.filter((x) => x.status === "not_met").length,
      missing: criteria.filter((x) => x.status === "missing").length,
    };

    return Response.json({
      criteriaSet: { id: set.id, version: set.version, name: set.name },
      selection: { matchedOn: resolution.matchedOn, chain: resolution.chain, serviceCheck },
      caseOverview: m.caseOverview,
      criteria,
      counts,
      recommendation,
      flags,
      audit: {
        stage: "criteria_matching",
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
        criteriaSetId: `${set.id} ${set.version}`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[match-criteria]", err);
    return Response.json(
      {
        error: "Criteria matching failed. Show extraction only; reviewer applies criteria manually.",
        detail: String(err),
      },
      { status: 502 }
    );
  }
}
