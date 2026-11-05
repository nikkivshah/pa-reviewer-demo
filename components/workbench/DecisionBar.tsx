"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileQuestion, Gavel, ShieldAlert, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MatchResponse, ReviewerAction } from "@/lib/pipeline-types";

export type Decision = {
  action: ReviewerAction;
  note: string;
  physicianSignoff?: string;
  criteriaCited?: string[];
  timestamp: string;
};

export const ACTIONS: Record<
  ReviewerAction,
  { label: string; icon: typeof CheckCircle2; past: string; title: string; description: string }
> = {
  approve: {
    label: "Approve",
    icon: CheckCircle2,
    past: "Approved",
    title: "Approve this request",
    description: "The provider will be notified through the original intake channel.",
  },
  request_info: {
    label: "Request info",
    icon: FileQuestion,
    past: "Information requested",
    title: "Request additional information",
    description: "Sent to the requesting provider. The TAT clock rules for pended cases apply.",
  },
  escalate: {
    label: "Escalate to MD",
    icon: UserRoundCog,
    past: "Escalated to medical director",
    title: "Escalate to a medical director",
    description: "Routes the case, with the AI summary and your note, to the physician review queue.",
  },
  deny: {
    label: "Deny",
    icon: Gavel,
    past: "Denied",
    title: "Clinician-authored denial",
    description:
      "The AI does not draft denials. Write the clinical rationale in your own words. It is sent to the provider and member with the specific criteria not met.",
  },
};

function defaultNote(action: ReviewerAction, match: MatchResponse | null) {
  if (!match) return "";
  const missing = match.criteria.filter((c) => c.status === "missing");
  if (action === "request_info" && missing.length) {
    return `To complete review of this request, please provide:\n${missing
      .map((c) => `- ${c.title}: ${c.definition.evidenceRequired}`)
      .join("\n")}`;
  }
  if (action === "escalate") {
    const gaps = match.criteria.filter((c) => c.status !== "met");
    return gaps.length
      ? `Requesting physician review. Criteria not satisfied: ${gaps.map((c) => c.criterionId).join(", ")}.`
      : "Requesting physician review.";
  }
  return ""; // Approve note is optional; Deny must be written by the clinician from scratch.
}

export function DecisionBar({
  match,
  decision,
  onDecide,
  reviewer,
  nextCaseId,
}: {
  match: MatchResponse | null;
  decision: Decision | null;
  onDecide: (d: Decision) => void;
  reviewer: string;
  nextCaseId: string | null;
}) {
  const [open, setOpen] = useState<ReviewerAction | null>(null);
  const [note, setNote] = useState("");
  const [signoff, setSignoff] = useState("");
  const [attested, setAttested] = useState(false);
  const [cited, setCited] = useState<string[]>([]);

  function start(action: ReviewerAction) {
    setNote(defaultNote(action, match));
    setSignoff("");
    setAttested(false);
    setCited(action === "deny" && match ? match.criteria.filter((c) => c.status === "not_met").map((c) => c.criterionId) : []);
    setOpen(action);
  }

  const denyValid = note.trim().length >= 40 && signoff.trim().length > 0 && attested && cited.length > 0;
  const canSubmit =
    open === "deny" ? denyValid : open === "request_info" || open === "escalate" ? note.trim().length > 0 : true;

  function submit() {
    if (!open) return;
    onDecide({
      action: open,
      note: note.trim(),
      physicianSignoff: open === "deny" ? signoff.trim() : undefined,
      criteriaCited: open === "deny" ? cited : undefined,
      timestamp: new Date().toISOString(),
    });
    setOpen(null);
  }

  const aiAction = match?.recommendation.action;

  if (decision) {
    const meta = ACTIONS[decision.action];
    const agreed =
      aiAction &&
      ((aiAction === "approve" && decision.action === "approve") ||
        (aiAction === "escalate" && decision.action !== "approve"));
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <meta.icon className="size-4 text-primary" />
          <span className="font-medium">{meta.past}</span>
          <span className="text-muted-foreground">
            by {reviewer} · {new Date(decision.timestamp).toLocaleTimeString()}
          </span>
          {aiAction && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                agreed ? "bg-met-soft text-met" : "bg-missing-soft text-missing-ink"
              )}
            >
              {agreed ? "Consistent with AI" : "Reviewer override"} (logged)
            </span>
          )}
        </div>
        {nextCaseId ? (
          <Link
            href={`/workbench/${nextCaseId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Next case <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            Back to queue
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5" />
          Every determination is made by a licensed clinician. Your action is recorded in the audit trail.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => start("approve")}>
            <CheckCircle2 /> Approve
          </Button>
          <Button variant="outline" onClick={() => start("request_info")}>
            <FileQuestion /> Request info
          </Button>
          <Button variant="outline" onClick={() => start("escalate")}>
            <UserRoundCog /> Escalate to MD
          </Button>
          <Button variant="destructive" onClick={() => start("deny")}>
            <Gavel /> Deny
          </Button>
        </div>
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{ACTIONS[open].title}</DialogTitle>
              <DialogDescription>{ACTIONS[open].description}</DialogDescription>
            </DialogHeader>

            {open === "deny" && match && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-xs font-medium">Criteria not met (cited in the notice)</legend>
                {match.criteria
                  .filter((c) => c.status !== "met")
                  .map((c) => (
                    <label key={c.criterionId} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={cited.includes(c.criterionId)}
                        onChange={(e) =>
                          setCited((prev) =>
                            e.target.checked ? [...prev, c.criterionId] : prev.filter((x) => x !== c.criterionId)
                          )
                        }
                      />
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">{c.criterionId}</span> {c.title}{" "}
                        <span className="text-xs text-muted-foreground">({c.status.replace("_", " ")})</span>
                      </span>
                    </label>
                  ))}
              </fieldset>
            )}

            <label className="flex flex-col gap-1.5 text-xs font-medium">
              {open === "deny"
                ? "Clinical rationale (written by you, min. 40 characters)"
                : open === "approve"
                  ? "Note (optional)"
                  : "Message"}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={open === "deny" ? 5 : 4}
                placeholder={open === "deny" ? "Explain, in your own clinical judgment, why this request is not medically necessary…" : ""}
                className="rounded-md border bg-background p-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </label>

            {open === "deny" && (
              <>
                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  Physician reviewer sign-off (adverse medical necessity decisions require physician review)
                  <input
                    value={signoff}
                    onChange={(e) => setSignoff(e.target.value)}
                    placeholder="e.g. A. Patel, MD"
                    className="h-8 rounded-md border bg-background px-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </label>
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
                  I attest this determination reflects independent clinical judgment by a licensed clinician and was not
                  made by the AI.
                </label>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button
                disabled={!canSubmit}
                onClick={submit}
                variant={open === "deny" ? "destructive" : "default"}
                              >
                {open === "deny" ? "Issue denial" : `Confirm: ${ACTIONS[open].label}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
