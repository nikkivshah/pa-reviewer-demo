"use client";

// Demo audit log: one append-only list shared by every case, kept in sessionStorage
// so it survives navigation and refresh within a browser session.
//
// Production equivalent: write-once (WORM) storage inside the PHI boundary, written
// by the server, never editable by the browser. See the "In production" panel on /audit.

import { useMemo, useSyncExternalStore } from "react";
import type { AuditEvent } from "./pipeline-types";

export const REVIEWER = "Nikki Shah, RN";

export type LoggedEvent = AuditEvent & { caseId: string | null };

const KEY = "pa-demo-audit-v1";
const EMPTY: LoggedEvent[] = [];
let events: LoggedEvent[] | null = null;
const listeners = new Set<() => void>();
let seq = 0;

function load(): LoggedEvent[] {
  if (events) return events;
  try {
    events = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as LoggedEvent[];
  } catch {
    events = [];
  }
  return events;
}

function commit(next: LoggedEvent[]) {
  events = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage blocked: the log still works for this page view.
  }
  listeners.forEach((l) => l());
}

export function auditEvent(e: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }): AuditEvent {
  return { id: `evt-${Date.now()}-${seq++}`, timestamp: e.timestamp ?? new Date().toISOString(), ...e };
}

export function appendAudit(caseId: string | null, ...e: AuditEvent[]) {
  commit([...load(), ...e.map((x) => ({ ...x, caseId }))]);
}

export function hasCaseEvents(caseId: string) {
  return load().some((e) => e.caseId === caseId);
}

// Demo convenience only, so the log can start fresh before a presentation.
export function resetDemoAudit() {
  commit([]);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAuditLog(): LoggedEvent[] {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

// Latest reviewer determination per case. A case with one is off the open queue.
export function useCaseOutcomes(): Record<string, LoggedEvent> {
  const all = useAuditLog();
  return useMemo(() => {
    const out: Record<string, LoggedEvent> = {};
    for (const e of all) if (e.caseId && e.event.startsWith("Determination:")) out[e.caseId] = e;
    return out;
  }, [all]);
}

export function useCaseAudit(caseId: string): LoggedEvent[] {
  const all = useAuditLog();
  return useMemo(() => all.filter((e) => e.caseId === caseId), [all, caseId]);
}

// Tamper evidence: each entry's hash covers its content plus the previous hash,
// so editing or deleting any past entry breaks every hash after it.
export async function hashChain(list: LoggedEvent[]): Promise<string[]> {
  const out: string[] = [];
  let prev = "GENESIS";
  for (const e of list) {
    const bytes = new TextEncoder().encode(prev + JSON.stringify(e));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    prev = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    out.push(prev);
  }
  return out;
}
