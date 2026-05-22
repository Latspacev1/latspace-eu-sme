// Parameter catalogue loader — used by the LLM (as a cached system prompt
// block) and by the validator (to confirm requested codes exist).
//
// The catalogue is small (~200 rows) and changes only when migrations run,
// so we cache it in module scope per server instance for the lifetime of the
// process. A request can opt to bypass the cache with { fresh: true } when
// we know seed data just changed.

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Parameter, ReportingPeriod } from "@/lib/supabase/types";

export interface CatalogueRow {
  code: string;
  display_name: string;
  unit: string;
  section: string;
  vsme_cell: string | null;
  is_monthly: boolean;
  is_calculated: boolean;
}

export interface DashboardCatalogue {
  parameters: CatalogueRow[];
  periods: { code: string; label: string; is_current: boolean }[];
}

let cached: { at: number; value: DashboardCatalogue } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadCatalogue(opts: { fresh?: boolean } = {}): Promise<DashboardCatalogue> {
  if (!opts.fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const supabase = getSupabaseServiceClient();
  const [{ data: paramsData, error: pErr }, { data: periodsData, error: rErr }] = await Promise.all([
    supabase.from("parameters").select("code, display_name, unit, section, vsme_cell, is_monthly, is_calculated").order("display_order"),
    supabase.from("reporting_periods").select("code, label, is_current").order("start_date", { ascending: false }),
  ]);
  if (pErr) throw new Error(`catalogue parameters: ${pErr.message}`);
  if (rErr) throw new Error(`catalogue periods: ${rErr.message}`);

  const value: DashboardCatalogue = {
    parameters: (paramsData ?? []) as CatalogueRow[],
    periods: (periodsData ?? []) as Pick<ReportingPeriod, "code" | "label" | "is_current">[],
  };
  cached = { at: Date.now(), value };
  return value;
}

// Render the catalogue as compact text for the LLM system prompt. Kept terse
// — every kB here is cached but still counts against context.
export function catalogueToPrompt(cat: DashboardCatalogue): string {
  const lines: string[] = [];
  lines.push("# Available reporting periods");
  for (const p of cat.periods) {
    lines.push(`- ${p.code} — ${p.label}${p.is_current ? " (current)" : ""}`);
  }
  lines.push("");
  lines.push("# Parameter catalogue");
  lines.push("Each line: code | display_name | unit | section | monthly?");
  for (const r of cat.parameters) {
    lines.push(`- ${r.code} | ${r.display_name} | ${r.unit} | ${r.section} | ${r.is_monthly ? "monthly" : "annual-only"}`);
  }
  return lines.join("\n");
}

// Small helpers re-used by the validator.
export function findParam(cat: DashboardCatalogue, code: string): CatalogueRow | undefined {
  return cat.parameters.find(p => p.code === code);
}
export function findPeriod(cat: DashboardCatalogue, code: string) {
  return cat.periods.find(p => p.code === code);
}

// Also exposed for tests / debugging.
export type _CatalogueOnlyParam = Parameter;
