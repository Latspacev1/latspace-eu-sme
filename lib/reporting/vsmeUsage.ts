// Runtime inversion of the VSME export bindings: given a `vsme_cell` value
// from the parameters table (formatted as "<Sheet>!<Cell>"), look up the
// in-app question this cell maps to so the Requirements tab can link
// directly to it.
//
// Source of truth is `lib/reporting/vsmeExport/map.ts` — the same bindings
// that drive the workbook export. We invert them on first call and cache.

import { bindings } from "./vsmeExport/map";
import { sections as vsmeSections } from "./vsmeSections";
import type { Question, Section } from "./frameworkTypes";

interface VsmeUsageEntry {
  questionId: string;
  questionLabel: string;
  sectionId: string;
  sectionTitle: string;
}

let cellIndex: Map<string, VsmeUsageEntry> | null = null;

function questionFor(questionId: string): { section: Section; question: Question } | null {
  for (const s of vsmeSections) {
    const q = s.questions.find((q) => q.id === questionId);
    if (q) return { section: s, question: q };
  }
  return null;
}

function buildIndex(): Map<string, VsmeUsageEntry> {
  const out = new Map<string, VsmeUsageEntry>();
  for (const b of bindings) {
    const found = questionFor(b.questionId);
    if (!found) continue;
    const entry: VsmeUsageEntry = {
      questionId: b.questionId,
      questionLabel: found.question.label,
      sectionId: found.section.id,
      sectionTitle: found.section.title,
    };
    if (b.kind === "field") {
      out.set(`${b.sheet}!${b.cell}`, entry);
    } else {
      // Table bindings span a range — we index each (col, row) up to maxRows
      // so an output that's pinned to e.g. ENV!G42 still resolves to the
      // question whose table writes column G.
      for (let i = 0; i < b.maxRows; i++) {
        const row = b.anchorRow + i * b.rowStride;
        for (const { col } of Object.values(b.columns)) {
          out.set(`${b.sheet}!${col}${row}`, entry);
        }
      }
    }
  }
  return out;
}

/**
 * Resolve a VSME workbook cell reference (e.g. "Environmental Disclosures!D42")
 * back to the in-app question that writes to it. Returns null if no binding
 * matches — the parameter is then "VSME-only" with no questionnaire usage.
 */
export function vsmeUsageForCell(vsmeCell: string | null): VsmeUsageEntry | null {
  if (!vsmeCell) return null;
  if (!cellIndex) cellIndex = buildIndex();
  return cellIndex.get(vsmeCell) ?? null;
}
