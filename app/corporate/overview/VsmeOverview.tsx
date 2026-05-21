"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { Zap, Flame, TrendingDown, Leaf } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KpiGroup } from "@/components/vsme/KpiGroup";
import { HeadlineKpi } from "@/components/vsme/HeadlineKpi";
import { TrendChart, type TrendSeries } from "@/components/vsme/TrendChart";
import type { CurrentMetricRow, ParamSection } from "@/lib/supabase/types";

// ──────────────────────────────────────────────────────────────────────
// Module-level config (declarative — easy to extend)
// ──────────────────────────────────────────────────────────────────────

const VSME_GROUPS: {
  title: string;
  subtitle?: string;
  sections: ParamSection[];
  columns?: 2 | 3 | 4 | 5;
  codes?: string[];
}[] = [
  {
    title: "Climate — VSME B3",
    subtitle: "Energy + GHG emissions across Scopes 1, 2, 3",
    sections: ["vsme_b3_energy", "vsme_b3_scope1", "vsme_b3_scope2", "vsme_b3_scope3", "vsme_b3_consolidated"],
    codes: [
      "scope1_total",
      "scope2_location",
      "scope2_market",
      "scope3_total",
      "scope_1_2_market",
      "ghg_intensity_location",
      "ghg_intensity_market",
      "biogenic_co2_memo",
    ],
    columns: 4,
  },
  {
    title: "Water — VSME B6",
    sections: ["vsme_b6_water"],
    codes: ["water_withdrawal_total", "water_discharge", "water_consumption", "water_high_stress"],
    columns: 4,
  },
  {
    title: "Pollution — VSME B4",
    sections: ["vsme_b4_pollution"],
    codes: [
      "nox_to_air", "ch4_to_air",
      "phosphorus_to_water", "nitrogen_to_water",
      "chloride_to_water", "toc_to_water",
      "heavy_metals_g1_to_water", "heavy_metals_g2_to_water",
    ],
    columns: 4,
  },
  {
    title: "Waste & Materials — VSME B7",
    sections: ["vsme_b7_waste", "vsme_b7_materials"],
    codes: [
      "hazwaste_total", "waste_total", "material_massflow_total",
      "mass_starch", "mass_alcohol_water", "mass_naoh_25", "mass_naoh_32",
      "mass_yeast", "mass_potato_juice", "mass_ethanol_water",
    ],
    columns: 4,
  },
  {
    title: "Workforce & Governance — VSME B8–B11 / C9",
    sections: ["vsme_b8_b11_workforce_gov"],
    codes: [
      "total_fte", "employee_turnover_rate", "total_hours_worked",
      "accident_rate_per_million_h", "gender_pay_gap",
      "mgmt_gender_ratio", "cba_coverage_pct", "board_gender_ratio",
    ],
    columns: 4,
  },
];

// ──────────────────────────────────────────────────────────────────────
// API types
// ──────────────────────────────────────────────────────────────────────

interface MetricsResponse {
  period: { id: string; code: string; label: string; status: string };
  metrics: Record<ParamSection, CurrentMetricRow[]>;
  stale_count: number;
}

interface TimeseriesResponse {
  period: { code: string; label: string };
  months: string[];
  inputs:  TrendSeries[];
  outputs: TrendSeries[];
}

// ──────────────────────────────────────────────────────────────────────
// Main view
// ──────────────────────────────────────────────────────────────────────

