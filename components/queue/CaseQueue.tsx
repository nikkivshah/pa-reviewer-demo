"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Globe, Printer } from "lucide-react";
import { TatClock } from "@/components/TatClock";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ACTIONS } from "@/components/workbench/DecisionBar";
import { REVIEWER, useCaseOutcomes } from "@/lib/audit-store";
import type { ReviewerAction } from "@/lib/pipeline-types";
import type { SyntheticCase } from "@/lib/synthetic-cases";
import { AT_RISK_HOURS, TAT_RULES } from "@/lib/tat";

export type QueueRow = Omit<SyntheticCase, "expected"> & { criteriaLabel: string };

export function CaseQueue({ rows }: { rows: QueueRow[] }) {
  const outcomes = useCaseOutcomes();
  const open = rows.filter((c) => !outcomes[c.id]);
  const done = rows
    .filter((c) => outcomes[c.id])
    .sort((a, b) => outcomes[b.id].timestamp.localeCompare(outcomes[a.id].timestamp));

  const atRisk = open.filter(
    (c) => TAT_RULES[c.lineOfBusiness][c.priority].hours - c.receivedHoursAgo <= AT_RISK_HOURS
  ).length;
  const fax = open.filter((c) => c.intakeChannel === "fax").length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open cases" value={String(open.length)} hint="Medicare Advantage · outpatient" />
        <Stat
          label="Pre-breach alerts"
          value={String(atRisk)}
          hint={`Under ${AT_RISK_HOURS}h left on the CMS-0057-F clock`}
          tone={atRisk > 0 ? "warn" : undefined}
        />
        <Stat label="Completed" value={String(done.length)} hint={`${fax} fax · ${open.length - fax} portal still open`} />
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
        {open.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <CheckCircle2 className="size-6 text-met" />
            <div className="font-medium">Queue clear</div>
            <p className="text-sm text-muted-foreground">
              All {rows.length} cases have a determination. To run the demo again, use Reset demo data on the{" "}
              <Link href="/audit" className="font-medium text-primary hover:underline">
                audit log
              </Link>
              .
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Case</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Requested service</th>
                <th className="px-4 py-3 font-medium">Intake</th>
                <th className="px-4 py-3 font-medium">TAT clock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {open.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-4">
                    <div className="font-mono text-xs font-medium">{c.id}</div>
                    <Badge variant="outline" className="mt-1 capitalize">
                      {c.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium">{c.patientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.age}
                      {c.sex} · {c.memberId}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>{c.requestedService}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.requestingProvider} · {c.documents.length} docs
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.criteriaLabel}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {c.intakeChannel === "fax" ? <Printer className="size-4" /> : <Globe className="size-4" />}
                      {c.intakeChannel === "fax" ? "Fax (OCR)" : "Provider portal"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <TatClock
                      lob={c.lineOfBusiness}
                      priority={c.priority}
                      receivedHoursAgo={c.receivedHoursAgo}
                      variant="bar"
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link href={`/workbench/${c.id}`} className={buttonVariants({ size: "sm" })}>
                      Open case <ArrowRight />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Completed · {done.length}
          </h2>
          <ul className="divide-y rounded-xl bg-card ring-1 ring-border">
            {done.map((c) => {
              const e = outcomes[c.id];
              const action = e.data?.action as ReviewerAction | undefined;
              const meta = action ? ACTIONS[action] : null;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                  <span className="font-medium">{c.patientName}</span>
                  <span className="flex items-center gap-1.5">
                    {meta && <meta.icon className="size-4 text-primary" />}
                    {meta?.past ?? e.event.replace("Determination: ", "")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    by {e.actor ?? REVIEWER} · {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                  <Link
                    href={`/workbench/${c.id}`}
                    className="ml-auto text-sm font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "warn" }) {
  return (
    <div
      className={
        "rounded-xl p-5 ring-1 " + (tone === "warn" ? "bg-missing-soft ring-missing/40" : "bg-card ring-border")
      }
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-heading text-4xl font-light tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}
