import { AlertTriangle, CheckCircle2, ChevronRight, CircleMinus, FileJson, History } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { TIER_LABELS, TIERS } from "@/lib/criteria";
import { loadCriteriaLibrary } from "@/lib/criteria-repo";

export default function CriteriaLibraryPage() {
  const { sets, rejected } = loadCriteriaLibrary();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Criteria library</h1>
        </div>

        {rejected.length > 0 && (
          <section className="rounded-xl border border-not-met/40 bg-not-met-soft p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-not-met">
              <AlertTriangle className="size-4" /> {rejected.length} file(s) rejected and not in use
            </div>
            {rejected.map((r) => (
              <div key={r.file} className="mt-2">
                <div className="font-mono text-xs">{r.file}</div>
                <pre className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{r.error}</pre>
              </div>
            ))}
          </section>
        )}

        {/* Sets by tier */}
        {TIERS.map((tier) => {
          const inTier = sets.filter((s) => s.tier === tier);
          return (
            <section key={tier}>
              <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {TIER_LABELS[tier]} · {inTier.length} {inTier.length === 1 ? "set" : "sets"}
              </h2>
              {inTier.length === 0 && (
                <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border">
                  No sets in this tier yet.
                </p>
              )}
              <div className="flex flex-col gap-3">
                {inTier.map((s) => {
                  const versions = [...s.versions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
                  return (
                    <article key={s.id} className="rounded-xl bg-card p-5 ring-1 ring-border">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-heading text-xl font-normal tracking-tight">{s.name}</h3>
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{s.id}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">CPT {s.cptCodes.join(", ")}</Badge>
                          <Badge variant="outline">{s.linesOfBusiness.join(", ")}</Badge>
                          <Badge variant="outline" className="capitalize">
                            {s.setting}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{s.sourceName}</p>
                      <p className="mt-2 flex items-start gap-1.5 text-sm">
                        {s.coverage.fullyEstablished ? (
                          <>
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-met" /> Fully established: applied
                            directly when matched.
                          </>
                        ) : (
                          <>
                            <CircleMinus className="mt-0.5 size-4 shrink-0 text-missing-ink" />
                            <span>
                              Not fully established: {s.coverage.gapReason} The next tier supplements it.
                            </span>
                          </>
                        )}
                      </p>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Versions
                          </h4>
                          <div className="flex flex-col gap-1.5">
                            {versions.map((v) => (
                              <details key={v.version} className="group rounded-lg border">
                                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
                                  <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                                  <span className="font-medium">{v.version}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {v.effectiveFrom} to {v.effectiveTo ?? "present"} · {v.criteria.length} criteria
                                  </span>
                                  {v.effectiveTo === null ? (
                                    <span className="ml-auto rounded bg-met-soft px-1.5 py-0.5 text-xs font-medium text-met">
                                      Current
                                    </span>
                                  ) : (
                                    <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                      Retired
                                    </span>
                                  )}
                                </summary>
                                <div className="border-t px-3 py-2.5">
                                  <p className="text-xs text-muted-foreground">{v.approvalRule}</p>
                                  <ol className="mt-2 flex flex-col gap-2">
                                    {v.criteria.map((c) => (
                                      <li key={c.id} className="text-xs leading-relaxed">
                                        <span className="mr-1.5 font-mono text-muted-foreground">{c.id}</span>
                                        <span className="font-medium">{c.title}.</span> {c.description}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            <History className="size-3.5" /> Change log
                          </h4>
                          <ol className="flex flex-col gap-2 border-l pl-3">
                            {[...s.changeLog].reverse().map((ch) => (
                              <li key={ch.date + ch.version} className="text-xs">
                                <div className="flex flex-wrap gap-x-2">
                                  <span className="font-mono text-muted-foreground">{ch.date}</span>
                                  <span className="font-medium">{ch.version}</span>
                                </div>
                                <p className="mt-0.5">{ch.summary}</p>
                                <p className="mt-0.5 text-muted-foreground">
                                  By {ch.author} · approved by {ch.approvedBy}
                                </p>
                              </li>
                            ))}
                          </ol>
                          <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <FileJson className="size-3.5" /> data/criteria/{s.file}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
