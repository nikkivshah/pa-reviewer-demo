"use client";

import { useSyncExternalStore } from "react";
import { AlarmClock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHoursLeft, tatStatus, type LineOfBusiness, type Priority } from "@/lib/tat";

// Arrival times are relative to when the app first loads in this browser tab,
// so the clock reads the same every time the demo starts.
let demoEpoch: number | null = null;
function getEpoch() {
  if (demoEpoch === null) demoEpoch = Date.now();
  return demoEpoch;
}

// Shared ticking clock (one interval for every TatClock on the page).
let clockNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
function getClock() {
  if (clockNow === 0) clockNow = Date.now();
  return clockNow;
}
function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

export function receivedAtFor(hoursAgo: number) {
  return new Date(getEpoch() - hoursAgo * 3600_000);
}

export function TatClock({
  lob,
  priority,
  receivedHoursAgo,
  variant = "inline",
}: {
  lob: LineOfBusiness;
  priority: Priority;
  receivedHoursAgo: number;
  variant?: "inline" | "bar";
}) {
  const nowMs = useSyncExternalStore(subscribeClock, getClock, () => null);

  if (nowMs === null) return <span className="text-xs text-muted-foreground">…</span>;
  const now = new Date(nowMs);

  const s = tatStatus(lob, priority, receivedAtFor(receivedHoursAgo), now);
  const color =
    s.state === "breached" ? "text-not-met" : s.state === "at_risk" ? "text-missing" : "text-muted-foreground";
  const barColor = s.state === "breached" ? "bg-not-met" : s.state === "at_risk" ? "bg-missing" : "bg-met";
  const Icon = s.state === "on_track" ? Clock : AlarmClock;

  if (variant === "bar") {
    return (
      <div className="flex min-w-48 flex-col gap-1">
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", color)}>
          <Icon className="size-3.5" />
          {formatHoursLeft(s.hoursLeft)}
          {s.state === "at_risk" && <span className="rounded bg-missing-soft px-1.5 py-0.5">Pre-breach alert</span>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${s.pctElapsed}%` }} />
        </div>
        <div className="text-[11px] text-muted-foreground">
          {s.rule.label} {priority} · {s.rule.source}
        </div>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", color)}>
      <Icon className="size-4" />
      {formatHoursLeft(s.hoursLeft)}
    </span>
  );
}
