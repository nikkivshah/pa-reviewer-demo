"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight, Download, Link2, Lock, RotateCcw, Server, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  appendAudit,
  auditEvent,
  hashChain,
  resetDemoAudit,
  REVIEWER,
  useAuditLog,
  type LoggedEvent,
} from "@/lib/audit-store";
import { cn } from "@/lib/utils";

type ActorFilter = "all" | "AI" | "reviewer" | "System";

function actorKind(e: LoggedEvent): Exclude<ActorFilter, "all"> {
  return e.actor === "AI" ? "AI" : e.actor === "System" ? "System" : "reviewer";
}

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: LoggedEvent[], hashes: Map<string, string>) {
  const cols = ["timestamp", "caseId", "actor", "event", "model", "confidence", "detail", "hash"] as const;
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    cols.join(","),
    ...rows.map((e) =>
      [e.timestamp, e.caseId, e.actor, e.event, e.model, e.confidence, e.detail, hashes.get(e.id)].map(cell).join(",")
    ),
  ].join("\n");
}

export function AuditLog({
  cases,
  initialCase,
}: {
  cases: { id: string; patientName: string }[];
  initialCase: string;
}) {
  const all = useAuditLog();
  const [caseFilter, setCaseFilter] = useState(initialCase);
  const [actor, setActor] = useState<ActorFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chain, setChain] = useState<{ forLength: number; hashes: Map<string, string> }>({
    forLength: -1,
    hashes: new Map(),
  });

  // Viewing the audit log is itself an access event.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    appendAudit(null, auditEvent({ actor: REVIEWER, event: "Audit log viewed", detail: `Filter: ${initialCase}` }));
  }, [initialCase]);

  // Hash chain over the full log, in order.
  useEffect(() => {
    let cancelled = false;
    hashChain(all).then((h) => {
      if (!cancelled) setChain({ forLength: all.length, hashes: new Map(all.map((e, i) => [e.id, h[i]])) });
    });
    return () => {
      cancelled = true;
    };
  }, [all]);
  const chainReady = chain.forLength === all.length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((e) => caseFilter === "all" || e.caseId === caseFilter)
      .filter((e) => actor === "all" || actorKind(e) === actor)
      .filter((e) => !q || `${e.event} ${e.detail ?? ""} ${e.actor}`.toLowerCase().includes(q))
      .slice()
      .reverse(); // newest first
  }, [all, caseFilter, actor, query]);

  const patientName = (id: string | null) => cases.find((c) => c.id === id)?.patientName;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-light tracking-tight">
            <Lock className="size-7 text-muted-foreground" /> Audit log
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Every AI output and every human action, across all cases, in order. This is the record compliance, appeals,
            and regulators pull from.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(
                `audit-log-${new Date().toISOString().slice(0, 10)}.json`,
                "application/json",
                JSON.stringify(rows.map((e) => ({ ...e, hash: chain.hashes.get(e.id) })), null, 2)
              )
            }
            disabled={rows.length === 0}
          >
            <Download /> Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv", toCsv(rows, chain.hashes))
            }
            disabled={rows.length === 0}
          >
            <Download /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm">
            <select
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
              className="h-8 rounded-md border bg-card px-2"
              aria-label="Filter by case"
            >
              <option value="all">All cases</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.patientName}
                </option>
              ))}
            </select>
            <div className="flex rounded-md border p-0.5">
              {(["all", "AI", "reviewer", "System"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setActor(a)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs capitalize",
                    actor === a ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a === "all" ? "All actors" : a}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events…"
              className="h-8 min-w-40 flex-1 rounded-md border bg-card px-2.5"
            />
            <span
              className={cn(
                "ml-auto flex items-center gap-1 text-xs font-medium",
                chainReady ? "text-met" : "text-muted-foreground"
              )}
            >
              <ShieldCheck className="size-3.5" />
              {chainReady ? `Hash chain intact · ${all.length} entries` : "Verifying chain…"}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              No events yet.{" "}
              <Link href="/" className="font-medium text-primary hover:underline">
                Open a case from the queue
              </Link>{" "}
              and every step will show up here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="w-6 px-2 py-2.5" />
                    <th className="px-3 py-2.5 font-medium">Time</th>
                    <th className="px-3 py-2.5 font-medium">Case</th>
                    <th className="px-3 py-2.5 font-medium">Actor</th>
                    <th className="px-3 py-2.5 font-medium">Event</th>
                    <th className="px-3 py-2.5 font-medium">Model · confidence</th>
                    <th className="px-3 py-2.5 font-medium">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const kind = actorKind(e);
                    const Icon = kind === "AI" ? Bot : kind === "System" ? Server : UserRound;
                    const open = expanded === e.id;
                    const hash = chain.hashes.get(e.id);
                    return (
                      <Fragment key={e.id}>
                        <tr
                          onClick={() => setExpanded(open ? null : e.id)}
                          className={cn("cursor-pointer border-b align-top hover:bg-muted/50", open && "bg-muted/50")}
                        >
                          <td className="px-2 py-2.5">
                            <ChevronRight
                              className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")}
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
                            {new Date(e.timestamp).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {e.caseId ? (
                              <Link
                                href={`/workbench/${e.caseId}`}
                                onClick={(ev) => ev.stopPropagation()}
                                className="font-mono text-xs hover:underline"
                              >
                                {e.caseId}
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">System-wide</span>
                            )}
                            {e.caseId && (
                              <div className="text-xs text-muted-foreground">{patientName(e.caseId)}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                                kind === "AI" && "bg-ai-soft text-ai",
                                kind === "reviewer" && "bg-met-soft text-met",
                                kind === "System" && "bg-muted text-muted-foreground"
                              )}
                            >
                              <Icon className="size-3" /> {e.actor}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{e.event}</div>
                            {e.detail && (
                              <div className={cn("text-xs text-muted-foreground", !open && "line-clamp-1")}>
                                {e.detail}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                            {e.model ?? "–"}
                            {e.confidence !== undefined && ` · ${Math.round(e.confidence * 100)}%`}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground" title={hash}>
                            {hash ? `${hash.slice(0, 8)}…` : "…"}
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b bg-muted/30">
                            <td />
                            <td colSpan={6} className="px-3 py-3">
                              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Link2 className="size-3" /> Full record · SHA-256 {hash}
                              </div>
                              <pre className="overflow-x-auto rounded-md bg-card p-3 font-mono text-[11px] leading-relaxed ring-1 ring-border">
                                {JSON.stringify(e, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3 self-start rounded-xl bg-card p-4 text-sm ring-1 ring-border">
          <h2 className="font-heading text-base font-medium">In production</h2>
          <Point title="Write-once storage">
            The server writes entries to append-only (WORM) storage inside the PHI boundary. Nobody can edit or delete
            them, including admins.
          </Point>
          <Point title="Tamper evidence">
            Each entry is hashed together with the one before it. Change any past entry and every hash after it breaks.
          </Point>
          <Point title="Who can see it">
            Reviewers see their own cases. Compliance, appeals, and QA see everything. Every view is itself logged, like
            the &quot;Audit log viewed&quot; entry here.
          </Point>
          <Point title="Retention">
            Kept for the Medicare Advantage record retention period (10 years), then disposed of under policy.
          </Point>
          <Point title="What it answers">
            For any determination: what the AI saw, what it said, which model and criteria version, who decided, and
            why. Exports feed appeals, CMS audits, and state AI-law inquiries.
          </Point>
          <p className="border-t pt-3 text-xs text-muted-foreground">
            Demo version: stored in this browser tab&apos;s session so it survives navigation and refresh.
          </p>
          <Button
            variant="ghost"
            size="xs"
            className="self-start text-muted-foreground"
            onClick={() => {
              if (window.confirm("Clear the demo audit log and saved AI results? (Demo only. Production logs cannot be cleared.)")) {
                resetDemoAudit();
                // Full reload also clears the in-memory AI result cache, so every case reruns fresh.
                window.location.reload();
              }
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
        </aside>
      </div>
    </main>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-medium">{title}</div>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
