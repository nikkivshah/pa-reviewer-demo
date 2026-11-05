// Server-only: loads the criteria library from data/criteria/*.json and validates every file.
// Invalid files are rejected (fail closed) and reported on the /criteria page, never used.
//
// Production equivalent: a criteria service fed by the CMS coverage database, the licensed
// MCG / InterQual API, and a policy editor with an approval workflow.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CriteriaFileSchema, resolveCriteria, type CriteriaFile, type CriteriaResolution } from "./criteria";

const DIR = path.join(process.cwd(), "data", "criteria");

export type LibraryLoad = {
  sets: (CriteriaFile & { file: string })[];
  rejected: { file: string; error: string }[];
};

export function loadCriteriaLibrary(): LibraryLoad {
  const sets: LibraryLoad["sets"] = [];
  const rejected: LibraryLoad["rejected"] = [];
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort() : [];

  for (const file of files) {
    try {
      const parsed = CriteriaFileSchema.safeParse(JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")));
      if (!parsed.success) {
        rejected.push({ file, error: z.prettifyError(parsed.error) });
      } else if (sets.some((s) => s.id === parsed.data.id)) {
        rejected.push({ file, error: `Duplicate set id ${parsed.data.id}` });
      } else {
        sets.push({ ...parsed.data, file });
      }
    } catch (err) {
      rejected.push({ file, error: `Not valid JSON: ${String(err)}` });
    }
  }
  return { sets, rejected };
}

export function resolveForRequest(req: { cptCode: string; lineOfBusiness: string; asOf: string }): CriteriaResolution {
  return resolveCriteria(loadCriteriaLibrary().sets, req);
}
