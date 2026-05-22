"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { LineChart as LineIcon, BarChart3 as BarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrendSeries {
  code: string;
  display_name: string;
  unit: string;
  values: (number | null)[];   // length 12
}

export interface TrendChartProps {
  title: string;
  months: string[];
  // Single metric per chart — no dropdown.
  series: TrendSeries;
  height?: number;
  // Brand accent for the single line — defaults to a deep teal that reads
  // serious and minimal.
  color?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────
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

// ── main component ───────────────────────────────────────────────────────
export function TrendChart({
  title,
  months,
  series,
  height = 280,
  color = "#1F5F5B",
}: TrendChartProps) {
  const [variant, setVariant] = useState<"line" | "bar">("line");

  const data = useMemo(() => months.map((m, i) => ({
    month: m,
    value: series.values[i] ?? null,
  })), [months, series]);

  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-5">
      {/* ── Header row ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base font-medium text-[#0A0A0A]">{title}</h3>
          <p className="text-xs text-[#0A0A0A]/50 mt-0.5">
            {series.display_name} <span className="text-[#0A0A0A]/40">({series.unit})</span>
          </p>
        </div>

        {/* Chart-type toggle (line / bar) */}
        <div className="inline-flex border border-[#0A0A0A]/15">
          <button
            onClick={() => setVariant("line")}
            className={cn(
              "px-2.5 py-1.5 transition-colors",
              variant === "line" ? "bg-[#0A0A0A]/5" : "bg-white hover:bg-[#0A0A0A]/[0.02]",
            )}
            aria-label="Line chart"
          >
            <LineIcon className="w-3.5 h-3.5 text-[#0A0A0A]" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setVariant("bar")}
            className={cn(
              "px-2.5 py-1.5 border-l border-[#0A0A0A]/15 transition-colors",
              variant === "bar" ? "bg-[#0A0A0A]/5" : "bg-white hover:bg-[#0A0A0A]/[0.02]",
            )}
            aria-label="Bar chart"
          >
            <BarIcon className="w-3.5 h-3.5 text-[#0A0A0A]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────── */}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === "line" ? (
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#0A0A0A" strokeOpacity={0.04} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
                axisLine={{ stroke: "#0A0A0A", strokeOpacity: 0.1 }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={compact}
                width={50}
                label={{
                  value: series.unit,
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: { fill: "#0A0A0A", fillOpacity: 0.4, fontSize: 10, textAnchor: "middle" },
                }}
              />
              <Tooltip content={<MinimalTooltip series={series} />} cursor={{ stroke: "#0A0A0A", strokeOpacity: 0.1, strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2 }}
                connectNulls
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#0A0A0A" strokeOpacity={0.04} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
                axisLine={{ stroke: "#0A0A0A", strokeOpacity: 0.1 }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#0A0A0A", fontSize: 11, opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={compact}
                width={50}
              />
              <Tooltip content={<MinimalTooltip series={series} />} cursor={{ fill: "#0A0A0A", fillOpacity: 0.04 }} />
              <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} maxBarSize={36} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Tooltip (single value, clean card) ───────────────────────────────────
function MinimalTooltip({ active, payload, label, series }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  series: TrendSeries;
}) {
  if (!active || !payload?.length || payload[0]?.value == null) return null;
  return (
    <div className="bg-white border border-[#0A0A0A]/15 shadow-md px-3 py-2 text-xs">
      <div className="font-medium text-[#0A0A0A] mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[#0A0A0A]/60">{series.display_name}:</span>
        <span className="tabular-nums font-medium text-[#0A0A0A]">{precise(payload[0].value)}</span>
        <span className="text-[#0A0A0A]/50">{series.unit}</span>
      </div>
    </div>
  );
}
