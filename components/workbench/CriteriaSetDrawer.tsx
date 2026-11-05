"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, CircleDashed, CircleMinus, CircleSlash } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ChainStep } from "@/lib/criteria";
import { cn } from "@/lib/utils";
import type { MatchResponse, WorkbenchCriteria } from "@/lib/pipeline-types";
import { STATUS_META } from "./CriterionCard";

const STEP_META: Record<ChainStep["outcome"], { icon: typeof CheckCircle2; label: string; className: string }> = {
  selected: { icon: CheckCircle2, label: "Applied", className: "text-met" },
  not_fully_established: { icon: CircleMinus, label: "Not fully established", className: "text-missing-ink" },
  no_match: { icon: CircleSlash, label: "No match", className: "text-muted-foreground" },
  not_reached: { icon: CircleDashed, label: "Not needed", className: "text-muted-foreground" },
};

export function CriteriaSetDrawer({
  open,
  onOpenChange,
  resolution,
  match,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolution: WorkbenchCriteria;
  match: MatchResponse | null; // null while running or in shadow mode: definitions only
}) {
  const set = resolution.selected;
  const check = match?.selection.serviceCheck;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="size-4" /> {set ? `${set.name} · ${set.version}` : "No criteria set applies"}
          </SheetTitle>
          <SheetDescription>
            {set
              ? "The full criteria this request is judged against. Chosen by rules, not by the AI. The AI only evaluates them."
              : "No set in the library covers this service. The reviewer selects criteria manually."}
          </SheetDescription>
          <div>
            <Link href="/criteria" className={buttonVariants({ variant: "ghost", size: "xs" })}>
              <ArrowUpRight /> Open criteria library
            </Link>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            How this set was chosen
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Request: CPT {resolution.matchedOn.cptCode} · {resolution.matchedOn.lineOfBusiness} · submitted{" "}
            {resolution.matchedOn.asOf}. Sources are checked in priority order.
          </p>
          <ol className="flex flex-col gap-1.5">
            {resolution.chain.map((step, i) => {
              const meta = STEP_META[step.outcome];
              return (
                <li key={step.tier} className="flex gap-2.5 rounded-lg border p-2.5">
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2">
                      <span className="font-medium">{step.tierLabel}</span>
                      <span className={cn("flex items-center gap-1 text-xs font-medium", meta.className)}>
                        <meta.icon className="size-3.5" /> {meta.label}
                      </span>
                    </div>
                    {step.setId && (
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {step.setId} {step.version}
                      </div>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.reason}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {check && (
            <p
              className={cn(
                "mt-2 flex items-center gap-1.5 text-xs font-medium",
                check.consistent ? "text-met" : "text-not-met"
              )}
            >
              {check.consistent ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              {check.consistent
                ? `Documents also request CPT ${check.requestCpt}. Service and criteria are consistent.`
                : `Documents do not clearly request CPT ${check.requestCpt}. Confirm the service before deciding.`}
            </p>
          )}

          {set && (
            <>
              <dl className="mt-5 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Applies to</dt>
                <dd>
                  {set.serviceLabel} · CPT {set.cptCodes.join(", ")}
                </dd>
                <dt className="text-muted-foreground">Version</dt>
                <dd>
                  {set.version} · effective {set.effectiveFrom}
                  {set.effectiveTo ? ` to ${set.effectiveTo}` : " (current)"}
                </dd>
                <dt className="text-muted-foreground">Source</dt>
                <dd>{set.sourceName}</dd>
                <dt className="text-muted-foreground">Approval rule</dt>
                <dd>{set.approvalRule}</dd>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">{set.note}</p>

              <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Criteria ({set.criteria.length})
              </h3>
              <ol className="flex flex-col gap-2">
                {set.criteria.map((cr) => {
                  const result = match?.criteria.find((x) => x.criterionId === cr.id);
                  const meta = result ? STATUS_META[result.status] : null;
                  return (
                    <li key={cr.id} className={cn("rounded-lg border p-3", meta && `border-l-4 ${meta.border}`)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">
                          <span className="mr-1.5 font-mono text-xs text-muted-foreground">{cr.id}</span>
                          {cr.title}
                        </div>
                        {meta && (
                          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold", meta.bg, meta.text)}>
                            {meta.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed">{cr.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Evidence needed:</span> {cr.evidenceRequired}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
