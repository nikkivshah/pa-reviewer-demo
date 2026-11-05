import { notFound } from "next/navigation";
import { Workbench } from "@/components/workbench/Workbench";
import { resolveForRequest } from "@/lib/criteria-repo";
import { SYNTHETIC_CASES, getCase } from "@/lib/synthetic-cases";

// The demo has a fixed set of cases, so every workbench page is pre-built.
export function generateStaticParams() {
  return SYNTHETIC_CASES.map((c) => ({ caseId: c.id }));
}

export default async function WorkbenchPage(props: PageProps<"/workbench/[caseId]">) {
  const { caseId } = await props.params;
  const found = getCase(caseId);
  if (!found) notFound();

  // Strip QA-only expectations before anything reaches the browser.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { expected, ...c } = found;

  // Same order as the queue (most urgent first).
  const order = [...SYNTHETIC_CASES].sort((a, b) => b.receivedHoursAgo - a.receivedHoursAgo).map((x) => x.id);

  // Deterministic criteria resolution, done before any AI runs.
  const criteria = resolveForRequest({ cptCode: c.cptCode, lineOfBusiness: c.lineOfBusiness, asOf: c.requestDate });

  return <Workbench c={c} criteria={criteria} queueOrder={order} />;
}
