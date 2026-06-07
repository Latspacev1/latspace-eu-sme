// POST /api/reporting/fill
// Body: { period?: string, filledFields?: { questionId: string; fieldId: string }[] }
//
// Gathers the org's measured input catalogue + the derivable VSME target cells,
// dispatches the agent-runner in `fill` mode, and streams its NDJSON events to
// the browser. When the agent's `proposal` arrives, this route commits it
// server-side (output parameters + formulas), recalculates, reads back the
// computed values mapped to their VSME question/field, and emits a final
// `fills` event for the client to write into the localStorage answers.
//
// Fully automatic: no review gate. Values land as editable AI-filled answers.

import { NextRequest } from "next/server";
import { dispatch } from "@/lib/dispatcher";
import { resolveRagFramework } from "@/lib/dispatcher/frameworks";
import { resolveOrgId } from "@/lib/dashboard/auth";
import { invalidateCatalogue } from "@/lib/dashboard/catalogue";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getOrgBusinessContext } from "@/lib/reporting/orgContext";
import { getVsmeFillTargets } from "@/lib/reporting/vsmeFillTargets";
import {
  commitFillProposal,
  CommitError,
  type FillProposal,
} from "@/lib/metrics/commitProposal";
import type { DataPoint, Formula, Parameter } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// See chat/route.ts for the 800 s rationale (Pro Fluid Compute streaming cap).
export const maxDuration = 800;

interface FilledField {
  questionId: string;
  fieldId: string;
}

interface FillRequest {
  period?: string;
  filledFields?: FilledField[];
}

function ndjson(event: string, data: unknown): string {
  return JSON.stringify({ event, data }) + "\n";
}

function ndjsonError(message: string, status = 400): Response {
  return new Response(ndjson("error", { message }), {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

export async function POST(req: NextRequest) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return ndjsonError("Not authenticated", 401);

  let body: FillRequest = {};
  try {
    body = (await req.json()) as FillRequest;
  } catch {
    // empty body is fine — defaults to current period, no occupancy hints
  }

  const framework = resolveRagFramework(undefined); // VSME-only feature in v1
  const supabase = getSupabaseServiceClient();

  // 1. Resolve the period (requested code or the org's current period).
  const periodQuery =
    body.period && body.period !== "current"
      ? supabase.from("reporting_periods").select("id, code, label").eq("org_id", orgId).eq("code", body.period).maybeSingle()
      : supabase.from("reporting_periods").select("id, code, label").eq("org_id", orgId).eq("is_current", true).maybeSingle();
  const { data: period, error: pErr } = await periodQuery;
  if (pErr) return ndjsonError(pErr.message, 500);
  if (!period) return ndjsonError("No current reporting period. Upload data in Extract first, or pass a period code.", 400);

  // 2. Load the org's parameters + this period's data points + active formulas.
  const [{ data: paramRows, error: paramErr }, { data: dpRows }, { data: formulaRows }] = await Promise.all([
    supabase.from("parameters").select("*").eq("org_id", orgId).order("display_order"),
    supabase.from("data_points").select("parameter_id, value_annual").eq("org_id", orgId).eq("period_id", period.id),
    supabase.from("formulas").select("output_param_id, is_active").eq("org_id", orgId).eq("is_active", true),
  ]);
  if (paramErr) return ndjsonError(paramErr.message, 500);
  const parameters = (paramRows ?? []) as Parameter[];
  const valueByParamId = new Map<string, number | null>(
    ((dpRows ?? []) as Pick<DataPoint, "parameter_id" | "value_annual">[]).map((d) => [d.parameter_id, d.value_annual]),
  );
  const activeFormulaOutputIds = new Set(
    ((formulaRows ?? []) as Pick<Formula, "output_param_id">[]).map((f) => f.output_param_id),
  );

  const inputs = parameters
    .filter((p) => p.category === "input" || p.category === "emission_factor")
    .map((p) => {
      const v = valueByParamId.get(p.id) ?? null;
      return {
        code: p.code,
        display_name: p.display_name,
        unit: p.unit,
        category: p.category as "input" | "emission_factor",
        section: p.section,
        value_annual: v,
        has_value: v != null,
      };
    });

  const existingOutputs = parameters
    .filter((p) => p.category === "output")
    .map((p) => ({
      code: p.code,
      display_name: p.display_name,
      unit: p.unit,
      section: p.section,
      vsme_cell: p.vsme_cell,
      has_active_formula: activeFormulaOutputIds.has(p.id),
    }));

  // 3. Build the target list and mark fields the user already filled as occupied.
  const occupied = new Set((body.filledFields ?? []).map((f) => `${f.questionId}.${f.fieldId}`));
  const targets = getVsmeFillTargets().map((t) => ({
    vsme_cell: t.vsme_cell,
    question_id: t.question_id,
    question_label: t.question_label,
    section_id: t.section_id,
    section_title: t.section_title,
    field_id: t.field_id,
    methodology_hint: t.methodology_hint,
    occupied: occupied.has(`${t.question_id}.${t.field_id}`),
  }));

  const businessContext = await getOrgBusinessContext(req);

  // 4. Dispatch the fill agent.
  const streamed = await dispatch({
    job: {
      mode: "fill",
      framework,
      period: { code: period.code, label: period.label },
      inputs,
      existingOutputs,
      targets,
      businessContext,
    },
  });

  if (!streamed.body) return ndjsonError("Agent dispatch returned no stream", 500);

  // 5. Tee the runner's NDJSON: forward text/activity/retrieved unchanged,
  //    intercept the `proposal`, and on `done` commit + emit `fills`.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = streamed.body.getReader();
  const periodId = period.id;
  let buffer = "";
  let proposal: FillProposal | null = null;

  async function handleLine(line: string, controller: ReadableStreamDefaultController<Uint8Array>) {
    let obj: { event: string; data: unknown };
    try {
      obj = JSON.parse(line) as { event: string; data: unknown };
    } catch {
      return; // skip malformed lines
    }

    if (obj.event === "proposal") {
      // Buffer the proposal; the client gets a committed `fills` event instead.
      proposal = obj.data as FillProposal;
      return;
    }

    if (obj.event === "done") {
      if (proposal) {
        try {
          const result = await commitFillProposal(orgId!, periodId, proposal);
          // New output parameters were created — drop the cached dashboard
          // catalogue so the chart agent can reference them right away.
          invalidateCatalogue(orgId!);
          controller.enqueue(encoder.encode(ndjson("fills", result)));
        } catch (e) {
          const msg = e instanceof CommitError ? e.message : (e as Error).message;
          controller.enqueue(encoder.encode(ndjson("error", { message: `Commit failed: ${msg}` })));
        }
      } else {
        controller.enqueue(
          encoder.encode(
            ndjson("fills", {
              committed: { parameters: 0, formulas: 0 },
              fills: [],
              skipped: [],
              recalc: { formulas_evaluated: 0, errors: [] },
            }),
          ),
        );
      }
      controller.enqueue(encoder.encode(ndjson("done", obj.data)));
      return;
    }

    // Forward everything else (text, activity, retrieved, error) unchanged.
    controller.enqueue(encoder.encode(ndjson(obj.event, obj.data)));
  }

  const out = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) await handleLine(tail, controller);
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) await handleLine(line, controller);
        nl = buffer.indexOf("\n");
      }
    },
  });

  return new Response(out, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
