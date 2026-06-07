// Client helper for the "Fill VSME report with AI" flow. POSTs to
// /api/reporting/fill and streams the agent's NDJSON events (activity / text /
// retrieved / fills / done / error). The route commits the agent's proposal
// server-side and returns the computed values in a `fills` event; the caller
// writes those into the questionnaire's localStorage answers.
//
// Goes through dashboardFetch so the Bearer token + X-Org-Id headers attach.

import { dashboardFetch } from "@/lib/dashboard/client-fetch";
import { readNdjson } from "@/lib/ndjson";

export interface FillResult {
  code: string;
  display_name: string;
  value: number | null;
  unit: string;
  vsme_cell: string | null;
  question_id: string;
  field_id: string;
  section_id: string;
  confidence?: number;
}

export interface FillsPayload {
  committed: { parameters: number; formulas: number };
  fills: FillResult[];
  skipped: { vsme_cell: string; reason: string }[];
  recalc: { formulas_evaluated: number; errors: { code: string; message: string }[] };
}

export interface FillEvent {
  event: string;
  data: unknown;
}

export async function fillVsmeReport(opts: {
  period?: string;
  filledFields?: { questionId: string; fieldId: string }[];
  onEvent: (ev: FillEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await dashboardFetch("/api/reporting/fill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ period: opts.period, filledFields: opts.filledFields ?? [] }),
    signal: opts.signal,
  });

  if (!res.ok && !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Fill request failed: HTTP ${res.status}`);
  }

  await readNdjson(res, opts.onEvent);
}
