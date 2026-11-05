import { cn } from "@/lib/utils";
import { THRESHOLDS } from "@/lib/schemas";

// Five-segment meter + percentage. Green at or above the recommendation threshold,
// amber between review and recommendation thresholds, red below the review threshold.
export function ConfidenceIndicator({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= THRESHOLDS.recommendationDisplay ? "met" : value >= THRESHOLDS.extractionReview ? "missing" : "not-met";
  const filled = Math.max(1, Math.round(value * 5));
  const label =
    tone === "met" ? "High confidence" : tone === "missing" ? "Moderate confidence" : "Low confidence, verify";

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums", className)}
      title={`${label} (${pct}%)`}
    >
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-1 rounded-sm",
              i < filled
                ? tone === "met"
                  ? "bg-met"
                  : tone === "missing"
                    ? "bg-missing"
                    : "bg-not-met"
                : "bg-foreground/10"
            )}
          />
        ))}
      </span>
      <span className={tone === "not-met" ? "text-not-met" : "text-muted-foreground"}>{pct}%</span>
    </span>
  );
}
