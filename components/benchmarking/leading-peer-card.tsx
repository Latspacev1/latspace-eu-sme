"use client";

import { BenchmarkingResult, CRITERION_LABELS } from "@/lib/api/benchmarking";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadingPeerCardProps {
  result: BenchmarkingResult;
  peerName: string;
}

interface LeadingPeersListProps {
  results: BenchmarkingResult[];
  peerNames: Record<string, string>;
  isLoading: boolean;
}

// ── Card ──────────────────────────────────────────────────────────────────────

function LeadingPeerCard({ result, peerName }: LeadingPeerCardProps) {
  const standoutCriteria = result.scores.filter(
    (s) => s.maturity_band === "leading",
  );

  return (
    <div className="border border-green-200 bg-green-50/40 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#0A0A0A]">{peerName}</h3>
        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
          Leading
        </span>
      </div>

      {standoutCriteria.length > 0 ? (
        <div>
          <p className="text-xs text-[#0A0A0A]/50 mb-2 uppercase tracking-wide font-medium">
            Standout criteria
          </p>
          <div className="flex flex-wrap gap-1.5">
            {standoutCriteria.map((s) => (
              <span
                key={s.criterion}
                className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium capitalize"
              >
                {CRITERION_LABELS[s.criterion] ?? s.criterion.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#0A0A0A]/40">
          No individual leading criteria found.
        </p>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LeadingPeersSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[...Array(2)].map((_, i) => (
        <div
          key={i}
          className="border border-[#0A0A0A]/10 rounded-xl p-5 space-y-3"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function LeadingPeersList({
  results,
  peerNames,
  isLoading,
}: LeadingPeersListProps) {
  if (isLoading) return <LeadingPeersSkeleton />;

  const leaders = results.filter((r) => r.overall_band === "leading");

  if (leaders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[#0A0A0A]/50 text-sm">
          No peers have achieved Leading overall band yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {leaders.map((result) => (
        <LeadingPeerCard
          key={result.peer_id}
          result={result}
          peerName={peerNames[result.peer_id] ?? result.peer_id}
        />
      ))}
    </div>
  );
}
