// Derivable VSME fill targets — the numeric VSME Digital Template cells the
// "Fill with AI" agent may compute from the org's measured input data points.
//
// Source of truth for the cell addresses is `lib/reporting/vsmeExport/map.ts`
// (the same FieldBindings that drive the workbook export). We do NOT target
// every numeric cell: entity facts (turnover, headcount), qualitative text,
// booleans, dates and table rows are not formula-derivable from environmental
// inputs. Instead we keep an explicit allow-list of (questionId, fieldId) pairs
// that ARE derivable, each with a short methodology hint for the agent.
//
// Each entry is resolved against the bindings to get the concrete vsme_cell and
// against vsmeSections for the question/section labels, so the addresses never
// drift from the export map.

import { bindings, type FieldBinding } from "./vsmeExport/map";
import { sections as vsmeSections } from "./vsmeSections";

export interface VsmeFillTarget {
  vsme_cell: string; // "<Sheet>!<Cell>"
  question_id: string;
  question_label: string;
  section_id: string;
  section_title: string;
  field_id: string;
  methodology_hint?: string;
}

// Allow-list of derivable field bindings keyed by `${questionId}.${fieldId}`,
// with a methodology hint passed to the agent. Scope = the quantitative
// environmental disclosures (B3 energy/GHG, B4 pollution gate is textual so
// excluded, B5 land use, B6 water, B7 waste totals). Extend as new derivable
// metrics are modelled.
const DERIVABLE: Record<string, string> = {
  // B3 — Energy
  "B3.energyTotal.total": "Total energy consumption for the period (electricity + self-generated + fuels), in MWh.",
  "B3.energyBreakdown.electricity": "Purchased electricity consumption, in MWh.",
  "B3.energyBreakdown.selfGenerated": "Self-generated renewable energy consumed, in MWh.",
  "B3.energyBreakdown.fuels": "Energy from fuels combusted, in MWh.",
  // B3 — GHG scopes (tCO2e)
  "B3.scopes.scope1": "Gross Scope 1 GHG emissions = sum of (fuel/activity quantity × its emission factor), in tCO2e.",
  "B3.scopes.scope2Location": "Location-based Scope 2 = purchased electricity × location-based grid emission factor, in tCO2e.",
  "B3.scopes.scope2Market": "Market-based Scope 2 = purchased electricity × supplier/market emission factor, in tCO2e.",
  // B3 — Scope 3 categories (tCO2e)
  "B3.scope3.cat1": "Scope 3 Cat 1 (purchased goods & services) = activity × emission factor, tCO2e.",
  "B3.scope3.cat2": "Scope 3 Cat 2 (capital goods), tCO2e.",
  "B3.scope3.cat3": "Scope 3 Cat 3 (fuel- and energy-related activities), tCO2e.",
  "B3.scope3.cat4": "Scope 3 Cat 4 (upstream transportation & distribution), tCO2e.",
  "B3.scope3.cat5": "Scope 3 Cat 5 (waste generated in operations), tCO2e.",
  "B3.scope3.cat6": "Scope 3 Cat 6 (business travel), tCO2e.",
  "B3.scope3.cat7": "Scope 3 Cat 7 (employee commuting), tCO2e.",
  "B3.scope3.cat8": "Scope 3 Cat 8 (upstream leased assets), tCO2e.",
  "B3.scope3.cat9": "Scope 3 Cat 9 (downstream transportation & distribution), tCO2e.",
  "B3.scope3.cat10": "Scope 3 Cat 10 (processing of sold products), tCO2e.",
  "B3.scope3.cat11": "Scope 3 Cat 11 (use of sold products), tCO2e.",
  "B3.scope3.cat12": "Scope 3 Cat 12 (end-of-life treatment of sold products), tCO2e.",
  "B3.scope3.cat13": "Scope 3 Cat 13 (downstream leased assets), tCO2e.",
  "B3.scope3.cat14": "Scope 3 Cat 14 (franchises), tCO2e.",
  "B3.scope3.cat15": "Scope 3 Cat 15 (investments), tCO2e.",
  // B5 — Land use (area unit)
  "B5.landUse.sealedArea": "Total sealed/impermeable surface area.",
  "B5.landUse.natureOnSite": "Total nature-oriented area on site.",
  "B5.landUse.natureOffSite": "Total nature-oriented area off site.",
  "B5.landUse.totalLandUse": "Total land use = sealed + nature on-site (+ other used areas).",
  // B6 — Water (m3)
  "B6.withdrawal.totalWithdrawn": "Total water withdrawal across all sources, in m3.",
  "B6.withdrawal.highStressWithdrawn": "Water withdrawn in areas of high water stress, in m3.",
  "B6.consumption.discharge": "Total water discharge, in m3.",
  // B7 — (totals are handled via the waste table; no single derivable field here in v1)
};

let cache: VsmeFillTarget[] | null = null;

function buildTargets(): VsmeFillTarget[] {
  // Index FieldBindings by questionId.fieldId for O(1) lookup.
  const fieldBindings = new Map<string, FieldBinding>();
  for (const b of bindings) {
    if (b.kind === "field") fieldBindings.set(`${b.questionId}.${b.fieldId}`, b);
  }

  const out: VsmeFillTarget[] = [];
  for (const [key, hint] of Object.entries(DERIVABLE)) {
    const b = fieldBindings.get(key);
    if (!b) continue; // binding removed/renamed — skip rather than emit a bad cell
    const section = vsmeSections.find((s) => s.questions.some((q) => q.id === b.questionId));
    const question = section?.questions.find((q) => q.id === b.questionId);
    if (!section || !question) continue;
    out.push({
      vsme_cell: `${b.sheet}!${b.cell}`,
      question_id: b.questionId,
      question_label: question.label,
      section_id: section.id,
      section_title: section.title,
      field_id: b.fieldId,
      methodology_hint: hint,
    });
  }
  return out;
}

/** All derivable VSME fill targets (cached). */
export function getVsmeFillTargets(): VsmeFillTarget[] {
  if (!cache) cache = buildTargets();
  return cache;
}
