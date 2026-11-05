// Criteria library: file format, types, and the precedence rules for choosing a set.
// The data lives in data/criteria/*.json (one file per set, all versions inside).
// Loading and resolution happen on the server in lib/criteria-repo.ts.
//
// The set for a case is picked by deterministic rules, never by the AI.

import { z } from "zod";

export const TIERS = ["medicare_ncd_lcd", "commercial_criteria", "internal_policy"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  medicare_ncd_lcd: "Medicare coverage rules (NCD / LCD)",
  commercial_criteria: "Commercial criteria (MCG / InterQual)",
  internal_policy: "Plan internal medical policy",
};

// Order in which tiers are checked, per line of business. For Medicare Advantage,
// Medicare's own coverage rules come first (CMS-4201-F). Plan or commercial criteria
// are used only where Medicare criteria are not fully established.
export const PRECEDENCE: Record<string, Tier[]> = {
  "Medicare Advantage": ["medicare_ncd_lcd", "commercial_criteria", "internal_policy"],
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const CriterionDef = z.object({
  id: z.string().regex(/^[A-Z]+\d+$/, "IDs look like C1, H2, M1"),
  title: z.string().min(1),
  description: z.string().min(1),
  evidenceRequired: z.string().min(1),
});

const VersionDef = z
  .object({
    version: z.string().min(1),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable(),
    approvalRule: z.string().min(1),
    note: z.string(),
    criteria: z.array(CriterionDef).min(1),
  })
  .refine((v) => new Set(v.criteria.map((c) => c.id)).size === v.criteria.length, "Criterion IDs must be unique");

export const CriteriaFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tier: z.enum(TIERS),
  sourceName: z.string().min(1),
  serviceLabel: z.string().min(1),
  cptCodes: z.array(z.string()).min(1),
  linesOfBusiness: z.array(z.string()).min(1),
  setting: z.enum(["outpatient", "inpatient"]),
  coverage: z.object({ fullyEstablished: z.boolean(), gapReason: z.string().optional() }),
  versions: z.array(VersionDef).min(1),
  changeLog: z.array(
    z.object({ date: isoDate, version: z.string(), author: z.string(), approvedBy: z.string(), summary: z.string() })
  ),
});

export type CriteriaFile = z.infer<typeof CriteriaFileSchema>;
export type CriteriaVersion = CriteriaFile["versions"][number];
export type Criterion = CriteriaVersion["criteria"][number];

// One set at one version: what a case is actually judged against.
export type ResolvedCriteriaSet = Omit<CriteriaFile, "versions" | "changeLog"> & CriteriaVersion;

export type ChainStep = {
  tier: Tier;
  tierLabel: string;
  outcome: "selected" | "not_fully_established" | "no_match" | "not_reached";
  setId?: string;
  version?: string;
  reason: string;
};

export type CriteriaResolution = {
  matchedOn: { cptCode: string; lineOfBusiness: string; asOf: string };
  selected: ResolvedCriteriaSet | null; // null = reviewer selects criteria manually
  chain: ChainStep[];
};

export function versionInEffect(file: CriteriaFile, asOf: string): CriteriaVersion | null {
  return (
    file.versions.find((v) => v.effectiveFrom <= asOf && (v.effectiveTo === null || asOf <= v.effectiveTo)) ?? null
  );
}

// Walk the tiers in precedence order. Pure function, so it is easy to test and audit.
export function resolveCriteria(
  library: CriteriaFile[],
  req: { cptCode: string; lineOfBusiness: string; asOf: string }
): CriteriaResolution {
  const tiers = PRECEDENCE[req.lineOfBusiness] ?? [];
  const chain: ChainStep[] = [];
  let selected: ResolvedCriteriaSet | null = null;

  for (const tier of tiers) {
    const tierLabel = TIER_LABELS[tier];
    if (selected) {
      chain.push({ tier, tierLabel, outcome: "not_reached", reason: "A higher-priority set already applies." });
      continue;
    }
    const file = library.find(
      (f) => f.tier === tier && f.cptCodes.includes(req.cptCode) && f.linesOfBusiness.includes(req.lineOfBusiness)
    );
    if (!file) {
      chain.push({ tier, tierLabel, outcome: "no_match", reason: `Nothing in this tier covers CPT ${req.cptCode}.` });
      continue;
    }
    const version = versionInEffect(file, req.asOf);
    if (!version) {
      chain.push({
        tier,
        tierLabel,
        outcome: "no_match",
        setId: file.id,
        reason: `${file.id} has no version in effect on ${req.asOf}.`,
      });
      continue;
    }
    if (!file.coverage.fullyEstablished) {
      chain.push({
        tier,
        tierLabel,
        outcome: "not_fully_established",
        setId: file.id,
        version: version.version,
        reason: `${file.coverage.gapReason ?? "Criteria not fully established."} Next tier supplements it.`,
      });
      continue;
    }
    // Spread order matters: the version's fields win over file-level fields.
    const { versions: _v, changeLog: _c, ...meta } = file; // eslint-disable-line @typescript-eslint/no-unused-vars
    selected = { ...meta, ...version };
    chain.push({
      tier,
      tierLabel,
      outcome: "selected",
      setId: file.id,
      version: version.version,
      reason: `Covers CPT ${req.cptCode} for ${req.lineOfBusiness}. Version ${version.version} in effect since ${version.effectiveFrom}.`,
    });
  }

  return { matchedOn: req, selected, chain };
}
