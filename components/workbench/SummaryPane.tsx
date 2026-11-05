"use client";

import { AlertTriangle, BookOpen, Check, EyeOff, Flag, Loader2, Quote, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtractResponse, MatchResponse } from "@/lib/pipeline-types";
import type { VerifiedFact } from "@/lib/schemas";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { CriterionCard, STATUS_META } from "./CriterionCard";
import { RecommendationBanner } from "./RecommendationBanner";

export type Phase = "extracting" | "matching" | "ready" | "error";

const STEPS = [
  { key: "parse", label: "Parse document" },
  { key: "extract", label: "Extract clinical facts" },
  { key: "match", label: "Match criteria" },
  { key: "summarize", label: "Summarize" },
] as const;

export function SummaryPane({
  phase,
  error,
  extract,
  match,
  activeQuote,
  onCite,
  onViewCriteria,
  shadowMode,
}: {
  phase: Phase;
  error: string | null;
  extract: ExtractResponse | null;
  match: MatchResponse | null;
  activeQuote: string | null;
  onCite: (q: string) => void;
  onViewCriteria: () => void;
  shadowMode: boolean;
}) {
  return (
    <section className="flex min-h-0 flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b border-ai-border bg-ai-soft px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
          <Sparkles className="size-4 text-ai" /> AI medical necessity summary
        </div>
        {match && (
          <span className="text-xs text-muted-foreground">
            {match.audit.model} · {((extract?.audit.latencyMs ?? 0) + match.audit.latencyMs) / 1000}s
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {shadowMode ? (
          <ShadowPlaceholder done={phase === "ready"} />
        ) : phase === "error" ? (
          <div className="rounded-lg border border-not-met/40 bg-not-met-soft p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-not-met">
              <AlertTriangle className="size-4" /> AI assist unavailable for this case
            </div>
            <p className="mt-1">Work this case manually from the source document. Nothing is blocked.</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{error}</p>
          </div>
        ) : phase !== "ready" || !match ? (
          <PipelineProgress phase={phase} extract={extract} />
        ) : (
          <div className="flex flex-col gap-5">
            <RecommendationBanner rec={match.recommendation} />

            <div>
              <SectionTitle>Case overview</SectionTitle>
              <p className="text-sm leading-relaxed">{match.caseOverview}</p>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SectionTitle className="mb-0">
                    Criteria · {match.criteriaSet.name} {match.criteriaSet.version}
                  </SectionTitle>
                  <button
                    type="button"
                    onClick={onViewCriteria}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <BookOpen className="size-3" /> View full set
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {(["met", "not_met", "missing"] as const).map((s) => (
                    <span
                      key={s}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        STATUS_META[s].bg,
                        STATUS_META[s].text
                      )}
                    >
                      {match.counts[s]} {STATUS_META[s].label.toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {match.criteria.map((c) => (
                  <CriterionCard key={c.criterionId} c={c} activeQuote={activeQuote} onCite={onCite} />
                ))}
              </div>
            </div>

            {match.flags.length > 0 && (
              <div>
                <SectionTitle>
                  <Flag className="mr-1 inline size-3.5" />
                  For your attention
                </SectionTitle>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {match.flags.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-missing" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {extract && <ExtractedFacts extract={extract} activeQuote={activeQuote} onCite={onCite} />}
          </div>
        )}
      </div>
    </section>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </h3>
  );
}

function PipelineProgress({ phase, extract }: { phase: Phase; extract: ExtractResponse | null }) {
  const doneCount = phase === "extracting" ? 1 : phase === "matching" ? 2 : 0;
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 py-10">
      <p className="font-heading text-lg font-light">AI is pre-reading this case…</p>
      {STEPS.map((s, i) => {
        const done = i < doneCount;
        const active = i === doneCount || (i === doneCount + 1 && phase === "matching");
        return (
          <div key={s.key} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border",
                done && "border-met bg-met text-white",
                active && "border-ai"
              )}
            >
              {done ? (
                <Check className="size-3" />
              ) : active ? (
                <Loader2 className="size-3 animate-spin text-ai" />
              ) : null}
            </span>
            <span className={cn(!done && !active && "text-muted-foreground")}>{s.label}</span>
            {s.key === "extract" && extract && (
              <span className="text-xs text-muted-foreground">
                {extract.quality.documentsRead} docs · {extract.quality.totalFacts} facts ·{" "}
                {extract.quality.unverifiedCitations} unverified
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShadowPlaceholder({ done }: { done: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
      <EyeOff className="size-8 text-muted-foreground" />
      <p className="font-medium">Shadow mode is on</p>
      <p className="text-sm text-muted-foreground">
        The AI {done ? "has analyzed" : "is analyzing"} this case in the background. Its output is logged to the audit
        trail but hidden from you, so your decision is independent. AI-reviewer agreement is measured afterward.
      </p>
    </div>
  );
}

const FACT_GROUPS = [
  { key: "diagnoses", label: "Diagnoses" },
  { key: "relevantHistory", label: "Relevant history & medications" },
  { key: "clinicalFindings", label: "Clinical findings" },
] as const;

function ExtractedFacts({
  extract,
  activeQuote,
  onCite,
}: {
  extract: ExtractResponse;
  activeQuote: string | null;
  onCite: (q: string) => void;
}) {
  const e = extract.extraction;
  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-medium">
        Extracted clinical facts
        <span className="text-xs font-normal text-muted-foreground">
          {extract.quality.totalFacts} facts · {extract.quality.flaggedForReview} flagged ·{" "}
          {extract.quality.unverifiedCitations} unverified citations
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t p-3">
        <FactGroup label="Requested service" facts={[e.requestedService]} activeQuote={activeQuote} onCite={onCite} />
        {FACT_GROUPS.map((g) => (
          <FactGroup key={g.key} label={g.label} facts={e[g.key]} activeQuote={activeQuote} onCite={onCite} />
        ))}
        {e.notDocumented.length > 0 && (
          <div>
            <SectionTitle>Not documented in packet</SectionTitle>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {e.notDocumented.map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function FactGroup({
  label,
  facts,
  activeQuote,
  onCite,
}: {
  label: string;
  facts: VerifiedFact[];
  activeQuote: string | null;
  onCite: (q: string) => void;
}) {
  if (facts.length === 0) return null;
  return (
    <div>
      <SectionTitle>{label}</SectionTitle>
      <div className="flex flex-col">
        {facts.map((f, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onCite(f.citation)}
            title={`${f.sourceDocTitle ?? "Not found in source"}: "${f.citation}"`}
            className={cn(
              "flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-cite/50",
              activeQuote === f.citation && "bg-cite-strong/60"
            )}
          >
            <span className="flex items-center gap-1.5">
              <Quote className="size-3 shrink-0 text-muted-foreground" />
              {f.value}
              {f.needsReview && <AlertTriangle className="size-3.5 text-not-met" />}
              {f.sourceDocTitle && <span className="text-xs text-muted-foreground">· {f.sourceDocTitle}</span>}
            </span>
            <ConfidenceIndicator value={f.confidence} className="shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
