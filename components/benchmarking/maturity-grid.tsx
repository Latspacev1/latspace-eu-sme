"use client";

import { useMemo } from "react";
import { BenchmarkingResult, CRITERION_LABELS, CriterionScore } from "@/lib/api/benchmarking";
import { MaturityCell } from "./maturity-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_CRITERIA: string[] = [
  "ghg_scope1_2_disclosure",
  "ghg_scope3_disclosure",
  "ghg_methodology",
  "external_assurance",
  "net_zero_target",
  "sbti_alignment",
  "renewable_energy_pct",
  "climate_risk_assessment",
  "internal_carbon_price",
  "carbon_offsets_recs",
  "digital_ghg_platform",
  "gresb_score",
  "cdp_disclosure",
  "green_building_certs",
  "esg_report_published",
  "board_esg_oversight",
  "supplier_esg_screening",
  "esg_investment_criteria",
  "integrated_reporting",
];

function criterionLabel(key: string): string {
  return CRITERION_LABELS[key] ?? key.replace(/_/g, " ");
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MaturityGridProps {
  results: BenchmarkingResult[];
  peerNames: Record<string, string>;
  isLoading: boolean;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[#0A0A0A]/50 text-sm">
        No results available yet. Run the analysis to populate the maturity grid.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MaturityGrid({ results, peerNames, isLoading }: MaturityGridProps) {
  // Build a lookup: peer_id → criterion → CriterionScore
  const scoreMap = useMemo(() => {
    const map = new Map<string, Map<string, CriterionScore>>();
    for (const result of results) {
      const byKey = new Map<string, CriterionScore>();
      for (const score of result.scores) {
        byKey.set(score.criterion, score);
      }
      map.set(result.peer_id, byKey);
    }
    return map;
  }, [results]);

  // Derive column keys from data, fall back to defaults
  const columns = useMemo(() => {
    const usedKeys = new Set<string>();
    for (const result of results) {
      for (const score of result.scores) {
        usedKeys.add(score.criterion);
      }
    }
    return usedKeys.size > 0
      ? DEFAULT_CRITERIA.filter((k) => usedKeys.has(k))
      : DEFAULT_CRITERIA;
  }, [results]);

  if (isLoading) return <GridSkeleton />;
  if (results.length === 0) return <EmptyState />;

  return (
    <ScrollArea className="w-full rounded-lg border border-[#0A0A0A]/10">
      <table
        className="w-full text-xs min-w-max"
        aria-label="Peer maturity grid"
      >
        <thead>
          <tr className="bg-[#EEF5F4] border-b border-[#0A0A0A]/10">
            <th
              scope="col"
              className="px-3 py-2 text-left text-[#0A0A0A]/60 font-medium sticky left-0 bg-[#EEF5F4] min-w-[140px]"
            >
              Peer
            </th>
            {columns.map((key) => (
              <th
                key={key}
                scope="col"
                className="px-2 py-2 text-center text-[#0A0A0A]/60 font-medium whitespace-nowrap"
                title={criterionLabel(key)}
              >
                {criterionLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((result, idx) => {
            const peerScores = scoreMap.get(result.peer_id);
            const peerLabel = peerNames[result.peer_id] ?? result.peer_id;
            return (
              <tr
                key={result.peer_id}
                className={
                  idx % 2 === 0
                    ? "bg-white"
                    : "bg-[#F5FAF9]"
                }
              >
                <th
                  scope="row"
                  className={`px-3 py-2 font-medium text-[#0A0A0A] sticky left-0 border-r border-[#0A0A0A]/10 max-w-[160px] truncate ${idx % 2 === 0 ? "bg-white" : "bg-[#F5FAF9]"}`}
                >
                  {peerLabel}
                </th>
                {columns.map((key) => (
                  <MaturityCell
                    key={key}
                    score={peerScores?.get(key)}
                    ariaLabel={`${peerLabel} ${criterionLabel(key)}`}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
