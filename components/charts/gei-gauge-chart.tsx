"use client";

import { useMemo } from "react";

interface LeverContribution {
  lever: string;
  reduction: number;
  color: string;
}

interface LeverContributionBarProps {
  contributions: LeverContribution[];
  totalReduction: number;
}

/**
 * Stacked horizontal bar showing contribution of each lever to GEI reduction
 */
export function LeverContributionBar({
  contributions,
  totalReduction,
}: LeverContributionBarProps) {
  // Filter out contributions with 0 or negative values
  const validContributions = useMemo(
    () => contributions.filter((c) => c.reduction > 0),
    [contributions],
  );

  // Calculate percentages
  const contributionData = useMemo(() => {
    if (totalReduction <= 0) return [];

    return validContributions.map((c) => ({
      ...c,
      percentage: (c.reduction / totalReduction) * 100,
      reductionInGei: c.reduction / 1000, // Convert kg to tCO₂e if needed
    }));
  }, [validContributions, totalReduction]);

  if (contributionData.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-4">
        No lever contributions to display. Adjust lever values to see impact.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stacked Bar */}
      <div className="relative h-10 rounded-lg overflow-hidden flex bg-gray-100">
        {contributionData.map((item, index) => (
          <div
            key={item.lever}
            className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
            style={{
              width: `${item.percentage}%`,
              backgroundColor: item.color,
              minWidth: item.percentage > 5 ? undefined : "24px",
            }}
            title={`${item.lever}: ${item.reduction.toFixed(1)} kg CO₂/t (${item.percentage.toFixed(1)}%)`}
          >
            {item.percentage >= 10 && (
              <span className="truncate px-1">
                {item.percentage.toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {contributionData.map((item) => (
          <div key={item.lever} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <div className="text-sm">
              <span className="font-medium text-gray-900">{item.lever}</span>
              <span className="text-gray-500 ml-1">
                ({item.reduction.toFixed(1)} kg CO₂/t)
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <span className="text-sm font-medium text-gray-600">
          Total GEI Reduction
        </span>
        <span className="text-lg font-mono font-bold text-green-600">
          -{(totalReduction / 1000).toFixed(3)} tCO₂e/ton
        </span>
      </div>
    </div>
  );
}
