"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface KpiTileProps {
  label: string;
  unit: string;
  value: number | null;
  isStale?: boolean;
  vsmeCell?: string | null;
  trace?: {
    inputs: Record<string, number>;
    expression: string;
  } | null;
}

function formatValue(v: number | null) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "M";
  if (abs >= 1_000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return v.toExponential(2);
}

export function KpiTile({ label, unit, value, isStale, vsmeCell, trace }: KpiTileProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group text-left w-full bg-white border border-[#0A0A0A]/10 px-4 py-3 transition-all",
            "hover:border-[#0A0A0A]/30 hover:shadow-sm",
            isStale && "border-amber-300 bg-amber-50/30",
          )}
        >
          <div className="text-[11px] uppercase tracking-wide text-[#0A0A0A]/60 leading-snug min-h-[28px]">
            {label}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-medium text-[#0A0A0A] tabular-nums">
              {formatValue(value)}
            </span>
            <span className="text-xs text-[#0A0A0A]/60">{unit}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            {vsmeCell ? (
              <span className="text-[10px] text-[#0A0A0A]/40">VSME {vsmeCell}</span>
            ) : <span />}
            {isStale && (
              <span className="text-[10px] text-amber-700">stale · click to view</span>
            )}
          </div>
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
