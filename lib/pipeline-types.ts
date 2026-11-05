// Client-side shapes of the API responses and the audit trail.

import type { ChainStep, CriteriaResolution } from "./criteria";
import type { CriterionResult, Recommendation, VerifiedExtraction } from "./schemas";
import type { SyntheticCase } from "./synthetic-cases";

export type WorkbenchCase = Omit<SyntheticCase, "expected">;

// Criteria resolution for a case (deterministic precedence walk). selected = null means manual selection.
export type WorkbenchCriteria = CriteriaResolution;

export type StageAudit = {
  stage: string;
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  timestamp: string;
  criteriaSetId?: string;
};

export type ExtractResponse = {
  extraction: VerifiedExtraction;
  quality: { totalFacts: number; documentsRead: number; unverifiedCitations: number; flaggedForReview: number };
  audit: StageAudit;
};

export type EvidenceQuote = { quote: string; verified: boolean; docId: string | null; docTitle: string | null };

export type MatchedCriterion = Omit<CriterionResult, "evidence"> & {
  title: string;
  definition: { description: string; evidenceRequired: string };
  evidence: EvidenceQuote[];
  needsReview: boolean;
};

export type MatchResponse = {
  criteriaSet: { id: string; version: string; name: string };
  selection: {
    matchedOn: { cptCode: string; lineOfBusiness: string; asOf: string };
    chain: ChainStep[];
    serviceCheck: {
      requestCpt: string;
      documentsMentionCpt: boolean;
      extractedServiceMatches: boolean | null;
      consistent: boolean;
    };
  };
  caseOverview: string;
  criteria: MatchedCriterion[];
  counts: { met: number; not_met: number; missing: number };
  recommendation: Recommendation & { displayed: boolean; guardrailApplied: boolean };
  flags: string[];
  audit: StageAudit;
};

export type ReviewerAction = "approve" | "request_info" | "escalate" | "deny";

export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string; // "System", "AI", or the reviewer's name
  event: string;
  detail?: string;
  model?: string;
  confidence?: number;
  data?: Record<string, unknown>;
};
