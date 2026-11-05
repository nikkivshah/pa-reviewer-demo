"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bot, Braces, Lock, ScrollText, Server, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AuditEvent } from "@/lib/pipeline-types";

export function AuditTrailDrawer({ events, caseId }: { events: AuditEvent[]; caseId: string }) {
  const [raw, setRaw] = useState(false);

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <ScrollText /> Audit trail
        <span className="rounded bg-muted px-1 text-xs tabular-nums">{events.length}</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Lock className="size-4" /> Audit trail · {caseId}
          </SheetTitle>
          <SheetDescription>
            Append-only record of every AI output and reviewer action: who, when, which model version, what confidence,
            and why. Supports appeals, audits, and regulator inquiries.
          </SheetDescription>
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" onClick={() => setRaw((r) => !r)}>
              <Braces /> {raw ? "Timeline view" : "Raw JSON export"}
            </Button>
            <Link href={`/audit?case=${caseId}`} className={buttonVariants({ variant: "ghost", size: "xs" })}>
              <ArrowUpRight /> Open full audit log
            </Link>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {raw ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(events, null, 2)}
            </pre>
          ) : (
            <ol className="relative flex flex-col gap-4 border-l pl-5">
              {events.map((e) => {
                const Icon = e.actor === "AI" ? Bot : e.actor === "System" ? Server : UserRound;
                return (
                  <li key={e.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[31px] grid size-5 place-items-center rounded-full border bg-card",
                        e.actor === "AI" && "border-ai bg-ai-soft text-ai",
                        e.actor !== "AI" && e.actor !== "System" && "border-met text-met"
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-medium">{e.event}</span>
                      <time className="font-mono text-[11px] text-muted-foreground">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </time>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.actor}
                      {e.model && ` · ${e.model}`}
                      {e.confidence !== undefined && ` · confidence ${Math.round(e.confidence * 100)}%`}
                    </div>
                    {e.detail && <p className="mt-1 text-sm whitespace-pre-wrap">{e.detail}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
