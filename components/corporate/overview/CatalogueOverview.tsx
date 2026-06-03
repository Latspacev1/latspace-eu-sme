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

// Build data-aware starter prompts from whatever metrics the org has actually
// extracted, so the omnibar advertises questions that will return real data
// instead of generic placeholders. Falls back to nothing (AiSearchBar then
// shows its own defaults) when there are no metrics yet.
function buildSuggestions(metrics: Record<string, CurrentMetricRow[]>): string[] {
  const rows = Object.values(metrics).flat();
  if (rows.length === 0) return [];

  const suggestions: string[] = [];
  const named = rows.filter((r) => r.display_name).slice(0, 4);

  // 1) Trend a real metric over time.
  if (named[0]) suggestions.push(`Show ${named[0].display_name.toLowerCase()} through the year`);

  // 2) Compare two real metrics, when available.
  if (named[1]) {
    suggestions.push(
      `Compare ${named[0].display_name.toLowerCase()} and ${named[1].display_name.toLowerCase()}`,
    );
  }

  // 3) Summarize a whole section the user owns.
  const sectionNames = Object.keys(metrics).filter((s) => (metrics[s] ?? []).length > 0);
  if (sectionNames[0]) {
    suggestions.push(`Summarize my ${sectionTitle(sectionNames[0]).toLowerCase()} metrics`);
  }

  // 4) A couple more single-metric plots for breadth.
  for (const r of named.slice(2)) {
    suggestions.push(`Plot ${r.display_name.toLowerCase()}`);
  }

  return suggestions.slice(0, 5);
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
  const suggestions = data ? buildSuggestions(data.metrics) : [];

  return (
    <div className="bg-white min-h-screen">
      {/* ── Hero band ─────────────────────────────────────────────────
          Centered intro: big headline, one large AI box, and data-aware
          starter prompts so the user immediately knows what they can ask. */}
      <div className="border-b border-[#1F5F5B]/10 bg-white">
        <div className="px-6 pt-12 pb-10 max-w-3xl mx-auto text-center">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#1F5F5B]/70">
            {user?.companyName || "Your organization"}
            {data?.period?.label ? ` · ${data.period.label}` : ""}
          </p>
          <h1 className="mt-3 text-[#0A0A0A] text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Explore your sustainability data
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#3A4A47]">
            {hasMetrics
              ? "Ask a question in plain language to start creating graphs — then pin them here to monitor your sustainability performance."
              : "Once your data is entered, you can create charts and graphs and pin them here to monitor your sustainability performance."}
          </p>

          <div className="mt-7 text-left">
            <AiSearchBar
              hero
              suggestions={suggestions}
              pinnedSpecKeys={pinnedSpecKeys}
              onPinned={onPinned}
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8 max-w-[1600px] mx-auto">
        <header className="flex items-center justify-between gap-6">
          <div>
            <h2 className="text-[#0A0A0A] text-lg font-semibold tracking-tight leading-tight">
              Your dashboard
            </h2>
            <p className="text-[#0A0A0A]/50 text-sm mt-0.5">
              Pinned charts and committed metrics
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
            {recalc.isPending ? "Syncing…" : "Sync"}
          </Button>
        </header>

        <section className="space-y-4">
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
