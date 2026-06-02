"use client";

// Catalogue-driven overview. Replaces the hardcoded ChainCraft VsmeOverview:
// instead of a fixed list of VSME sections/codes, it renders one KpiGroup per
// distinct `section` returned by /api/metrics for the current org + period, so
// it populates automatically from whatever the user has extracted and
// committed. The AI search bar + pinned dashboard grid sit on top, unchanged.

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KpiGroup } from "@/components/vsme/KpiGroup";
import { AiSearchBar } from "@/components/dashboard/AiSearchBar";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { dashboardFetch } from "@/lib/dashboard/client-fetch";
import { useAppStore } from "@/lib/store/useAppStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CurrentMetricRow } from "@/lib/supabase/types";

interface MetricsResponse {
  period: { id: string; code: string; label: string; status: string } | null;
  metrics: Record<string, CurrentMetricRow[]>;
  stale_count: number;
}

// Humanize a free-text section key for the group heading, e.g.
// "vsme_b3_energy" → "VSME B3 Energy", "energy" → "Energy".
function sectionTitle(section: string): string {
  return section
    .split("_")
    .map((w) => (w.startsWith("vsme") ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .map((w) => (/^b\d|^c\d/i.test(w) ? w.toUpperCase() : w))
    .join(" ");
}

export function CatalogueOverview() {
  const qc = useQueryClient();
  const { user } = useAppStore();
  const [pinnedSpecKeys, setPinnedSpecKeys] = useState<Set<string>>(new Set());

  const onGridChange = useCallback((keys: Set<string>) => setPinnedSpecKeys(keys), []);
  const onPinned = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["dashboard-tiles"] });
  }, [qc]);

  async function readError(res: Response, fallback: string) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try { return (await res.json()).error ?? fallback; } catch { /* fallthrough */ }
    }
    const text = (await res.text()).slice(0, 200);
    return `${fallback}${text ? ` — ${text}` : ""}`;
  }

  const metricsQ = useQuery<MetricsResponse>({
    queryKey: ["metrics", "current"],
    queryFn: async () => {
      const res = await dashboardFetch(`/api/metrics?period=current`);
      if (!res.ok) throw new Error(await readError(res, `GET metrics → HTTP ${res.status}`));
      return res.json();
    },
    retry: false,
  });

  const recalc = useMutation({
    mutationFn: async () => {
      const res = await dashboardFetch("/api/metrics/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "current" }),
      });
      if (!res.ok) throw new Error(await readError(res, `POST recalculate → HTTP ${res.status}`));
      return res.json();
    },
    onSuccess: (r) => {
      toast.success(`Recalculated ${r.formulas_evaluated} metrics in ${r.duration_ms} ms`);
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e) => toast.error(`Recalc failed: ${(e as Error).message}`),
  });

  const data = metricsQ.data;
  const sections = data ? Object.keys(data.metrics) : [];
  const hasMetrics = sections.length > 0;

  return (
    <div className="bg-white min-h-screen">
      <div className="px-6 py-6 space-y-8 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-[#0A0A0A] text-2xl font-bold tracking-tight leading-tight">
              Sustainability Dashboard
            </h1>
            <p className="text-[#1F5F5B] text-sm mt-1">
              {user?.companyName || "Your organization"}
              {data?.period?.label ? ` · ${data.period.label}` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
            {recalc.isPending ? "Recalculating…" : "Recalculate"}
          </Button>
        </header>

        <section className="space-y-4">
          <AiSearchBar pinnedSpecKeys={pinnedSpecKeys} onPinned={onPinned} />
          <DashboardGrid onChange={onGridChange} />
        </section>

        {metricsQ.error && (
          <div className="border border-red-200 bg-red-50 text-red-900 text-sm px-4 py-3 rounded">
            {(metricsQ.error as Error).message}
          </div>
        )}

        {metricsQ.isLoading && !data && (
          <div className="text-sm text-[#0A0A0A]/60">Loading metrics…</div>
        )}

        {data && !hasMetrics && (
          <div className="border border-[#0A0A0A]/10 bg-[#F5F4F0] text-sm px-4 py-6">
            No metrics yet — <strong>upload a document</strong> to populate your dashboard, then click{" "}
            <strong>Recalculate</strong>.
          </div>
        )}

        {hasMetrics && sections.map((section) => {
          const tiles = (data!.metrics[section] ?? []).map((r) => ({
            id: r.parameter_code,
            label: r.display_name,
            unit: r.unit,
            value: r.value,
            isStale: r.is_stale,
            vsmeCell: r.vsme_cell,
            trace: r.trace,
          }));
          if (tiles.length === 0) return null;
          return <KpiGroup key={section} title={sectionTitle(section)} tiles={tiles} columns={4} />;
        })}
      </div>
    </div>
  );
}
