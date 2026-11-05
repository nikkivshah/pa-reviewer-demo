import Link from "next/link";
import { PHIBoundaryBadge } from "@/components/workbench/PHIBoundaryBadge";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(115deg,#040145_0%,#0a0545_45%,#2a0a6f_80%,#4c1bb3_100%)] px-4 py-2.5 text-white sm:px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-brand-accent text-sm font-bold text-brand">PA</span>
          <span className="font-heading text-[15px] font-medium tracking-tight">Prior Auth Review Workbench</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-2 py-1 text-white/80 hover:bg-white/10 hover:text-white">
            Queue
          </Link>
          <Link href="/criteria" className="rounded-md px-2 py-1 text-white/80 hover:bg-white/10 hover:text-white">
            Criteria library
          </Link>
          <Link href="/audit" className="rounded-md px-2 py-1 text-white/80 hover:bg-white/10 hover:text-white">
            Audit log
          </Link>
        </nav>
        <span className="hidden text-sm text-white/60 lg:inline">
          Synthetic Health Plan · Medicare Advantage · Outpatient
        </span>
        {children}
      </div>
      <div className="flex items-center gap-3">
        <PHIBoundaryBadge />
        <div className="flex items-center gap-2 text-sm">
          <span className="grid size-7 place-items-center rounded-full bg-white/15 text-xs font-medium">NS</span>
          <span className="hidden text-white/80 sm:inline">Nikki Shah, RN</span>
        </div>
      </div>
    </header>
  );
}
