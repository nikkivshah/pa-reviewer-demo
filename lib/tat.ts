// Turnaround-time (TAT) rules per line of business and priority.
// Medicare Advantage, per CMS-0057-F (effective Jan 1, 2026):
//   standard prior auth decisions within 7 calendar days, expedited within 72 hours.
// Phase 2 adds per-state Medicaid clocks here.

export type Priority = "standard" | "expedited";

export const TAT_RULES = {
  "Medicare Advantage": {
    standard: { hours: 7 * 24, label: "7 calendar days", source: "CMS-0057-F" },
    expedited: { hours: 72, label: "72 hours", source: "CMS-0057-F" },
  },
} as const;

export type LineOfBusiness = keyof typeof TAT_RULES;

// Pre-breach alert fires when this many hours or fewer remain.
export const AT_RISK_HOURS = 24;

export type TatState = "on_track" | "at_risk" | "breached";

export function tatStatus(lob: LineOfBusiness, priority: Priority, receivedAt: Date, now: Date) {
  const rule = TAT_RULES[lob][priority];
  const deadline = new Date(receivedAt.getTime() + rule.hours * 3600_000);
  const hoursLeft = (deadline.getTime() - now.getTime()) / 3600_000;
  const state: TatState = hoursLeft <= 0 ? "breached" : hoursLeft <= AT_RISK_HOURS ? "at_risk" : "on_track";
  const pctElapsed = Math.min(100, Math.max(0, ((rule.hours - hoursLeft) / rule.hours) * 100));
  return { rule, deadline, hoursLeft, state, pctElapsed };
}

export function formatHoursLeft(hoursLeft: number) {
  if (hoursLeft <= 0) return `Breached ${formatDuration(-hoursLeft)} ago`;
  return `${formatDuration(hoursLeft)} left`;
}

function formatDuration(h: number) {
  const d = Math.floor(h / 24);
  const hrs = Math.floor(h % 24);
  const m = Math.floor((h * 60) % 60);
  if (d > 0) return `${d}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${m}m`;
  return `${m}m`;
}
