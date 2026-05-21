"use client";

import { useState } from "react";

interface ProvenanceEntry {
  value: number;
  source: string;
  plant_override?: boolean;
  param_id?: string;
  formula_id?: string;
}

interface Props {
  expression: string;
  provenance: Record<string, ProvenanceEntry>;
  traceSteps?: Record<string, unknown>[] | null;
}

const SOURCE_STYLES: Record<string, { color: string; label: string }> = {
  input_data: { color: "text-slate-600", label: "input data" },
  constant: { color: "text-blue-600", label: "constant" },
  formula_output: { color: "text-purple-600", label: "formula" },
  aggregation: { color: "text-amber-600", label: "aggregation" },
  cached: { color: "text-slate-400", label: "cached" },
  default: { color: "text-red-500", label: "default (missing)" },
};

export function FormulaTrace({ expression, provenance, traceSteps }: Props) {
  const [showSteps, setShowSteps] = useState(false);
  const entries = Object.entries(provenance);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-slate-400">No provenance data available.</p>
    );
  }

  return (
    <div className="space-y-2 font-mono text-xs">
      <div className="text-slate-500 break-all">{expression}</div>

      <div className="space-y-1">
        {entries.map(([name, info]) => {
          const style = SOURCE_STYLES[info.source] ?? SOURCE_STYLES.default;
          return (
            <div key={name} className="flex items-center gap-2">
              <span className="text-slate-800">
                {name} = {info.value}
              </span>
              <span className={style.color}>
                [{style.label}
                {info.plant_override ? " · plant override" : ""}]
              </span>
            </div>
          );
        })}
      </div>

      {traceSteps && traceSteps.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="text-[10px] text-slate-400 hover:text-slate-600 underline"
          >
            {showSteps ? "Hide eval steps" : "Show eval steps"}
          </button>
          {showSteps && (
            <pre className="mt-1 p-2 bg-slate-50 rounded border border-slate-200 text-[10px] overflow-x-auto max-h-48">
              {JSON.stringify(traceSteps, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