export function VsmeOverview() {
  const qc = useQueryClient();
  const [period] = useState("FY2025");

  async function readError(res: Response, fallback: string) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try { return (await res.json()).error ?? fallback; } catch { /* fallthrough */ }
    }
    const text = (await res.text()).slice(0, 200);
    return `${fallback}${text ? ` — ${text}` : ""}`;
  }

  const metricsQ = useQuery<MetricsResponse>({
    queryKey: ["chaincraft-metrics", period],
    queryFn: async () => {
      const res = await fetch(`/api/chaincraft/metrics?period=${period}`);
      if (!res.ok) throw new Error(await readError(res, `GET metrics → HTTP ${res.status}`));
      return res.json();
    },
    retry: false,
  });

  const timeseriesQ = useQuery<TimeseriesResponse>({
    queryKey: ["chaincraft-timeseries", period],
    queryFn: async () => {
      const res = await fetch(`/api/chaincraft/timeseries?period=${period}`);
      if (!res.ok) throw new Error(await readError(res, `GET timeseries → HTTP ${res.status}`));
      return res.json();
    },
    retry: false,
  });

  const recalc = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/chaincraft/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) throw new Error(await readError(res, `POST recalculate → HTTP ${res.status}`));
      return res.json();
    },
    onSuccess: (r) => {
      toast.success(`Recalculated ${r.formulas_evaluated} metrics in ${r.duration_ms} ms`);
      qc.invalidateQueries({ queryKey: ["chaincraft-metrics"] });
      qc.invalidateQueries({ queryKey: ["chaincraft-timeseries"] });
    },
    onError: (e) => toast.error(`Recalc failed: ${(e as Error).message}`),
  });

  // Index by code
  const byCode = new Map<string, CurrentMetricRow>();
  if (metricsQ.data) {
    for (const rows of Object.values(metricsQ.data.metrics)) {
      for (const r of rows) byCode.set(r.parameter_code, r);
    }
  }
  const get = (code: string) => byCode.get(code);

  // ── Build trend chart options (one chart = one metric at a time, picker
  // dropdown to swap to others in the same family). ─────────────────────
  const ts = timeseriesQ.data;
  const findInput  = (code: string) => ts?.inputs.find(s => s.code === code);
  const findOutput = (code: string) => ts?.outputs.find(s => s.code === code);

  const energyOptions: TrendSeries[] = ts ? [
    findInput("electricity_total"),
    findInput("electricity_peak"),
    findInput("electricity_offpeak"),
    findInput("natural_gas"),
  ].filter((s): s is TrendSeries => !!s) : [];

  const emissionsOptions: TrendSeries[] = ts ? [
    findOutput("scope1_total"),
    findOutput("scope2_location"),
    findOutput("scope2_market"),
    findOutput("scope_1_2_location"),
    findOutput("scope_1_2_market"),
  ].filter((s): s is TrendSeries => !!s) : [];

  const feedstockOptions: TrendSeries[] = ts ? [
    findInput("feed_alcohol_water"),
    findInput("feed_starch_crespovit_looop"),
    findInput("feed_starch_crespovit_duynie"),
    findInput("feed_starch_hamino"),
    findInput("naoh_25"),
    findInput("naoh_32"),
    findInput("brewers_yeast"),
    findInput("ethanol_water"),
  ].filter((s): s is TrendSeries => !!s) : [];

  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      <div className="px-6 py-6 space-y-8 max-w-[1600px] mx-auto">

        {/* ── Header banner ───────────────────────────────────── */}
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Image
              src="/chaincraft_logo.jpg"
              alt="ChainCraft B.V."
              width={64}
              height={64}
              className="object-contain flex-shrink-0"
              style={{ height: "auto" }}
            />
            <div>
              <h1 className="text-[#0A0A0A] text-2xl font-bold tracking-tight leading-tight">
                Sustainability Dashboard
              </h1>
              <p className="text-[#1F5F5B] text-sm mt-1">
                ChainCraft B.V. · {metricsQ.data?.period.label ?? period}
                {metricsQ.data?.stale_count ? ` · ${metricsQ.data.stale_count} stale metrics` : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
            {recalc.isPending ? "Recalculating…" : "Recalculate"}
          </Button>
        </header>

        {/* ── Errors ──────────────────────────────────────────── */}
        {(metricsQ.error || timeseriesQ.error) && (
          <div className="border border-red-200 bg-red-50 text-red-900 text-sm px-4 py-3 rounded">
            {(metricsQ.error as Error | null)?.message ?? (timeseriesQ.error as Error | null)?.message}
          </div>
        )}

        {metricsQ.isLoading && !metricsQ.data && (
          <div className="text-sm text-[#0A0A0A]/60">Loading metrics…</div>
        )}

        {metricsQ.data && Object.keys(metricsQ.data.metrics).length === 0 && (
          <div className="border border-[#0A0A0A]/10 bg-[#F5F4F0] text-sm px-4 py-6">
            No metrics yet. Click <strong>Recalculate</strong> to compute them from seeded data points.
          </div>
        )}

        {metricsQ.data && (
          <>
            {/* ── Headline KPIs (4 wide, like the cement screenshot) ── */}
            <section>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#0A0A0A]/50 mb-3">
                Performance Highlights
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <HeadlineKpi
                  label="Total Energy Consumption"
                  value={get("total_energy_mwh")?.value ?? null}
                  unit="MWh"
                  Icon={Zap}
                  trace={get("total_energy_mwh")?.trace}
                  vsmeCell={get("total_energy_mwh")?.vsme_cell}
                />
                <HeadlineKpi
                  label="Total GHG (Scope 1+2+3, market)"
                  value={get("scope_1_2_3_market")?.value ?? null}
                  unit="tCO₂e"
                  Icon={Flame}
                  accent="warning"
                  trace={get("scope_1_2_3_market")?.trace}
                  vsmeCell={get("scope_1_2_3_market")?.vsme_cell}
                />
                <HeadlineKpi
                  label="GHG Intensity (market)"
                  value={get("ghg_intensity_market")?.value ?? null}
                  unit="tCO₂e/€"
                  Icon={TrendingDown}
                  trace={get("ghg_intensity_market")?.trace}
                  vsmeCell={get("ghg_intensity_market")?.vsme_cell}
                />
                <HeadlineKpi
                  label="Renewable Energy Share"
                  value={get("renewable_share")?.value ?? null}
                  unit="%"
                  Icon={Leaf}
                  accent="success"
                  trace={get("renewable_share")?.trace}
                  vsmeCell={get("renewable_share")?.vsme_cell}
                />
              </div>
            </section>

            {/* ── Trend charts ───────────────────────────────────── */}
            {ts && (
              <section className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#0A0A0A]/50">
                  Monthly Trends · FY2025
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {energyOptions.length > 0 && (
                    <TrendChart
                      title="Energy consumption"
                      months={ts.months}
                      options={energyOptions}
                      defaultCode="electricity_total"
                    />
                  )}
                  {emissionsOptions.length > 0 && (
                    <TrendChart
                      title="GHG emissions"
                      months={ts.months}
                      options={emissionsOptions}
                      defaultCode="scope1_total"
                    />
                  )}
                  {feedstockOptions.length > 0 && (
                    <div className="lg:col-span-2">
                      <TrendChart
                        title="Feedstock deliveries"
                        months={ts.months}
                        options={feedstockOptions}
                        defaultCode="feed_alcohol_water"
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Module sections (KPI grids) ────────────────────── */}
            {VSME_GROUPS.map(group => {
              const tiles = (group.codes ?? group.sections.flatMap(s => (metricsQ.data!.metrics[s] ?? []).map(r => r.parameter_code)))
                .map(code => byCode.get(code))
                .filter((r): r is CurrentMetricRow => !!r)
                .map(r => ({
                  id: r.parameter_code,
                  label: r.display_name,
                  unit: r.unit,
                  value: r.value,
                  isStale: r.is_stale,
                  vsmeCell: r.vsme_cell,
                  trace: r.trace,
                }));
              if (tiles.length === 0) return null;
              return (
                <KpiGroup key={group.title} title={group.title} subtitle={group.subtitle} tiles={tiles} columns={group.columns} />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
