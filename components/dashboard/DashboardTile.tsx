"use client";

// One pinned tile in the dashboard grid. Fetches its own data from
// /api/dashboard/tiles/:id/data on mount so the chart shows live values.
// The fetch is React-Query'd by tile id for cheap re-renders during
// drag/resize.

import { useQuery } from "@tanstack/react-query";
import { X, GripVertical } from "lucide-react";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import { dashboardFetch } from "@/lib/dashboard/client-fetch";
import type { ChartSpec, ChartData } from "@/lib/dashboard/chart-spec";

interface TileDataResponse {
  tile: { id: string; spec: ChartSpec };
  data: ChartData;
}

export interface DashboardTileProps {
  tileId: string;
  spec: ChartSpec;
  onRemove: (id: string) => void;
}

export function DashboardTile({ tileId, spec, onRemove }: DashboardTileProps) {
  const q = useQuery<TileDataResponse>({
    queryKey: ["dashboard-tile-data", tileId],
    queryFn: async () => {
      const res = await dashboardFetch(`/api/dashboard/tiles/${tileId}/data`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="h-full w-full bg-white border border-[#0A0A0A]/10 flex flex-col">
      <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-[#0A0A0A]/[0.06] flex-shrink-0">
        <div className="flex items-start gap-1.5 min-w-0">
          <GripVertical
            className="w-3.5 h-3.5 text-[#0A0A0A]/25 mt-0.5 flex-shrink-0 tile-drag-handle cursor-move"
            strokeWidth={1.5}
          />
          <div className="min-w-0">
            <h4 className="text-[13px] font-medium text-[#0A0A0A] truncate">{spec.title}</h4>
            <p className="text-[10px] text-[#0A0A0A]/45 mt-0.5">
              {q.data?.data.period_label ?? spec.period_code} · {spec.granularity}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(tileId)}
          className="flex-shrink-0 p-1 text-[#0A0A0A]/40 hover:text-[#0A0A0A] hover:bg-[#0A0A0A]/[0.04] transition-colors"
          aria-label="Unpin chart"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 p-2 overflow-hidden">
        {q.isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-[#0A0A0A]/40">Loading…</div>
        ) : q.error ? (
          <div className="h-full flex items-center justify-center text-xs text-red-600/80 px-2 text-center">
            {(q.error as Error).message}
          </div>
        ) : q.data ? (
          <ChartRenderer spec={spec} data={q.data.data} height={undefined as unknown as number} />
        ) : null}
      </div>
    </div>
  );
}
