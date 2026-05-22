"use client";

// ChartRenderer — single source of truth for painting a ChartSpec + ChartData.
// Used by both the inline chat ChartMessage and the pinned DashboardTile so
// behaviour stays identical across surfaces.

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

import type { ChartSpec, ChartData, ChartSeries } from "@/lib/dashboard/chart-spec";

// Palette echoes the deep-teal brand colours used elsewhere in the app.
const PALETTE = ["#1F5F5B", "#22867C", "#89E4DA", "#0A0A0A", "#A07A2D", "#7A2D2D", "#2D5BA0", "#5B2DA0"];

function compact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + "k";
  if (abs >= 1) return n.toFixed(0);
  return n.toFixed(2);
}

function precise(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toExponential(2);
}

// KPI-style number formatting — same rules as components/vsme/HeadlineKpi
// so AI-generated KPI cards format identically to the canonical ones.
function kpiNumber(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "M";
  if (abs >= 1_000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return v.toExponential(2);
}

interface RowShape {
  label: string;
  [code: string]: number | string | null;
}

function buildRows(data: ChartData): RowShape[] {
  if (data.series.length === 0) return [];
  const labels = data.series[0].points.map(p => p.label);
  return labels.map((label, i) => {
    const row: RowShape = { label };
    for (const s of data.series) row[s.code] = s.points[i]?.value ?? null;
    return row;
  });
}

export interface ChartRendererProps {
  spec: ChartSpec;
  data: ChartData;
  // Fixed pixel height. Pass `undefined` to fill the parent container
  // (parent must establish height via flex/grid or an explicit style).
  height?: number;
}

export function ChartRenderer({ spec, data, height = 280 }: ChartRendererProps) {
  const rows = useMemo(() => buildRows(data), [data]);
  const colors = useMemo(() => {
    const base = spec.options?.color;
    return data.series.map((_, i) => (i === 0 && base ? base : PALETTE[i % PALETTE.length]));
  }, [data.series, spec.options?.color]);

  const sizeStyle: React.CSSProperties = height != null
    ? { height }
    : { height: "100%", width: "100%" };

  if (data.series.length === 0 || rows.length === 0) {
    return (
      <div style={sizeStyle} className="flex items-center justify-center text-xs text-[#0A0A0A]/40 border border-dashed border-[#0A0A0A]/15">
        No data for this period.
      </div>
    );
  }

  // ── KPI ────────────────────────────────────────────────────────────────
  // Visually mirrors components/vsme/HeadlineKpi so AI-generated KPIs sit
  // alongside the canonical dashboard cards without looking out of place:
  // uppercase label on top, big tabular-num value with unit, optional
  // subtitle when we aggregated across months.
  if (spec.kind === "kpi") {
    // For annual granularity the single point is the value. For monthly we
    // sum across the 12 points (year total). The LLM picks granularity, so
    // we trust its choice rather than guessing per unit.
    const computeValue = (s: ChartSeries): { value: number | null; subtitle?: string } => {
      const points = s.points.filter(p => p.value != null);
      if (points.length === 0) return { value: null };
      if (spec.granularity === "annual" || points.length === 1) {
        return { value: points[points.length - 1].value };
      }
      const total = points.reduce((acc, p) => acc + (p.value ?? 0), 0);
      return { value: total, subtitle: `Sum across ${points.length} months` };
    };

    // Single-KPI layout = exactly HeadlineKpi proportions.
    // Multi-KPI layout = stacked rows so a "compare 3 scopes as KPIs" still
    // works without blowing up the tile.
    if (data.series.length === 1) {
      const s = data.series[0];
      const { value, subtitle } = computeValue(s);
      return (
        <div style={height != null ? { minHeight: height } : { height: "100%" }} className="h-full flex flex-col p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A]/60 leading-snug">
            {s.display_name}
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-medium tabular-nums leading-none text-[#0A0A0A]">
              {value == null ? "—" : kpiNumber(value)}
            </span>
            <span className="text-xs text-[#0A0A0A]/60">{s.unit}</span>
          </div>
          {subtitle && (
            <div className="mt-2 text-[11px] text-[#0A0A0A]/45">{subtitle}</div>
          )}
          <div className="mt-auto pt-3 text-[10px] uppercase tracking-[0.1em] text-[#0A0A0A]/35">
            {data.period_label}
          </div>
        </div>
      );
    }

    return (
      <div style={height != null ? { minHeight: height } : { height: "100%" }} className="h-full grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 content-center">
        {data.series.map(s => {
          const { value, subtitle } = computeValue(s);
          return (
            <div key={s.code} className="border border-[#0A0A0A]/10 bg-white p-3">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A]/60 leading-snug">
                {s.display_name}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-medium tabular-nums leading-none text-[#0A0A0A]">
                  {value == null ? "—" : kpiNumber(value)}
                </span>
                <span className="text-[11px] text-[#0A0A0A]/60">{s.unit}</span>
              </div>
              {subtitle && (
                <div className="mt-1.5 text-[10px] text-[#0A0A0A]/45">{subtitle}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Pie ────────────────────────────────────────────────────────────────
  if (spec.kind === "pie") {
    const pieData = data.series.map((s, i) => ({
      name: s.display_name,
      value: s.points.reduce((acc, p) => acc + (p.value ?? 0), 0),
      fill: colors[i],
    }));
    return (
      <div style={sizeStyle}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="70%" stroke="#fff" strokeWidth={1}>
              {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip
              formatter={(v) => precise(Number(v ?? 0))}
              contentStyle={{ border: "1px solid rgba(10,10,10,0.15)", borderRadius: 0, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Trend (line) / Bar / Stacked ──────────────────────────────────────
  const isBar = spec.kind === "bar" || spec.kind === "stacked";
  const isStacked = spec.kind === "stacked";

  const tooltipFormatter = (value: number | string | undefined, name: string | number | undefined) => {
    const nameStr = typeof name === "string" ? name : String(name ?? "");
    const series = data.series.find(s => s.display_name === nameStr || s.code === nameStr);
    const unit = series?.unit ?? "";
    return [`${precise(Number(value ?? 0))} ${unit}`.trim(), series?.display_name ?? nameStr] as [string, string];
  };

  return (
    <div style={sizeStyle}>
      <ResponsiveContainer width="100%" height="100%">
        {isBar ? (
          <BarChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#0A0A0A" strokeOpacity={0.04} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }} axisLine={{ stroke: "#0A0A0A", strokeOpacity: 0.1 }} tickLine={false} interval={0} />
            <YAxis tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }} axisLine={false} tickLine={false} tickFormatter={compact} width={50} />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{ border: "1px solid rgba(10,10,10,0.15)", borderRadius: 0, fontSize: 12 }}
              cursor={{ fill: "#0A0A0A", fillOpacity: 0.04 }}
            />
            {data.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {data.series.map((s, i) => (
              <Bar
                key={s.code}
                dataKey={s.code}
                name={s.display_name}
                fill={colors[i]}
                stackId={isStacked ? "stack" : undefined}
                radius={isStacked ? 0 : [2, 2, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#0A0A0A" strokeOpacity={0.04} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }} axisLine={{ stroke: "#0A0A0A", strokeOpacity: 0.1 }} tickLine={false} interval={0} />
            <YAxis tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }} axisLine={false} tickLine={false} tickFormatter={compact} width={50} />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{ border: "1px solid rgba(10,10,10,0.15)", borderRadius: 0, fontSize: 12 }}
              cursor={{ stroke: "#0A0A0A", strokeOpacity: 0.1, strokeWidth: 1 }}
            />
            {data.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {data.series.map((s, i) => (
              <Line
                key={s.code}
                type="monotone"
                dataKey={s.code}
                name={s.display_name}
                stroke={colors[i]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: colors[i], stroke: "white", strokeWidth: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
