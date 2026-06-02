"use client";

// Editable review of an ExtractionProposal before commit. The user can fix the
// period, parameter metadata (incl. section), and every data-point value, then
// Confirm to persist via commitExtraction. Provenance (source excerpt/page) is
// shown read-only so the reviewer can check each value against the document.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { ALLOWED_SECTIONS } from "@/lib/metrics/param-sections";
import { commitExtraction, type ExtractionProposal, type ProposedParameter, type ProposedDataPoint } from "@/lib/api/extract";

const CATEGORIES: ProposedParameter["category"][] = ["input", "emission_factor", "output"];

export function ProposalReview({
  proposal,
  documentId,
  existingCodes,
  onCommitted,
}: {
  proposal: ExtractionProposal;
  documentId: string | null;
  // Codes the org already has — drives the "matches existing" badge.
  existingCodes?: Set<string>;
  onCommitted: (result: { parameters: number; data_points: number }) => void;
}) {
  const [period, setPeriod] = useState(proposal.period);
  const [parameters, setParameters] = useState<ProposedParameter[]>(proposal.parameters);
  const [dataPoints, setDataPoints] = useState<ProposedDataPoint[]>(proposal.data_points);
  const [committing, setCommitting] = useState(false);

  const paramOptions = useMemo(() => parameters.map((p) => p.code), [parameters]);

  function updateParam(i: number, patch: Partial<ProposedParameter>) {
    setParameters((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function updateDataPoint(i: number, patch: Partial<ProposedDataPoint>) {
    setDataPoints((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function confirm() {
    setCommitting(true);
    try {
      const result = await commitExtraction({
        documentId,
        proposal: { ...proposal, period, parameters, data_points: dataPoints },
      });
      toast.success(`Committed ${result.parameters} parameters, ${result.data_points} data points`);
      onCommitted(result);
    } catch (e) {
      toast.error(`Commit failed: ${(e as Error).message}`);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Period */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Reporting period</h3>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Code
            <input
              value={period.code}
              onChange={(e) => setPeriod({ ...period, code: e.target.value })}
              className="w-32 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Label
            <input
              value={period.label}
              onChange={(e) => setPeriod({ ...period, label: e.target.value })}
              className="w-56 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>
      </section>

      {/* Parameters */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Parameters ({parameters.length})
        </h3>
        <div className="overflow-x-auto border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Display name</th>
                <th className="px-3 py-2 text-left font-medium">Unit</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Section</th>
                <th className="px-3 py-2 text-left font-medium">Monthly</th>
                <th className="px-3 py-2 text-left font-medium">Match</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    <input value={p.code} onChange={(e) => updateParam(i, { code: e.target.value })}
                      className="w-40 border border-slate-200 px-1.5 py-1 font-mono text-[12px] outline-none focus:border-brand" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={p.display_name} onChange={(e) => updateParam(i, { display_name: e.target.value })}
                      className="w-48 border border-slate-200 px-1.5 py-1 outline-none focus:border-brand" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={p.unit} onChange={(e) => updateParam(i, { unit: e.target.value })}
                      className="w-20 border border-slate-200 px-1.5 py-1 outline-none focus:border-brand" />
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={p.category} onChange={(e) => updateParam(i, { category: e.target.value as ProposedParameter["category"] })}
                      className="border border-slate-200 px-1.5 py-1 outline-none focus:border-brand">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={p.section} onChange={(e) => updateParam(i, { section: e.target.value })}
                      className="border border-slate-200 px-1.5 py-1 outline-none focus:border-brand">
                      {ALLOWED_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" checked={p.is_monthly} onChange={(e) => updateParam(i, { is_monthly: e.target.checked })} />
                  </td>
                  <td className="px-3 py-1.5">
                    {existingCodes?.has(p.code) ? (
                      <span className="inline-flex items-center gap-1 bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                        <Check className="h-3 w-3" /> existing
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">new</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Data points */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Data points ({dataPoints.length})
        </h3>
        <div className="overflow-x-auto border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Parameter</th>
                <th className="px-3 py-2 text-left font-medium">Annual value</th>
                <th className="px-3 py-2 text-left font-medium">Source excerpt</th>
                <th className="px-3 py-2 text-left font-medium">Page</th>
              </tr>
            </thead>
            <tbody>
              {dataPoints.map((d, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-1.5">
                    <select value={d.parameter_code} onChange={(e) => updateDataPoint(i, { parameter_code: e.target.value })}
                      className="w-44 border border-slate-200 px-1.5 py-1 font-mono text-[12px] outline-none focus:border-brand">
                      {paramOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={d.value_annual ?? ""}
                      onChange={(e) => updateDataPoint(i, { value_annual: e.target.value === "" ? null : Number(e.target.value) })}
                      className="w-32 border border-slate-200 px-1.5 py-1 text-right tabular-nums outline-none focus:border-brand"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="block max-w-md text-xs italic text-slate-500">{d.source_excerpt || "—"}</span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{d.source_page ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {proposal.notes && (
        <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{proposal.notes}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={confirm}
          disabled={committing}
          className="bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-40"
        >
          {committing ? "Saving…" : "Confirm & save"}
        </button>
      </div>
    </div>
  );
}
