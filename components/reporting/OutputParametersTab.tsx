"use client";

// Requirements tab inside the CDP and VSME questionnaire editors. Lists
// the output parameters from the Chaincraft schema (live values, formula,
// trace, downstream usage). Replaces the placeholder questionnaire-row
// table the tab shipped with before.
//
// Data comes from /api/reporting/output-parameters which joins
// `parameters`, `v_current_metrics`, `formulas` and `calculated_metrics`,
// and resolves usage via runtime inversion of vsmeExport/map.ts.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Search } from "@/components/reporting/qualitative/icons";
import { dashboardFetch } from "@/lib/dashboard/client-fetch";

interface UsedIn {
  framework_id: "vsme" | "cdp";
  framework_name: string;
  question_id: string;
  question_label: string;
  section_id: string;
  section_title: string;
}

interface RequirementRow {
  code: string;
  display_name: string;
  unit: string;
  section: string;
  vsme_cell: string | null;
  is_calculated: boolean;
  is_monthly: boolean;
  value: number | null;
  is_stale: boolean;
  computed_at: string | null;
  formula: {
    id: string;
    expression: string;
    expression_human: string | null;
    dependencies: string[];
    description: string | null;
  } | null;
  inputs_used: Record<string, number> | null;
  used_in: UsedIn[];
}

interface ApiResponse {
  // null when the org has no reporting period yet — the tab shows an empty state.
  period: { code: string; label: string; status: string } | null;
  framework: "vsme" | "cdp";
  rows: RequirementRow[];
}

interface Props {
  // Editor surface invoking the tab. `vsme-narrative` is treated like `vsme`
  // for parameter lookup since both lean on the same VSME usage map; the only
  // user-visible difference is that the narrative report can't jump back to
  // a structured question.
  frameworkId: "cdp" | "vsme" | "vsme-narrative";
  // Optional — only structured questionnaires (CDP, VSME Digital Template)
  // can deep-link back to a question. The narrative report omits it, so the
  // detail view's "Used in" entries render as plain rows.
  onOpenQuestion?: (questionId: string) => void;
  // Parent-controlled selection — used by the narrative editor so clicking
  // an embedded output-parameter pill jumps straight to that row's detail.
  // When provided, the tab uses this as the source of truth and emits
  // changes via `onSelectionChange`.
  selectedCode?: string | null;
  onSelectionChange?: (code: string | null) => void;
}

// The org's current period is resolved server-side; the client asks for
// "current" rather than pinning a fiscal year.
const PERIOD = "current";

function apiFrameworkFor(frameworkId: Props["frameworkId"]): "cdp" | "vsme" {
  return frameworkId === "cdp" ? "cdp" : "vsme";
}

