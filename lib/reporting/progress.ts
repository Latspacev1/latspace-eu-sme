// Computes a 0-100 completion percentage for a framework by reading whatever
// the framework persists to localStorage:
//   • questionnaire frameworks (CDP, VSME Digital Template) — stored under
//     their `storageKey`. Same formula as the Questionnaire sidebar:
//     completed = 1.0, in-progress = 0.5, not-started = 0.0.
//   • qualitative frameworks (VSME Sustainability Report) — stored by the
//     qualitative editor under `qualitative-app/v1/<frameworkId>`. We count a
//     requirement as "done" when its response is non-empty.
//   • parents — average of their children's percentages.

import type { FrameworkDef } from "./frameworks";
import { readAnswers, type Answers } from "./storage";
import { storageKey as qualitativeKey } from "./qualitative/storage";
import type { QualitativeDoc, Response } from "./qualitative/types";

function questionnaireProgress(fw: FrameworkDef): number | null {
  if (!fw.storageKey || fw.sections.length === 0) return null;
  const answers: Answers = readAnswers(fw.storageKey);
  const allQuestions = fw.sections.flatMap((s) => s.questions);
  if (allQuestions.length === 0) return null;

  let completed = 0;
  let inProgress = 0;
  for (const q of allQuestions) {
    const a = answers[q.id];
    if (!a) continue;
    if (a.status === "completed") completed += 1;
    else if (a.status === "in-progress") inProgress += 1;
  }
  return Math.round(((completed + inProgress * 0.5) / allQuestions.length) * 100);
}

function isResponseFilled(r: Response | null | undefined): boolean {
  if (!r) return false;
  if (r.kind === "text") return r.value.trim().length > 0;
  if (r.kind === "number") return typeof r.value === "number" && !Number.isNaN(r.value);
  if (r.kind === "table") return r.rows.some((row) => row.some((cell) => cell.trim().length > 0));
  return false;
}

function qualitativeProgress(fw: FrameworkDef): number | null {
  if (fw.variant !== "qualitative") return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(qualitativeKey(fw.id));
    if (!raw) return 0;
    const doc = JSON.parse(raw) as QualitativeDoc;
    if (!doc.requirements || doc.requirements.length === 0) return 0;
    const done = doc.requirements.filter((r) => isResponseFilled(r.response)).length;
    return Math.round((done / doc.requirements.length) * 100);
  } catch {
    return 0;
  }
}

// Public — returns null when there's nothing to measure (parent with no
// measurable children, or a framework without sections/requirements yet).
export function getFrameworkProgress(fw: FrameworkDef): number | null {
  if (fw.isParent && fw.children) {
    const childPcts = fw.children
      .map((c) => getFrameworkProgress(c))
      .filter((p): p is number => p !== null);
    if (childPcts.length === 0) return null;
    return Math.round(childPcts.reduce((a, b) => a + b, 0) / childPcts.length);
  }
  if (fw.variant === "qualitative") return qualitativeProgress(fw);
  return questionnaireProgress(fw);
}
