// Given a raw spec from the LLM (already parsed against ChartSpecSchema) and
// the loaded catalogue, return either { ok: true, spec } or { ok: false,
// reason } so the chat endpoint can ship a user-readable explanation back.
//
// Validation goals:
//   1. Every requested parameter_code exists in the catalogue.
//   2. The period exists.
//   3. If granularity = "monthly", at least one of the requested codes must
//      be monthly-derivable (is_monthly input OR a calculated output — those
//      can derive month-by-month if any dependency is monthly).
//   4. Data actually exists for the period — we don't validate this here
//      because the empty-series case is handled by the renderer
//      ("No data for this period"), and the LLM's catalogue context tells it
//      about parameters but not about whether values were entered. Hitting
//      the DB to check data presence per request would slow this down for
//      marginal benefit; the renderer's empty state is the safety net.

import type { ChartSpec } from "@/lib/dashboard/chart-spec";
import type { DashboardCatalogue } from "@/lib/dashboard/catalogue";
import { findParam, findPeriod } from "@/lib/dashboard/catalogue";

export type ValidationResult =
  | { ok: true; spec: ChartSpec }
  | { ok: false; reason: string; missing_codes?: string[] };

export function validateSpec(spec: ChartSpec, cat: DashboardCatalogue): ValidationResult {
  if (!findPeriod(cat, spec.period_code)) {
    const available = cat.periods.map(p => p.code).join(", ");
    return { ok: false, reason: `Period "${spec.period_code}" doesn't exist. Available: ${available || "(none)"}` };
  }

  const missing: string[] = [];
  for (const code of spec.parameter_codes) {
    if (!findParam(cat, code)) missing.push(code);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Unknown parameter code${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
      missing_codes: missing,
    };
  }

  if (spec.granularity === "monthly") {
    const anyMonthlyAvailable = spec.parameter_codes.some(code => {
      const p = findParam(cat, code)!;
      // Inputs need is_monthly true. Calculated outputs *might* be monthly-
      // derivable; we let the renderer's empty state handle the case where
      // the evaluator can't produce monthly values.
      return p.is_monthly || p.is_calculated;
    });
    if (!anyMonthlyAvailable) {
      return {
        ok: false,
        reason: "Requested monthly view, but none of the selected parameters have monthly data. Try granularity \"annual\" instead.",
      };
    }
  }

  return { ok: true, spec };
}
