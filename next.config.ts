import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Criteria sets are data files read at runtime; make sure they ship with the deploy.
  outputFileTracingIncludes: {
    "/api/match-criteria": ["./data/criteria/**/*"],
    "/workbench/[caseId]": ["./data/criteria/**/*"],
    "/criteria": ["./data/criteria/**/*"],
    "/": ["./data/criteria/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
