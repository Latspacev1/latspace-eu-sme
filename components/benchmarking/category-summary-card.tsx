"use client";

import { useMemo } from "react";
import { BenchmarkingResult, MaturityBand, ThemeKey } from "@/lib/api/benchmarking";
import { Skeleton } from "@/components/ui/skeleton";

export type { ThemeKey };

const THEME_LABELS: Record<ThemeKey, string> = {
  reporting_disclosures: "Reporting & Disclosures",
  ghg_net_zero: "GHG Methodologies & Net Zero",
  scores_certifications: "Scores & Certifications",
};

const BAND_ORDER: MaturityBand[] = [
  "leading",
  "comprehensive",
  "defined",
  "basic",
  "not_disclosed",
];

const BAND_LABEL: Record<MaturityBand, string> = {
  leading: "Leading",
  comprehensive: "Comprehensive",
  defined: "Defined",
  basic: "Basic",
  not_disclosed: "Not Disclosed",
};

const BAND_CHIP: Record<MaturityBand, string> = {
  basic: "bg-gray-100 text-gray-600",
  defined: "bg-yellow-100 text-yellow-700",
  comprehensive: "bg-blue-100 text-blue-700",
  leading: "bg-green-100 text-green-700",
  not_disclosed: "bg-muted text-muted-foreground",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategorySummaryCardProps {
  theme: ThemeKey;
  results: BenchmarkingResult[];
  peerNames: Record<string, string>;
  isLoading: boolean;
}

interface PeerThemeSummary {
  peerId: string;
  peerName: string;
  dominantBand: MaturityBand;
  criteriaCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeThemeSummaries(
  results: BenchmarkingResult[],
  theme: ThemeKey,
  peerNames: Record<string, string>,
): PeerThemeSummary[] {
  return results
    .map((result) => {
      const themeScores = result.scores.filter((s) => s.theme === theme);
      if (themeScores.length === 0) return null;

      // Pick the best band this peer achieved across criteria in this theme
      const bands = themeScores.map((s) => s.maturity_band);
      const best =
        BAND_ORDER.find((b) => bands.includes(b)) ?? "not_disclosed";

      return {
        peerId: result.peer_id,
        peerName: peerNames[result.peer_id] ?? result.peer_id,
        dominantBand: best,
        criteriaCount: themeScores.length,
      } satisfies PeerThemeSummary;
    })
    .filter((s): s is PeerThemeSummary => s !== null)
    .sort(
      (a, b) =>
        BAND_ORDER.indexOf(a.dominantBand) -
        BAND_ORDER.indexOf(b.dominantBand),
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CategorySummaryCard({
  theme,
  results,
  peerNames,
  isLoading,
}: CategorySummaryCardProps) {
  const summaries = useMemo(
    () => computeThemeSummaries(results, theme, peerNames),
    [results, theme, peerNames],
  );

  if (isLoading) {
    return (
      <div className="border border-[#0A0A0A]/10 rounded-xl p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="border border-[#0A0A0A]/10 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-[#0A0A0A] text-sm">
        {THEME_LABELS[theme]}
      </h3>

      {summaries.length === 0 ? (
        <p className="text-sm text-[#0A0A0A]/40 py-4 text-center">
          No data for this theme yet.
        </p>
      ) : (
        <ol className="space-y-2">
          {summaries.map((s, idx) => (
            <li
              key={s.peerId}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-[#0A0A0A]/40 w-5 shrink-0 text-right">
                  {idx + 1}
                </span>
                <span className="text-sm text-[#0A0A0A] truncate">
                  {s.peerName}
                </span>
              </div>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium shrink-0 ${BAND_CHIP[s.dominantBand]}`}
              >
                {BAND_LABEL[s.dominantBand]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
