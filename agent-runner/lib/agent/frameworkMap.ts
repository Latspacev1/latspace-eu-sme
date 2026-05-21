// Maps the frontend's framework registry id (cdp, vsme, vsme-narrative) to the
// RAG framework key whose index we should query. CDP and VSME each have their
// own index; anything unknown defaults to VSME — keeps the route from 500-ing
// if a stray request comes through.

import type { Framework } from "../retrieval.ts";

export function resolveRagFramework(frameworkId: string | undefined | null): Framework {
  if (!frameworkId) return "vsme";
  const id = frameworkId.toLowerCase();
  if (id === "cdp") return "cdp";
  // vsme, vsme-narrative, and any other id default to the VSME index.
  return "vsme";
}
