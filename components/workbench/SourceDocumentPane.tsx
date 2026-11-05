"use client";

import { useEffect, useMemo, useRef } from "react";
import { FileText, Globe, Printer, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { findQuote } from "@/lib/quotes";
import type { WorkbenchCase } from "@/lib/pipeline-types";
import type { DocumentKind } from "@/lib/synthetic-cases";

type Range = { start: number; end: number; active: boolean };

const KIND_ICON: Record<DocumentKind, typeof FileText> = {
  fax_cover: Printer,
  portal_form: Globe,
  referral_letter: FileText,
  encounter_note: Stethoscope,
};

export function SourceDocumentPane({
  c,
  activeDocId,
  onSelectDoc,
  citations,
  activeQuote,
}: {
  c: WorkbenchCase;
  activeDocId: string;
  onSelectDoc: (id: string) => void;
  citations: string[];
  activeQuote: string | null;
}) {
  const activeRef = useRef<HTMLElement | null>(null);
  const current = c.documents.find((d) => d.id === activeDocId) ?? c.documents[0];
  const doc = current.text;

  // How many AI citations point into each document (shown on the tabs).
  const citeCounts = useMemo(
    () =>
      Object.fromEntries(
        c.documents.map((d) => [d.id, new Set(citations.filter((q) => findQuote(d.text, q))).size])
      ) as Record<string, number>,
    [c.documents, citations]
  );

  const segments = useMemo(() => {
    const active = activeQuote ? findQuote(doc, activeQuote) : null;
    const ranges: Range[] = [];
    for (const q of citations) {
      const r = findQuote(doc, q);
      // The active highlight always wins: skip passive ranges that touch it.
      if (r && !(active && r.start < active.end && r.end > active.start)) ranges.push({ ...r, active: false });
    }
    if (active) ranges.push({ ...active, active: true });
    ranges.sort((a, b) => a.start - b.start);

    const kept: Range[] = [];
    for (const r of ranges) {
      const last = kept[kept.length - 1];
      if (last && r.start < last.end) {
        if (r.active) kept[kept.length - 1] = r; // only passive ranges can be "last" here
        continue;
      }
      kept.push(r);
    }

    const out: { text: string; kind: "plain" | "cite" | "active" }[] = [];
    let pos = 0;
    for (const r of kept) {
      if (r.start > pos) out.push({ text: doc.slice(pos, r.start), kind: "plain" });
      out.push({ text: doc.slice(r.start, r.end), kind: r.active ? "active" : "cite" });
      pos = r.end;
    }
    if (pos < doc.length) out.push({ text: doc.slice(pos), kind: "plain" });
    return out;
  }, [doc, citations, activeQuote]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeQuote, activeDocId]);

  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b bg-card px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          {c.intakeChannel === "fax" ? <Printer className="size-4" /> : <Globe className="size-4" />}
          Source packet
          <span className="font-normal text-muted-foreground">
            · {c.documents.length} documents · {c.intakeChannel === "fax" ? "Fax, OCR'd" : "Provider portal upload"}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <mark className="rounded-sm bg-cite px-1 text-foreground">cited</mark> by AI
        </span>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b bg-card px-3 pt-2">
        {c.documents.map((d) => {
          const Icon = KIND_ICON[d.kind];
          const selected = d.id === current.id;
          return (
            <button
              key={d.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onSelectDoc(d.id)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-xs",
                selected
                  ? "border-border bg-muted/50 font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {d.title}
              <span className="text-muted-foreground">· {d.date}</span>
              {citeCounts[d.id] > 0 && (
                <span className="rounded bg-cite px-1 text-[10px] font-medium text-foreground tabular-nums">
                  {citeCounts[d.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/50 p-4">
        <article className="mx-auto max-w-[72ch] rounded-md bg-white p-6 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-neutral-800 shadow-sm ring-1 ring-foreground/10">
          {segments.map((s, i) =>
            s.kind === "plain" ? (
              <span key={i}>{s.text}</span>
            ) : (
              <mark
                key={i}
                ref={s.kind === "active" ? activeRef : undefined}
                className={
                  s.kind === "active"
                    ? "rounded-sm bg-cite-strong text-neutral-900 ring-2 ring-cite-strong transition-colors"
                    : "rounded-sm bg-cite/60 text-inherit"
                }
              >
                {s.text}
              </mark>
            )
          )}
        </article>
      </div>
    </section>
  );
}
