"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { benchmarkingApi, BenchmarkingResult, PeerLibraryItem } from "@/lib/api/benchmarking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaturityGrid } from "@/components/benchmarking/maturity-grid";
import { CategorySummaryCard, type ThemeKey } from "@/components/benchmarking/category-summary-card";
import { LeadingPeersList } from "@/components/benchmarking/leading-peer-card";
import { RecommendationsList } from "@/components/benchmarking/recommendation-item";
import { Skeleton } from "@/components/ui/skeleton";

// ── Constants ─────────────────────────────────────────────────────────────────

const THEMES: ThemeKey[] = [
  "reporting_disclosures",
  "ghg_net_zero",
  "scores_certifications",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface BenchmarkingResultsClientProps {
  projectId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPeerNames(
  peerLibrary: PeerLibraryItem[],
  results: BenchmarkingResult[],
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const peer of peerLibrary) {
    names[peer.peer_id] = peer.name;
  }
  // Fallback: if a result peer_id isn't in library, keep the id as display
  for (const r of results) {
    if (!names[r.peer_id]) {
      names[r.peer_id] = r.peer_id;
    }
  }
  return names;
}

// ── Header skeleton ───────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="space-y-2 mb-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function BenchmarkingResultsClient({
  projectId,
}: BenchmarkingResultsClientProps) {
  const { data: projectResponse, isLoading: projectLoading } = useQuery({
    queryKey: ["benchmarking-project", projectId],
    queryFn: () => benchmarkingApi.getProject(projectId),
    staleTime: 30_000,
  });

  const { data: peerLibrary = [], isLoading: peersLoading } = useQuery({
    queryKey: ["benchmarking-peer-library"],
    queryFn: async () => {
      const res = await benchmarkingApi.listPeerLibrary();
      return res.success && res.data ? res.data : [];
    },
    staleTime: 5 * 60_000,
  });

  const isLoading = projectLoading || peersLoading;
  const detail = projectResponse?.data;
  const results: BenchmarkingResult[] = detail?.results ?? [];
  const peerNames = useMemo(
    () => buildPeerNames(peerLibrary, results),
    [peerLibrary, results],
  );

  return (
    <div>
      {/* Header */}
      {isLoading ? (
        <HeaderSkeleton />
      ) : (
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">
            {detail?.project?.name ?? "Benchmarking Results"}
          </h1>
          <p className="text-sm text-[#0A0A0A]/50 mt-1 capitalize">
            {detail?.project?.segment?.replace(/_/g, " ")} ·{" "}
            {results.length} peer{results.length !== 1 ? "s" : ""} analysed
          </p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="maturity-grid">
        <TabsList className="mb-6">
          <TabsTrigger value="maturity-grid">Maturity Grid</TabsTrigger>
          <TabsTrigger value="category-summary">Category Summary</TabsTrigger>
          <TabsTrigger value="leading-peers">Leading Peers</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Tab 1 — Maturity Grid */}
        <TabsContent value="maturity-grid">
          <MaturityGrid
            results={results}
            peerNames={peerNames}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 2 — Category Summary */}
        <TabsContent value="category-summary">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {THEMES.map((theme) => (
              <CategorySummaryCard
                key={theme}
                theme={theme}
                results={results}
                peerNames={peerNames}
                isLoading={isLoading}
              />
            ))}
          </div>
        </TabsContent>

        {/* Tab 3 — Leading Peers */}
        <TabsContent value="leading-peers">
          <LeadingPeersList
            results={results}
            peerNames={peerNames}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Tab 4 — Recommendations */}
        <TabsContent value="recommendations">
          <RecommendationsList
            recommendations={detail?.recommendations ?? []}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
