"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeadlineKpiProps {
  label: string;
  value: number | null;
  unit: string;
  // Optional small trend indicator
  trend?: { direction: "up" | "down" | "flat"; deltaPct?: number; label?: string };
  // Optional accent icon at top-right
  Icon?: LucideIcon;
  accent?: "default" | "success" | "warning" | "danger";
  // Trace for click-through (same shape as KpiTile)
  vsmeCell?: string | null;
  trace?: { inputs: Record<string, number>; expression: string } | null;
}

function formatNumber(v: number | null) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "M";
  if (abs >= 1_000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return v.toExponential(2);
}

const accentStyles = {
  default: "border-[#0A0A0A]/10",
  success: "border-emerald-200 bg-emerald-50/20",
  warning: "border-amber-200 bg-amber-50/20",
  danger:  "border-red-200 bg-red-50/20",
};

const accentText = {
  default: "text-[#0A0A0A]",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger:  "text-red-700",
};

export function HeadlineKpi({
  label,
  value,
  unit,
  trend,
  Icon,
  accent = "default",
  vsmeCell,
  trace,
}: HeadlineKpiProps) {
  const [open, setOpen] = useState(false);
  const trendIcon =
    trend?.direction === "up" ? ArrowUpRight :
    trend?.direction === "down" ? ArrowDownRight : Minus;
  const TrendIcon = trendIcon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group text-left w-full bg-white border px-5 py-4 transition-all",
            "hover:shadow-sm hover:border-[#0A0A0A]/30",
            accentStyles[accent],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A]/60 leading-snug">
              {label}
            </div>
            {Icon && (
              <div className="w-8 h-8 border border-[#0A0A0A]/10 bg-[#F5F4F0] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#0A0A0A]/60" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-medium tabular-nums leading-none", accentText[accent])}>
              {formatNumber(value)}
            </span>
            <span className="text-xs text-[#0A0A0A]/60">{unit}</span>
          </div>
          {trend && (
            <div className={cn(
              "mt-2 inline-flex items-center gap-1 text-xs",
              trend.direction === "up"   && "text-red-600",
              trend.direction === "down" && "text-emerald-600",
              trend.direction === "flat" && "text-[#0A0A0A]/50",
            )}>
              <TrendIcon className="w-3.5 h-3.5" strokeWidth={2} />
              {trend.deltaPct != null && (
                <span className="tabular-nums">{trend.deltaPct > 0 ? "+" : ""}{trend.deltaPct.toFixed(1)}%</span>
              )}
              {trend.label && <span className="text-[#0A0A0A]/60">{trend.label}</span>}
            </div>
          )}
          {vsmeCell && (
            <div className="mt-2 text-[10px] text-[#0A0A0A]/40">VSME {vsmeCell}</div>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="start">
        <div className="border-b border-[#0A0A0A]/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-[#0A0A0A]/50">Trace</div>
          <div className="text-sm font-medium text-[#0A0A0A] mt-0.5">{label}</div>
          {vsmeCell && (
            <div className="text-[11px] text-[#0A0A0A]/60 mt-0.5">VSME Digital Template cell: <code>{vsmeCell}</code></div>
          )}
        </div>
        <div className="px-4 py-3 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#0A0A0A]/50 mb-1">Formula</div>
            <code className="block text-xs bg-[#F5F4F0] px-2 py-1.5 rounded font-mono text-[#0A0A0A] break-all">
              {trace?.expression ?? "—"}
            </code>
          </div>
          {trace?.inputs && Object.keys(trace.inputs).length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#0A0A0A]/50 mb-1">Inputs</div>
              <div className="space-y-0.5">
                {Object.entries(trace.inputs).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <code className="text-[#0A0A0A]/70 font-mono">{k}</code>
                    <span className="tabular-nums text-[#0A0A0A]">
                      {v.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pt-1 border-t border-[#0A0A0A]/5">
            <div className="flex justify-between text-xs">
              <span className="text-[#0A0A0A]/60">Result</span>
              <span className="font-medium tabular-nums">
                {value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 6 })} {unit}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
