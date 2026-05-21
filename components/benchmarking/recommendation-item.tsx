"use client";

import { Recommendation } from "@/lib/api/benchmarking";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ESGCategory = "E" | "S" | "G";

export type { Recommendation };

interface RecommendationItemProps {
  recommendation: Recommendation;
}

interface RecommendationsListProps {
  recommendations: Recommendation[];
  isLoading: boolean;
}

// ── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_CLASS: Record<ESGCategory, string> = {
  E: "bg-green-100 text-green-700",
  S: "bg-blue-100 text-blue-700",
  G: "bg-purple-100 text-purple-700",
};

function CategoryBadge({ category }: { category: ESGCategory }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold shrink-0 ${CATEGORY_CLASS[category]}`}
      aria-label={`Category: ${category}`}
    >
      {category}
    </span>
  );
}

// ── Single item ───────────────────────────────────────────────────────────────

function RecommendationItem({ recommendation: r }: RecommendationItemProps) {
  return (
    <div className="flex gap-3 border border-[#0A0A0A]/10 rounded-lg p-4">
      <CategoryBadge category={r.category} />
      <div className="space-y-1 min-w-0">
        <p className="text-sm font-medium text-[#0A0A0A] leading-snug">
          {r.text}
        </p>
        {r.rationale && (
          <p className="text-xs text-[#0A0A0A]/60 leading-relaxed">
            {r.rationale}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function RecommendationsSection({
  title,
  items,
}: {
  title: string;
  items: Recommendation[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#0A0A0A]/70 uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-2">
        {items.map((r, idx) => (
          <RecommendationItem key={r.id ?? idx} recommendation={r} />
        ))}
      </div>
    </div>
  );
}

// ── Main list export ──────────────────────────────────────────────────────────

export function RecommendationsList({
  recommendations,
  isLoading,
}: RecommendationsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#0A0A0A]/20 rounded-xl">
        <p className="text-[#0A0A0A]/50 text-sm">
          Recommendations are generated after all peers are analysed.
        </p>
      </div>
    );
  }

  const shortTerm = recommendations.filter((r) => r.priority === "short_term");
  const longTerm = recommendations.filter((r) => r.priority === "long_term");

  return (
    <div className="space-y-6">
      <RecommendationsSection title="Short-Term" items={shortTerm} />
      <RecommendationsSection title="Long-Term" items={longTerm} />
    </div>
  );
}
