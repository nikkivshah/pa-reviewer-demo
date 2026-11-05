import { z } from "zod";

// ---------- Shared ----------

const confidence = z
  .number()
  .min(0)
  .max(1)
  .describe("How sure you are, 0 to 1. Use below 0.7 if the source is ambiguous, garbled, or only implies the fact.");

const citation = z
  .string()
  .min(1)
  .describe("EXACT verbatim quote copied from the source document that supports this value. Short, one line. No paraphrasing.");

export const ExtractedFactSchema = z.object({
  value: z
    .string()
    .min(1)
    .describe("The clinical fact in plain language. If someone other than the patient reported it, say who (e.g. 'Wife reports loud snoring')."),
  citation,
  confidence,
});

// ---------- Extraction (Layer 3) ----------

export const ExtractionSchema = z.object({
  patient: z.object({
    age: z.number().int().nullable().describe("Age in years, or null if not stated."),
    sex: z.enum(["M", "F", "unknown"]),
  }),
  documentTypes: z
    .array(z.enum(["referral_letter", "encounter_note", "lab_report", "imaging_report", "other"]))
    .describe("Which kinds of documents are present in the packet."),
  diagnoses: z.array(ExtractedFactSchema).min(1).describe("Diagnoses, including ICD-10 codes if given."),
  requestedService: ExtractedFactSchema.describe("The procedure or service being requested, with CPT code if given."),
  relevantHistory: z
    .array(ExtractedFactSchema)
    .describe("Past medical history, current medications, and prior treatments relevant to the request."),
  clinicalFindings: z
    .array(ExtractedFactSchema)
    .describe("Symptoms, vitals, exam findings, screening scores, and provider counseling/plan items."),
  notDocumented: z
    .array(z.string())
    .describe("Clinically relevant items a reviewer would expect for this request that the document does NOT contain."),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;

// What the API returns: model output plus server-side verification.
export type VerifiedFact = ExtractedFact & {
  citationVerified: boolean; // quote actually exists in one of the packet's documents
  sourceDocId: string | null; // which document it was found in
  sourceDocTitle: string | null;
  needsReview: boolean; // low confidence OR unverified citation
};

export type VerifiedExtraction = Omit<
  Extraction,
  "diagnoses" | "requestedService" | "relevantHistory" | "clinicalFindings"
> & {
  diagnoses: VerifiedFact[];
  requestedService: VerifiedFact;
  relevantHistory: VerifiedFact[];
  clinicalFindings: VerifiedFact[];
};

// ---------- Criteria matching + recommendation (Layers 4 and 5) ----------

export const CRITERION_STATUSES = ["met", "not_met", "missing"] as const;
export type CriterionStatus = (typeof CRITERION_STATUSES)[number];

const CriterionResultBase = z.object({
  criterionId: z.string(),
  status: z
    .enum(CRITERION_STATUSES)
    .describe(
      "met = documentation shows the criterion is satisfied. not_met = documentation addresses it and shows it is NOT satisfied. missing = documentation does not address it at all."
    ),
  required: z
    .string()
    .describe("The criterion's threshold restated in a short phrase, e.g. '2 of 3: snoring, witnessed apneas, daytime sleepiness'."),
  found: z
    .string()
    .describe(
      "What the documents actually show against that threshold, in a short phrase, e.g. '1 of 3: snoring only (reported by his wife)'. Use 'Not documented' if missing."
    ),
  reasoning: z
    .string()
    .describe(
      "One or two plain-language sentences explaining the status. Refer to the patient by name or as 'the patient'. When information comes from someone else, say who (e.g. 'his wife reports')."
    ),
  evidence: z
    .array(citation)
    .describe("Verbatim quotes from the documents. Empty only if status is missing. Prefer quotes that make clear who is speaking."),
  confidence,
});

// The AI's action space is deliberately narrower than the clinician's.
// There is no "deny" value. A denial can only be authored by a human reviewer.
export const RecommendationSchema = z.object({
  action: z.enum(["approve", "escalate"]),
  confidence,
  rationale: z.string().describe("Plain-language explanation for the reviewer, two to three sentences."),
});

// Built per criteria set, so the model can only return the IDs that set defines,
// exactly once each.
export function matchingSchemaFor(criterionIds: [string, ...string[]]) {
  return z.object({
    caseOverview: z
      .string()
      .describe(
        "Three to four sentence summary a reviewer can read in under a minute. Use the patient's name or 'the patient'; use pronouns that match the patient's documented sex."
      ),
    criteria: z.array(CriterionResultBase.extend({ criterionId: z.enum(criterionIds) })).length(criterionIds.length),
    recommendation: RecommendationSchema,
    flags: z.array(z.string()).describe("Anything the reviewer should look at closely: conflicts, ambiguities, unusual patterns."),
  });
}

export type CriterionResult = z.infer<typeof CriterionResultBase>;
export type Recommendation = z.infer<typeof RecommendationSchema>;

// ---------- Thresholds (configurable per deployment in production) ----------

export const THRESHOLDS = {
  extractionReview: 0.7, // below this, flag the fact for reviewer attention
  recommendationDisplay: 0.85, // below this, suppress the recommendation, show evidence only
};
