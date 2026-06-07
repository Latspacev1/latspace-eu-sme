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
import {
  CATEGORIES as CLASSIFICATION_CATEGORIES,
  SUBCATEGORIES,
  CATEGORY_LABELS,
  defaultSubcategory,
  type Category,
  type DocumentClassification,
} from "@/lib/types/document-classification";

const CATEGORIES: ProposedParameter["category"][] = ["input", "emission_factor", "output"];

// How the document's data is shaped in time. Chosen explicitly by the reviewer
// so the reporting period is unambiguous:
//   annual          → one yearly figure (value_annual). Period code "FY<year>".
//   single_month    → one month's figure, placed in that month's slot of the
//                     12-length values_monthly array. Period code "<year>-<MM>".
//   multiple_months → several months filled in a 12-slot monthly grid (e.g. an
//                     Excel covering Jan–Jun). Period code "<year>".
type DataShape = "annual" | "single_month" | "multiple_months";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const EMPTY_MONTHS = (): (number | null)[] => Array(12).fill(null);

/** Two-digit month for a 0-based index. */
function mm(monthIndex: number): string {
  return String(monthIndex + 1).padStart(2, "0");
}

/** Best-guess current-ish year used as a fallback when none is derivable. */
function fallbackYear(): number {
  return new Date().getFullYear();
}

/** Pull a 4-digit year out of a period code/label/date, else null. */
function yearFrom(...candidates: (string | undefined)[]): number | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = c.match(/(20\d{2}|19\d{2})/);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Index (0–11) of the first non-null monthly value, else null. */
function firstFilledMonth(values: (number | null)[] | null | undefined): number | null {
  if (!Array.isArray(values)) return null;
  const idx = values.findIndex((v) => v !== null && v !== undefined);
  return idx >= 0 ? idx : null;
}

/** Count of non-null monthly values across all data points. */
function filledMonthCount(dps: ProposedDataPoint[]): number {
  let max = 0;
  for (const d of dps) {
    if (Array.isArray(d.values_monthly)) {
      const n = d.values_monthly.filter((v) => v !== null && v !== undefined).length;
      if (n > max) max = n;
    }
  }
  return max;
}

