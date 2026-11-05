import { ShieldCheck } from "lucide-react";

// Visual reminder of the PHI containment boundary from the architecture diagram.
export function PHIBoundaryBadge() {
  return (
    <div
      className="group relative inline-flex items-center gap-1.5 rounded-full border border-met/30 bg-met-soft px-2.5 py-1 text-xs font-medium text-met"
      title="BAA in place · Encrypted at rest and in transit · No training on customer data · All access logged · Synthetic data only"
    >
      <ShieldCheck className="size-3.5" />
      PHI boundary: secure
      <span className="text-met/70">· synthetic data</span>
    </div>
  );
}
