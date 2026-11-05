import { CheckCircle2, EyeOff, ShieldAlert, Sparkles, UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { THRESHOLDS } from "@/lib/schemas";
import type { MatchResponse } from "@/lib/pipeline-types";
import { ConfidenceIndicator } from "./ConfidenceIndicator";

// The AI can only ever land in one of three states: ready to approve, escalate, or withheld.
// There is no denial state to render, because the pipeline cannot produce one.
export function RecommendationBanner({ rec }: { rec: MatchResponse["recommendation"] }) {
  if (!rec.displayed) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/60 p-4">
        <div className="flex items-center gap-2 font-medium">
          <EyeOff className="size-4" /> Recommendation withheld
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          AI confidence ({Math.round(rec.confidence * 100)}%) is below the{" "}
          {Math.round(THRESHOLDS.recommendationDisplay * 100)}% display threshold. Review the evidence breakdown below.
        </p>
      </div>
    );
  }

  const approve = rec.action === "approve";
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        approve ? "border-met/40 bg-met-soft" : "border-missing/50 bg-missing-soft"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ai">
            <Sparkles className="size-3" /> AI recommendation
          </div>
          <div
            className={cn(
              "mt-0.5 flex items-center gap-2 font-heading text-lg font-medium",
              approve ? "text-met" : "text-missing-ink"
            )}
          >
            {approve ? <CheckCircle2 className="size-5" /> : <UserRoundCheck className="size-5" />}
            {approve ? "Ready to approve" : "Escalate for clinician review"}
          </div>
        </div>
        <ConfidenceIndicator value={rec.confidence} />
      </div>
      <p className="mt-2 text-sm leading-relaxed">{rec.rationale}</p>
      {rec.guardrailApplied && (
        <p className="mt-2 text-xs font-medium text-not-met">
          Guardrail applied: model suggested approval but not every criterion is met, so the case was escalated.
        </p>
      )}
      <p className="mt-3 flex items-start gap-1.5 border-t border-foreground/10 pt-2.5 text-xs text-muted-foreground">
        <ShieldAlert className="mt-px size-3.5 shrink-0" />
        {approve
          ? "This is decision support. You make the final determination."
          : "The AI never recommends denial. Any adverse determination is authored by a licensed clinician."}
      </p>
    </div>
  );
}