/** Infer the initial data shape from what the agent proposed. */
function inferShape(dps: ProposedDataPoint[]): DataShape {
  const monthly = filledMonthCount(dps);
  if (monthly >= 2) return "multiple_months";
  if (monthly === 1) return "single_month";
  return "annual";
}

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
  const [parameters, setParameters] = useState<ProposedParameter[]>(proposal.parameters);
  const [dataPoints, setDataPoints] = useState<ProposedDataPoint[]>(proposal.data_points);
  const [committing, setCommitting] = useState(false);

  // ── Reporting period: data shape (explicit) ────────────────────────────────
  const [dataShape, setDataShape] = useState<DataShape>(() =>
    inferShape(proposal.data_points),
  );
  const [year, setYear] = useState<number>(
    () =>
      yearFrom(
        proposal.period?.code,
        proposal.period?.label,
        proposal.period?.start_date,
      ) ?? fallbackYear(),
  );
  // For single_month: which month (0–11). Seed from the agent's monthly array.
  const [month, setMonth] = useState<number>(
    () => firstFilledMonth(proposal.data_points[0]?.values_monthly) ?? 0,
  );

  // Derive the period code + label from the chosen shape. This is what makes
  // the reporting period unambiguous regardless of what the agent guessed.
  const derivedPeriod = useMemo(() => {
    if (dataShape === "annual") {
      return { code: `FY${year}`, label: `Fiscal Year ${year}` };
    }
    if (dataShape === "single_month") {
      return {
        code: `${year}-${mm(month)}`,
        label: `${MONTHS[month]} ${year}`,
      };
    }
    // multiple_months → year-only period; values spread across the monthly array.
    return { code: `${year}`, label: `${year}` };
  }, [dataShape, year, month]);

  // Document classification — pre-filled with the agent's pick, editable. Falls
  // back to a sensible default when the agent didn't classify.
  const [classification, setClassification] = useState<DocumentClassification>(() => {
    const c = proposal.classification;
    if (c && CLASSIFICATION_CATEGORIES.includes(c.category)) {
      const list = SUBCATEGORIES[c.category] as readonly string[];
      return {
        category: c.category,
        subcategory: list.includes(c.subcategory)
          ? c.subcategory
          : defaultSubcategory(c.category),
      };
    }
    return { category: "environmental", subcategory: defaultSubcategory("environmental") };
  });

  const setCategory = (category: Category) =>
    setClassification({ category, subcategory: defaultSubcategory(category) });

  const paramOptions = useMemo(() => parameters.map((p) => p.code), [parameters]);

  const isMonthlyShape = dataShape !== "annual";

  function updateParam(i: number, patch: Partial<ProposedParameter>) {
    setParameters((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function updateDataPoint(i: number, patch: Partial<ProposedDataPoint>) {
    setDataPoints((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  /** Set the annual value of a data point. */
  function setAnnual(i: number, value: number | null) {
    updateDataPoint(i, { value_annual: value });
  }

  /** Set one month's cell (monthIndex 0–11) of a data point's monthly array. */
  function setMonthlyCell(i: number, monthIndex: number, value: number | null) {
    setDataPoints((prev) =>
      prev.map((d, idx) => {
        if (idx !== i) return d;
        const arr = Array.isArray(d.values_monthly)
          ? [...d.values_monthly]
          : EMPTY_MONTHS();
        arr[monthIndex] = value;
        return { ...d, values_monthly: arr };
      }),
    );
  }

  /**
   * Normalize the data points to the chosen shape just before committing:
   *  - annual          → keep value_annual, clear values_monthly.
   *  - single_month    → move the value into month-slot `month`, clear others
   *                      and value_annual; mark is_monthly.
   *  - multiple_months → keep the 12-slot grid, clear value_annual; is_monthly.
   */
  function normalizedForCommit(): {
    parameters: ProposedParameter[];
    data_points: ProposedDataPoint[];
  } {
    const monthly = isMonthlyShape;
    const params = parameters.map((p) => ({ ...p, is_monthly: monthly }));

    const dps = dataPoints.map((d) => {
      if (dataShape === "annual") {
        return { ...d, values_monthly: null };
      }
      if (dataShape === "single_month") {
        // Value lives in value_annual today (the agent's annual field) or in the
        // month cell the user typed; prefer a filled month cell, else annual.
        const existing = Array.isArray(d.values_monthly) ? d.values_monthly : null;
        const cell =
          existing && existing[month] !== null && existing[month] !== undefined
            ? existing[month]
            : d.value_annual;
        const arr = EMPTY_MONTHS();
        arr[month] = cell ?? null;
        return { ...d, value_annual: null, values_monthly: arr };
      }
      // multiple_months
      const arr = Array.isArray(d.values_monthly)
        ? [...d.values_monthly]
        : EMPTY_MONTHS();
      while (arr.length < 12) arr.push(null);
      return { ...d, value_annual: null, values_monthly: arr.slice(0, 12) };
    });

    return { parameters: params, data_points: dps };
  }

  async function confirm() {
    setCommitting(true);
    try {
      const { parameters: params, data_points } = normalizedForCommit();
      const result = await commitExtraction({
        documentId,
        proposal: {
          ...proposal,
          period: derivedPeriod,
          classification,
          parameters: params,
          data_points,
        },
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
      {/* Reporting period — explicit data shape */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Reporting period</h3>
        <p className="text-xs text-slate-500">
          Tell us how this document&apos;s data is structured so the reporting period is unambiguous.
        </p>

        <div className="flex flex-wrap gap-2">
          {([
            ["annual", "Annual figure"],
            ["single_month", "Single month"],
            ["multiple_months", "Multiple months"],
          ] as [DataShape, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDataShape(value)}
              className={`rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                dataShape === value
                  ? "border-brand bg-brand/[0.06] text-brand"
                  : "border-slate-300 text-slate-600 hover:border-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Year
            <input
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || fallbackYear())}
              className="w-28 border border-slate-300 px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand"
            />
          </label>

          {dataShape === "single_month" && (
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Month
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-32 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-1 text-xs text-slate-600">
            Period
            <span className="inline-flex items-center gap-2 rounded-sm bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
              <span className="font-mono">{derivedPeriod.code}</span>
              <span className="text-slate-400">·</span>
              <span>{derivedPeriod.label}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Classification */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Classification
        </h3>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Category
            <select
              value={classification.category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-56 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
            >
              {CLASSIFICATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Subcategory
            <select
              value={classification.subcategory}
              onChange={(e) =>
                setClassification({ ...classification, subcategory: e.target.value })
              }
              className="w-64 border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
            >
              {(SUBCATEGORIES[classification.category] as readonly string[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
                  <td className="px-3 py-1.5 text-center text-[12px] text-slate-500">
                    {/* Driven by the reporting-period data shape, not per-row. */}
                    {isMonthlyShape ? "Yes" : "No"}
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

      {/* Data points — value editor adapts to the chosen data shape */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Data points ({dataPoints.length})
        </h3>

        {dataShape === "multiple_months" ? (
          // Monthly grid: one row per parameter, one cell per month (Jan–Dec).
          <div className="overflow-x-auto border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium">Parameter</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="px-1.5 py-2 text-center font-medium">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataPoints.map((d, i) => {
                  const arr = Array.isArray(d.values_monthly) ? d.values_monthly : EMPTY_MONTHS();
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                        <select value={d.parameter_code} onChange={(e) => updateDataPoint(i, { parameter_code: e.target.value })}
                          className="w-40 border border-slate-200 px-1.5 py-1 font-mono text-[12px] outline-none focus:border-brand">
                          {paramOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      {MONTHS.map((m, mi) => (
                        <td key={m} className="px-1 py-1.5">
                          <input
                            type="number"
                            value={arr[mi] ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              setMonthlyCell(i, mi, e.target.value === "" ? null : Number(e.target.value))
                            }
                            className="w-16 border border-slate-200 px-1 py-1 text-right tabular-nums outline-none focus:border-brand"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Annual or single-month: a single value per parameter.
          <div className="overflow-x-auto border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Parameter</th>
                  <th className="px-3 py-2 text-left font-medium">
                    {dataShape === "single_month" ? `${MONTHS[month]} ${year} value` : "Annual value"}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Source excerpt</th>
                  <th className="px-3 py-2 text-left font-medium">Page</th>
                </tr>
              </thead>
              <tbody>
                {dataPoints.map((d, i) => {
                  // Single-month value reads from the month cell if present, else
                  // the agent's annual field (we move it on commit).
                  const monthCell = Array.isArray(d.values_monthly) ? d.values_monthly[month] : null;
                  const shownValue =
                    dataShape === "single_month"
                      ? monthCell ?? d.value_annual ?? null
                      : d.value_annual ?? null;
                  return (
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
                          value={shownValue ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (dataShape === "single_month") setMonthlyCell(i, month, v);
                            else setAnnual(i, v);
                          }}
                          className="w-32 border border-slate-200 px-1.5 py-1 text-right tabular-nums outline-none focus:border-brand"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="block max-w-md text-xs italic text-slate-500">{d.source_excerpt || "—"}</span>
                        {(d.source_sheet || d.source_cell) && (
                          <span className="mt-0.5 block font-mono text-[11px] not-italic text-slate-400">
                            {[d.source_sheet, d.source_cell].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">{d.source_page ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