function formatValue(v: number | null, unit: string): string {
  if (v === null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  let body: string;
  if (abs >= 1000) body = v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  else if (abs < 0.0001 && v !== 0) body = v.toExponential(2);
  else body = v.toFixed(4).replace(/\.?0+$/, "");
  return unit ? `${body} ${unit}` : body;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function OutputParametersTab({
  frameworkId,
  onOpenQuestion,
  selectedCode: controlledCode,
  onSelectionChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [internalCode, setInternalCode] = useState<string | null>(null);
  // Use the controlled value when the parent passes one in; otherwise keep
  // local state. Controlled mode is how the narrative editor jumps to a
  // specific row when the user clicks an embedded output-parameter pill.
  const isControlled = controlledCode !== undefined;
  const selectedCode = isControlled ? controlledCode : internalCode;
  const setSelectedCode = (code: string | null) => {
    if (!isControlled) setInternalCode(code);
    onSelectionChange?.(code);
  };
  // When the controlled code is set externally, scroll the detail into view
  // by clearing search so the row would also be visible if the user backs out.
  useEffect(() => {
    if (isControlled && controlledCode) setSearch("");
  }, [isControlled, controlledCode]);

  const apiFramework = apiFrameworkFor(frameworkId);
  const query = useQuery<ApiResponse>({
    queryKey: ["output-parameters", apiFramework, PERIOD],
    queryFn: async () => {
      const res = await dashboardFetch(
        `/api/reporting/output-parameters?period=${PERIOD}&framework=${apiFramework}`,
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 60_000,
  });

  const rows = query.data?.rows ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(needle) ||
        r.display_name.toLowerCase().includes(needle) ||
        r.section.toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const selected = selectedCode ? rows.find((r) => r.code === selectedCode) ?? null : null;

  if (query.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-sm text-slate-400">
        Loading output parameters…
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white px-6">
        <div className="max-w-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="font-medium">Couldn&apos;t load output parameters</div>
          <div className="mt-1 text-xs text-red-600">{(query.error as Error).message}</div>
        </div>
      </div>
    );
  }

  if (selected && query.data?.period) {
    return (
      <RequirementDetail
        row={selected}
        period={query.data.period}
        onBack={() => setSelectedCode(null)}
        onOpenQuestion={onOpenQuestion}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
        <div className="relative max-w-sm flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search output parameters..."
            className="w-full border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand"
          />
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            {filtered.length} of {rows.length}
          </span>
          {query.data?.period && (
            <span className="inline-flex items-center gap-1.5 border border-slate-200 px-2 py-0.5">
              <span className="font-medium text-slate-600">Period</span>
              {query.data.period.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="w-56 px-4 py-2 text-left font-medium">Code</th>
              <th className="px-4 py-2 text-left font-medium">Display name</th>
              <th className="w-44 px-4 py-2 text-left font-medium">Section</th>
              <th className="w-20 px-4 py-2 text-left font-medium">Unit</th>
              <th className="w-40 px-4 py-2 text-right font-medium">Value</th>
              <th className="w-24 px-4 py-2 text-left font-medium">Used in</th>
              <th className="w-44 px-4 py-2 text-left font-medium">Last computed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.code}
                onClick={() => setSelectedCode(r.code)}
                className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/60"
              >
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-700">
                  <span className="truncate" title={r.code}>
                    {r.code}
                  </span>
                </td>
                <td className="truncate px-4 py-2.5 text-slate-900" title={r.display_name}>
                  {r.display_name}
                </td>
                <td className="truncate px-4 py-2.5 text-slate-600" title={r.section}>
                  {r.section}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{r.unit || "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                  <span className="inline-flex items-center gap-1.5">
                    {r.is_stale && (
                      <span
                        title="Stale — re-run recalculation"
                        className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                      />
                    )}
                    {formatValue(r.value, r.unit)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {r.used_in.length > 0 ? (
                    <span
                      className="inline-flex min-w-[1.5rem] items-center justify-center bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand"
                      title={r.used_in.map((u) => `${u.question_id} · ${u.question_label}`).join("\n")}
                    >
                      {r.used_in.length}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="truncate px-4 py-2.5 text-slate-500">
                  {formatDateTime(r.computed_at)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                  No output parameters match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RequirementDetail({
  row,
  period,
  onBack,
  onOpenQuestion,
}: {
  row: RequirementRow;
  period: NonNullable<ApiResponse["period"]>;
  onBack: () => void;
  onOpenQuestion?: (questionId: string) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-slate-200 px-6 py-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to requirements
        </button>
      </div>

      <div className="mx-auto w-full max-w-4xl px-8 py-8">
        <div className="flex items-center gap-2">
          <span className="bg-slate-100 px-2 py-0.5 font-mono text-[12px] text-slate-700">
            {row.code}
          </span>
          {row.is_stale && (
            <span className="inline-flex items-center gap-1 border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Stale
            </span>
          )}
          {row.is_monthly && (
            <span className="inline-flex items-center gap-1 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Monthly
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{row.display_name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{row.section}</span>
          {row.vsme_cell && (
            <>
              {" · "}
              <span className="font-mono text-xs text-slate-500">{row.vsme_cell}</span>
            </>
          )}
          {row.unit && (
            <>
              {" · "}
              <span>Unit: {row.unit}</span>
            </>
          )}
        </p>

        <Card label="Current value">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-slate-900">
              {row.value === null
                ? "—"
                : row.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            {row.unit && <span className="text-sm text-slate-500">{row.unit}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Period {period.label} · Last computed {formatDateTime(row.computed_at)}
          </p>
        </Card>

        <Card label="Formula">
          {row.formula ? (
            <div className="space-y-3">
              {row.formula.expression_human && (
                <p className="text-sm text-slate-800">{row.formula.expression_human}</p>
              )}
              <pre className="overflow-x-auto bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
                {row.formula.expression}
              </pre>
              {row.formula.description && (
                <p className="text-xs italic text-slate-500">{row.formula.description}</p>
              )}
              <DependenciesTable
                dependencies={row.formula.dependencies}
                inputsUsed={row.inputs_used}
              />
            </div>
          ) : (
            <p className="text-sm italic text-slate-500">
              No active formula — value is entered directly via the data collection workflow.
            </p>
          )}
        </Card>

        <Card label="Used in this framework">
          {row.used_in.length === 0 ? (
            <p className="text-sm italic text-slate-500">
              No questions in this framework reference this parameter yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200">
              {row.used_in.map((u) => {
                const body = (
                  <div className="flex w-full items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-slate-700">
                          {u.question_id}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-slate-400">
                          {u.section_id} · {u.section_title}
                        </span>
                      </div>
                      <div
                        className="mt-0.5 truncate text-sm text-slate-800"
                        title={u.question_label}
                      >
                        {u.question_label}
                      </div>
                    </div>
                    {onOpenQuestion && (
                      <span className="shrink-0 self-center text-xs text-brand">Open →</span>
                    )}
                  </div>
                );
                return (
                  <li key={u.question_id}>
                    {onOpenQuestion ? (
                      <button
                        onClick={() => onOpenQuestion(u.question_id)}
                        className="block w-full text-left hover:bg-slate-50"
                      >
                        {body}
                      </button>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function DependenciesTable({
  dependencies,
  inputsUsed,
}: {
  dependencies: string[];
  inputsUsed: Record<string, number> | null;
}) {
  if (dependencies.length === 0) {
    return (
      <p className="text-xs italic text-slate-400">No declared dependencies.</p>
    );
  }
  return (
    <div className="overflow-hidden border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Input</th>
            <th className="px-3 py-2 text-right font-medium">Value used</th>
          </tr>
        </thead>
        <tbody>
          {dependencies.map((dep) => {
            const v = inputsUsed?.[dep];
            return (
              <tr key={dep} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-mono text-[12px] text-slate-700">{dep}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">
                  {v === undefined || v === null
                    ? "—"
                    : Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </h2>
      <div className="border border-slate-200 bg-white px-4 py-3">{children}</div>
    </section>
  );
}
