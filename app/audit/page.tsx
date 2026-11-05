import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuditLog } from "@/components/audit/AuditLog";
import { SYNTHETIC_CASES } from "@/lib/synthetic-cases";

const CASES = SYNTHETIC_CASES.map((c) => ({ id: c.id, patientName: c.patientName }));

// Reads the ?case= filter. Wrapped in Suspense so the rest of the page can prerender.
async function AuditBody({ searchParams }: { searchParams: PageProps<"/audit">["searchParams"] }) {
  const { case: caseParam } = await searchParams;
  return <AuditLog cases={CASES} initialCase={typeof caseParam === "string" ? caseParam : "all"} />;
}

export default function AuditPage(props: PageProps<"/audit">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted">
      <AppHeader />
      <Suspense fallback={null}>
        <AuditBody searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
