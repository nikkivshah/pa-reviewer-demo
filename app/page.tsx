import Link from "next/link";
import { FileText } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CaseQueue, type QueueRow } from "@/components/queue/CaseQueue";
import { loadCriteriaLibrary, resolveForRequest } from "@/lib/criteria-repo";
import { SYNTHETIC_CASES } from "@/lib/synthetic-cases";

export default function CaseQueuePage() {
  // Most urgent first: whoever has been waiting longest relative to their clock.
  // Criteria are resolved here on the server; QA-only expectations never reach the browser.
  const rows: QueueRow[] = [...SYNTHETIC_CASES]
    .sort((a, b) => b.receivedHoursAgo - a.receivedHoursAgo)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ expected, ...c }) => {
      const sel = resolveForRequest({ cptCode: c.cptCode, lineOfBusiness: c.lineOfBusiness, asOf: c.requestDate })
        .selected;
      return { ...c, criteriaLabel: sel ? `Criteria: ${sel.id} ${sel.version}` : "Criteria: manual selection" };
    });
  const library = loadCriteriaLibrary().sets;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-4xl font-light tracking-tight">My review queue</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Sorted by deadline. The AI pre-reads every case. You make every call.
          </p>
        </div>

        <CaseQueue rows={rows} />

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          Criteria library: {library.length} sets. Each case is matched by rule: Medicare coverage first, then
          commercial criteria, then plan policy, using the version in effect on the request date.{" "}
          <Link href="/criteria" className="font-medium text-primary hover:underline">
            View library
          </Link>
          . All cases are synthetic. No real PHI.
        </p>
      </main>
    </div>
  );
}
