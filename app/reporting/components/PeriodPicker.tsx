"use client";

import { useState, useMemo } from "react";

export type PeriodType = "fy" | "quarter" | "month";

interface PeriodPickerProps {
  onChange: (period: { type: PeriodType; fy: number; value: string; label: string }) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const FY_OPTIONS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 3 + i);
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildPeriodLabel(fy: number, type: PeriodType, value: string): string {
  const suffix = String(fy + 1).slice(2);
  const base = `FY ${fy}-${suffix}`;
  if (type === "fy") return base;
  if (type === "quarter") return `${base} ${value}`;
  return `${base} ${value}`;
}

export default function PeriodPicker({ onChange }: PeriodPickerProps) {
  const [type, setType] = useState<PeriodType>("fy");
  const [fy, setFy] = useState<number>(CURRENT_YEAR);
  const [value, setValue] = useState<string>("");

  const label = useMemo(() => buildPeriodLabel(fy, type, value), [fy, type, value]);

  const handleTypeChange = (newType: PeriodType) => {
    setType(newType);
    const newValue = newType === "quarter" ? "Q1" : newType === "month" ? "Jan" : "";
    setValue(newValue);
    onChange({ type: newType, fy, value: newValue, label: buildPeriodLabel(fy, newType, newValue) });
  };

  const handleFyChange = (newFy: number) => {
    setFy(newFy);
    onChange({ type, fy: newFy, value, label: buildPeriodLabel(newFy, type, value) });
  };

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    onChange({ type, fy, value: newValue, label: buildPeriodLabel(fy, type, newValue) });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["fy", "quarter", "month"] as PeriodType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
              type === t
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t === "fy" ? "Financial Year" : t}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Financial Year</label>
        <select
          value={fy}
          onChange={(e) => handleFyChange(Number(e.target.value))}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          {FY_OPTIONS.map((y) => (
            <option key={y} value={y}>
              FY {y}-{String(y + 1).slice(2)}
            </option>
          ))}
        </select>
      </div>

      {type === "quarter" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quarter</label>
          <select
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            {QUARTERS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>
      )}

      {type === "month" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
          <select
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Period: <span className="font-medium text-slate-900">{label}</span>
      </div>
    </div>
  );
}
