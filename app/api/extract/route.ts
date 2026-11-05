// Layer 3: Clinical entity extraction.
// POST { caseId } or { document } -> structured facts, each with a verified citation + confidence.

import { callStructured } from "@/lib/llm";
import { packetForPrompt, locateQuote, type QuotableDocument } from "@/lib/quotes";
import { ExtractionSchema, THRESHOLDS, type ExtractedFact, type VerifiedExtraction, type VerifiedFact } from "@/lib/schemas";
import { getCase } from "@/lib/synthetic-cases";

// LLM calls take 10-20s; give Vercel functions headroom.
export const maxDuration = 60;

const SYSTEM = `You are a clinical documentation extraction assistant supporting prior authorization nurse reviewers at a Medicare Advantage health plan.

Your job: pull structured clinical facts out of an unstructured referral packet so a reviewer can verify them quickly. The packet may contain several documents (fax cover, referral letter, encounter notes). Read all of them.

Rules:
- Extract ONLY facts explicitly stated in the documents. Never infer, assume, or add medical knowledge that is not written there.
- Every fact must include a citation: an exact, verbatim quote copied character for character from one document. Keep quotes short (one line or less) and never stitch text from two places together.
- If something is ambiguous, garbled, or only implied, still report it but give it confidence below 0.7.
- Keep people straight. The patient, the requesting provider, and family members are different people. Notes often use "she" or "he" for a family member. In each fact, say who reported it (e.g. "Wife reports loud snoring") and refer to the patient as "the patient" or by name.
- List clinically relevant items a reviewer would expect for this kind of request that are absent from the packet under notDocumented.
- You do not make coverage decisions. You only report what the documentation says.`;

function verify(fact: ExtractedFact, docs: QuotableDocument[]): VerifiedFact {
  const doc = locateQuote(fact.citation, docs);
  return {
    ...fact,
    citationVerified: doc !== null,
    sourceDocId: doc?.id ?? null,
    sourceDocTitle: doc?.title ?? null,
    needsReview: doc === null || fact.confidence < THRESHOLDS.extractionReview,
  };
}

export async function POST(request: Request) {
  let body: { caseId?: string; document?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON: { caseId } or { document }" }, { status: 400 });
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

  // Structured request fields (from the portal form / fax intake), so the model
  // knows who the patient is and uses the right pronouns.
  const requestContext = c
    ? `<request patient="${c.patientName}" age="${c.age}" sex="${c.sex === "M" ? "male" : "female"}" requesting_provider="${c.requestingProvider}" cpt="${c.cptCode}" />\n\n`
    : "";

  try {
    const result = await callStructured({
      schema: ExtractionSchema,
      system: SYSTEM,
      user: `${requestContext}<packet>\n${packetForPrompt(docs)}\n</packet>\n\nExtract the clinical facts from this prior authorization packet.`,
    });

    const e = result.data;
    const extraction: VerifiedExtraction = {
      ...e,
      diagnoses: e.diagnoses.map((f) => verify(f, docs)),
      requestedService: verify(e.requestedService, docs),
      relevantHistory: e.relevantHistory.map((f) => verify(f, docs)),
      clinicalFindings: e.clinicalFindings.map((f) => verify(f, docs)),
    };

    const all = [extraction.requestedService, ...extraction.diagnoses, ...extraction.relevantHistory, ...extraction.clinicalFindings];

    return Response.json({
      extraction,
      quality: {
        totalFacts: all.length,
        documentsRead: docs.length,
        unverifiedCitations: all.filter((f) => !f.citationVerified).length,
        flaggedForReview: all.filter((f) => f.needsReview).length,
      },
      // Feeds the audit trail
      audit: {
        stage: "extraction",
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[extract]", err);
    return Response.json(
      { error: "Extraction failed. Reviewer should work this case manually.", detail: String(err) },
      { status: 502 }
    );
  }
}
