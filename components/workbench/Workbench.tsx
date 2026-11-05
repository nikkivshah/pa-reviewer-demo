"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, EyeOff, Globe, Printer } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TatClock } from "@/components/TatClock";
import { cn } from "@/lib/utils";
import { locateQuote } from "@/lib/quotes";
import {
  appendAudit,
  auditEvent as evt,
  hasCaseEvents,
  REVIEWER,
  useCaseAudit,
  useCaseOutcomes,
} from "@/lib/audit-store";
import type { AuditEvent, ExtractResponse, MatchResponse, WorkbenchCase, WorkbenchCriteria } from "@/lib/pipeline-types";
import { AuditTrailDrawer } from "./AuditTrailDrawer";
import { CriteriaSetDrawer } from "./CriteriaSetDrawer";
import { DecisionBar, type Decision } from "./DecisionBar";
import { SourceDocumentPane } from "./SourceDocumentPane";
import { SummaryPane, type Phase } from "./SummaryPane";

// Keep results for the browser session so revisiting a case during the demo is instant.
const resultCache = new Map<string, { extract: ExtractResponse; match: MatchResponse }>();

async function postJson<T>(url: string, body: unknown, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export function Workbench({
  c,
  criteria,
  queueOrder,
}: {
  c: WorkbenchCase;
  criteria: WorkbenchCriteria;
  queueOrder: string[]; // all case ids, most urgent first
}) {
  const cached = resultCache.get(c.id);
  const [phase, setPhase] = useState<Phase>(cached ? "ready" : "extracting");
  const [extract, setExtract] = useState<ExtractResponse | null>(cached?.extract ?? null);
  const [match, setMatch] = useState<MatchResponse | null>(cached?.match ?? null);
  const [error, setError] = useState<string | null>(null);
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  // Open on the first clinical document, not the fax cover.
  const [activeDocId, setActiveDocId] = useState(
    () => (c.documents.find((d) => d.kind !== "fax_cover" && d.kind !== "portal_form") ?? c.documents[0]).id
  );
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [shadowMode, setShadowMode] = useState(false);
  const [newDecision, setDecision] = useState<Decision | null>(null);
  const events = useCaseAudit(c.id);
  const outcomes = useCaseOutcomes();
  // A decision made earlier (on a previous visit) is restored from the audit log.
  const decision = newDecision ?? ((outcomes[c.id]?.data as Decision | undefined) ?? null);
  // Next case: the next one still open, in queue order, skipping completed ones.
  const nextCaseId = useMemo(() => {
    const i = queueOrder.indexOf(c.id);
    const rest = [...queueOrder.slice(i + 1), ...queueOrder.slice(0, i)];
    return rest.find((id) => !outcomes[id]) ?? null;
  }, [queueOrder, c.id, outcomes]);
  const log = useCallback((...e: AuditEvent[]) => appendAudit(c.id, ...e), [c.id]);

  // Every open is logged (access logging). Intake events are logged once per case.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const firstVisit = !hasCaseEvents(c.id);
    log(
      evt({ actor: REVIEWER, event: firstVisit ? "Case opened" : "Case reopened", detail: `${c.id} · ${c.requestedService}` }),
      ...(firstVisit
        ? [
            evt({
              actor: "System",
              event: "Document ingested",
              detail: `${c.documents.length} documents (${c.documents.map((d) => d.title).join(", ")}) · ${
                c.intakeChannel === "fax" ? "Fax (OCR'd)" : "Provider portal"
              } · ${c.lineOfBusiness} · ${c.priority}`,
            }),
            evt({
              actor: "System",
              event: criteria.selected
                ? `Criteria set selected: ${criteria.selected.id} ${criteria.selected.version}`
                : "No criteria set applies, manual selection required",
              detail: `CPT ${criteria.matchedOn.cptCode} · ${criteria.matchedOn.lineOfBusiness} · as of ${
                criteria.matchedOn.asOf
              }\n${criteria.chain.map((s) => `${s.tierLabel}: ${s.outcome.replace(/_/g, " ")}${s.setId ? ` (${s.setId}${s.version ? ` ${s.version}` : ""})` : ""}`).join("\n")}`,
              data: { chain: criteria.chain },
            }),
          ]
        : [])
    );
  }, [c, criteria, log]);

  // Run the AI pipeline: Layer 3 extraction, then Layers 4+5 matching and summary.
  useEffect(() => {
    if (resultCache.has(c.id)) return;
    const ctrl = new AbortController();

    (async () => {
      try {
        const ex = await postJson<ExtractResponse>("/api/extract", { caseId: c.id }, ctrl.signal);
        setExtract(ex);
        setPhase("matching");
        log(
          evt({
            actor: "AI",
            event: "Clinical facts extracted",
            model: ex.audit.model,
            timestamp: ex.audit.timestamp,
            detail: `${ex.quality.documentsRead} documents read · ${ex.quality.totalFacts} facts · ${ex.quality.flaggedForReview} flagged · ${ex.quality.unverifiedCitations} unverified citations · ${ex.audit.latencyMs} ms`,
            data: ex.audit,
          })
        );

        const m = await postJson<MatchResponse>(
          "/api/match-criteria",
          { caseId: c.id, extraction: ex.extraction },
          ctrl.signal
        );
        setMatch(m);
        setPhase("ready");
        resultCache.set(c.id, { extract: ex, match: m });
        log(
          evt({
            actor: "AI",
            event: "Criteria evaluated",
            model: m.audit.model,
            timestamp: m.audit.timestamp,
            detail: `${m.criteriaSet.id} · ${m.counts.met} met · ${m.counts.not_met} not met · ${m.counts.missing} missing\n${m.criteria
              .map((x) => `${x.criterionId}: ${x.status} (${Math.round(x.confidence * 100)}%)`)
              .join(" · ")}`,
            data: m.audit,
          }),
          evt({
            actor: "AI",
            event: `Recommendation: ${m.recommendation.action === "approve" ? "ready to approve" : "escalate for clinician review"}${
              m.recommendation.displayed ? "" : " (withheld, below threshold)"
            }`,
            model: m.audit.model,
            confidence: m.recommendation.confidence,
            detail: m.recommendation.rationale,
          })
        );
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(String(err));
        setPhase("error");
        log(evt({ actor: "System", event: "AI pipeline failed, routed to manual review", detail: String(err) }));
      }
    })();

    return () => ctrl.abort();
  }, [c.id, log]);

  const citations = useMemo(() => {
    if (shadowMode || !match) return [];
    const fromCriteria = match.criteria.flatMap((x) => x.evidence.map((e) => e.quote));
    return fromCriteria;
  }, [match, shadowMode]);

  // Clicking a citation anywhere opens the document that contains it and highlights it.
  function cite(quote: string) {
    setActiveQuote(quote);
    const doc = locateQuote(quote, c.documents);
    if (doc) setActiveDocId(doc.id);
  }

  function toggleShadow() {
    const next = !shadowMode;
    setShadowMode(next);
    setActiveQuote(null);
    log(evt({ actor: REVIEWER, event: next ? "Shadow mode enabled (AI output hidden)" : "Shadow mode disabled" }));
  }

  function decide(d: Decision) {
    setDecision(d);
    const ai = match?.recommendation.action;
    const agreed = ai ? (ai === "approve" ? d.action === "approve" : d.action !== "approve") : undefined;
    log(
      evt({
        actor: REVIEWER,
        event: `Determination: ${d.action.replace("_", " ")}`,
        timestamp: d.timestamp,
        detail: [
          d.note && `Note: ${d.note}`,
          d.criteriaCited?.length && `Criteria cited: ${d.criteriaCited.join(", ")}`,
          d.physicianSignoff && `Physician sign-off: ${d.physicianSignoff}`,
          ai && `AI recommended "${ai}" → ${agreed ? "reviewer consistent with AI" : "reviewer override"}${shadowMode ? " (shadow mode)" : ""}`,
        ]
          .filter(Boolean)
          .join("\n"),
        data: { ...d, aiRecommendation: ai, agreed, shadowMode },
      }),
      evt({
        actor: "System",
        event: "Provider notified",
        detail: c.intakeChannel === "fax" ? "Determination letter queued for fax-back" : "Portal status updated",
      })
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />

      {/* Case bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to queue">
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-xl font-normal tracking-tight">{c.patientName}</span>
              <span className="text-sm text-muted-foreground">
                {c.age}
                {c.sex} · {c.memberId}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{c.id}</span>·<span>{c.requestedService}</span>·
              <span className="inline-flex items-center gap-1">
                {c.intakeChannel === "fax" ? <Printer className="size-3.5" /> : <Globe className="size-3.5" />}
                {c.intakeChannel === "fax" ? "Fax" : "Portal"}
              </span>
              ·<span>{c.requestingProvider}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <TatClock lob={c.lineOfBusiness} priority={c.priority} receivedHoursAgo={c.receivedHoursAgo} variant="bar" />
          <button
            type="button"
            onClick={toggleShadow}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8rem] font-medium",
              shadowMode ? "border-brand bg-brand text-white" : "bg-card hover:bg-muted"
            )}
            aria-pressed={shadowMode}
          >
            <EyeOff className="size-3.5" /> Shadow mode {shadowMode ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => setCriteriaOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[0.8rem] font-medium hover:bg-muted"
          >
            <BookOpen className="size-3.5" /> Criteria
            <span className="font-mono text-xs text-muted-foreground">
              {criteria.selected ? `${criteria.selected.id} ${criteria.selected.version}` : "manual"}
            </span>
          </button>
          <AuditTrailDrawer events={events} caseId={c.id} />
        </div>
      </div>

      {/* Two panes */}
      <main className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-rows-1">
        <SourceDocumentPane
          c={c}
          activeDocId={activeDocId}
          onSelectDoc={setActiveDocId}
          citations={citations}
          activeQuote={shadowMode ? null : activeQuote}
        />
        <SummaryPane
          phase={phase}
          error={error}
          extract={extract}
          match={match}
          activeQuote={activeQuote}
          onCite={cite}
          onViewCriteria={() => setCriteriaOpen(true)}
          shadowMode={shadowMode}
        />
      </main>

      <CriteriaSetDrawer
        open={criteriaOpen}
        onOpenChange={setCriteriaOpen}
        resolution={criteria}
        match={shadowMode ? null : match}
      />

      <DecisionBar
        match={shadowMode ? null : match}
        decision={decision}
        onDecide={decide}
        reviewer={REVIEWER}
        nextCaseId={nextCaseId}
      />
    </div>
  );
}
