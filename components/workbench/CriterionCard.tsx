"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, CircleDashed, Quote, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchedCriterion } from "@/lib/pipeline-types";
import { ConfidenceIndicator } from "./ConfidenceIndicator";

export const STATUS_META = {
  met: { label: "Met", icon: CheckCircle2, text: "text-met", bg: "bg-met-soft", border: "border-l-met" },
  not_met: { label: "Not met", icon: XCircle, text: "text-not-met", bg: "bg-not-met-soft", border: "border-l-not-met" },
  missing: {
    label: "Missing",
    icon: CircleDashed,
    text: "text-missing-ink",
    bg: "bg-missing-soft",
    border: "border-l-missing",
  },
} as const;

type Panel = "evidence" | "criterion" | null;

export function CriterionCard({
  c,
  activeQuote,
  onCite,
}: {
  c: MatchedCriterion;
  activeQuote: string | null;
  onCite: (quote: string) => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const meta = STATUS_META[c.status];
  const Icon = meta.icon;
  const unverified = c.evidence.filter((e) => !e.verified).length;

  return (
    <div className={cn("rounded-lg border border-l-4 bg-card p-3", meta.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon className={cn("mt-0.5 size-4 shrink-0", meta.text)} />
          <div className="text-sm font-medium">
            <span className="mr-1.5 font-mono text-xs text-muted-foreground">{c.criterionId}</span>
            {c.title}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", meta.bg, meta.text)}>{meta.label}</span>
          <ConfidenceIndicator value={c.confidence} />
        </div>
      </div>

      {/* The gap, at a glance: what the criterion needs vs. what the packet shows. */}
      <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 pl-6 text-xs">
        <dt className="text-muted-foreground">Required</dt>
        <dd>{c.required}</dd>
        <dt className="text-muted-foreground">Found</dt>
        <dd className={cn("font-medium", meta.text)}>{c.found}</dd>
      </dl>

      <p className="mt-2 pl-6 text-sm text-muted-foreground">{c.reasoning}</p>

      <div className="mt-2 flex flex-wrap gap-1 pl-5">
        <PanelToggle open={panel === "evidence"} onClick={() => setPanel(panel === "evidence" ? null : "evidence")}>
          <Quote className="size-3" /> Evidence ({c.evidence.length})
          {unverified > 0 && <AlertTriangle className="size-3 text-not-met" />}
        </PanelToggle>
        <PanelToggle open={panel === "criterion"} onClick={() => setPanel(panel === "criterion" ? null : "criterion")}>
          <BookOpen className="size-3" /> Full criterion
        </PanelToggle>
      </div>

      {panel === "evidence" && (
        <div className="mt-1.5 flex flex-col gap-1 pl-6">
          {c.evidence.length === 0 && (
            <p className="text-xs text-muted-foreground">No quotes. Nothing in the packet addresses this criterion.</p>
          )}
          {c.evidence.map((e, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onCite(e.quote)}
              className={cn(
                "flex items-start gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-cite/60",
                activeQuote === e.quote && "bg-cite-strong/60"
              )}
              title="Show in source document"
            >
              <Quote className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="italic">{e.quote}</span>
                {e.docTitle && <span className="ml-1.5 text-muted-foreground not-italic">· {e.docTitle}</span>}
              </span>
              {!e.verified && (
                <span className="flex shrink-0 items-center gap-1 font-medium text-not-met">
                  <AlertTriangle className="size-3" /> not found in source
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {panel === "criterion" && (
        <div className="mt-1.5 ml-6 rounded-md bg-muted px-2.5 py-2 text-xs leading-relaxed">
          <p>{c.definition.description}</p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">Evidence needed:</span> {c.definition.evidenceRequired}
          </p>
        </div>
      )}

      {c.status === "missing" && (
        <p className="mt-2 pl-6 text-xs text-muted-foreground">
          Not addressed in the submission. A Request for Information could resolve this.
        </p>
      )}
      {c.needsReview && (
        <p className="mt-2 flex items-center gap-1 pl-6 text-xs font-medium text-not-met">
          <AlertTriangle className="size-3" /> Flagged for reviewer attention
        </p>
      )}
    </div>
  );
}

function PanelToggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
        open && "bg-muted text-foreground"
      )}
    >
      {children}
      <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
    </button>
  );
}
