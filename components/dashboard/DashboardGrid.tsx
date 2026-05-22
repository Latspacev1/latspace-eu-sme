"use client";

// DashboardGrid — the right side of the AI dashboard. Loads pinned tiles
// from /api/dashboard/tiles, renders each via DashboardTile, and persists
// layout changes back to the server.
//
// Layout persistence: on every drag/resize stop we diff the new layout
// against the saved one and PATCH only the tiles that actually moved. Idle
// users don't pay write costs and a slow network can't lose state.

import { useMemo, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as RGL from "react-grid-layout";
import { toast } from "sonner";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { DashboardTile } from "@/components/dashboard/DashboardTile";
import { dashboardFetch } from "@/lib/dashboard/client-fetch";
import type { ChartSpec } from "@/lib/dashboard/chart-spec";
import { specKey } from "@/lib/dashboard/spec-key";

// react-grid-layout v2 dropped the WidthProvider HOC — the new pattern is
// to measure container width yourself and pass `width` to GridLayout. The
// @types package on npm still describes v1's API, so we declare a local
// shape that matches the v2 runtime and the props we actually use.
interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}
type Layout = LayoutItem;

interface RGLProps {
  className?: string;
  layout: LayoutItem[];
  cols: number;
  rowHeight: number;
  width: number;
  margin?: [number, number];
  draggableHandle?: string;
  compactType?: "vertical" | "horizontal" | null;
  preventCollision?: boolean;
  useCSSTransforms?: boolean;
  onLayoutChange?: (layout: LayoutItem[]) => void;
  children?: React.ReactNode;
}

const Mod = RGL as unknown as {
  default?: React.ComponentType<RGLProps>;
  GridLayout?: React.ComponentType<RGLProps>;
};
const ReactGridLayout: React.ComponentType<RGLProps> =
  Mod.default ?? Mod.GridLayout ?? (RGL as unknown as React.ComponentType<RGLProps>);

interface TileLayout { x: number; y: number; w: number; h: number }
interface TileRow {
  id: string;
  spec: ChartSpec;
  layout: TileLayout;
}

const COLS = 12;
const ROW_HEIGHT = 56;
const MARGIN: [number, number] = [12, 12];

// Per-kind tile sizing. KPI cards have a tight [2, 4] row band so they
// don't sprawl into empty space; chart-type tiles get [3, 8]. These caps
// rescue old pins (or accidental drags) where a tile ended up mostly empty
// below its content. Users can still resize freely within the band.
function minMaxH(kind: ChartSpec["kind"]): readonly [number, number] {
  return kind === "kpi" ? [2, 4] : [3, 8];
}
function clampHFor(kind: ChartSpec["kind"], h: number | undefined): number {
  const [min, max] = minMaxH(kind);
  return Math.min(max, Math.max(min, h ?? (kind === "kpi" ? 3 : 6)));
}

interface DashboardGridProps {
  onChange?: (keys: Set<string>) => void;
}

export function DashboardGrid({ onChange }: DashboardGridProps) {
  const qc = useQueryClient();

  // Measure container width — v2 of react-grid-layout no longer ships a
  // WidthProvider HOC, so we feed `width` from a ResizeObserver. SSR-safe
  // (starts at 0; first paint runs the observer).
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observe = () => setWidth(el.clientWidth);
    observe();
    const ro = new ResizeObserver(observe);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const q = useQuery<{ tiles: TileRow[] }>({
    queryKey: ["dashboard-tiles"],
    queryFn: async () => {
      const res = await dashboardFetch("/api/dashboard/tiles");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const tiles = useMemo(() => q.data?.tiles ?? [], [q.data]);

  // Layouts are derived from server data — no local mirror needed. When a
  // drag/resize completes, we PATCH the server and the mutation's optimistic
  // update writes the new layout into the cached tiles, so the grid stays
  // in place during the round-trip.
  const layouts: Layout[] = useMemo(() => tiles.map(t => {
    const [min, max] = minMaxH(t.spec.kind);
    return {
      i: t.id,
      x: t.layout.x ?? 0,
      y: t.layout.y ?? 0,
      w: t.layout.w ?? (t.spec.kind === "kpi" ? 4 : 6),
      h: clampHFor(t.spec.kind, t.layout.h),
      minW: t.spec.kind === "kpi" ? 2 : 3,
      minH: min,
      maxH: max,
    };
  }), [tiles]);

  const pinnedSpecKeys = useMemo(() => new Set(tiles.map(t => specKey(t.spec))), [tiles]);
  useEffect(() => { onChange?.(pinnedSpecKeys); }, [pinnedSpecKeys, onChange]);

  // Auto-heal: if any tile's stored `h` is outside the clamp band, write the
  // clamped value back so subsequent loads stay consistent. Runs at most
  // once per tile per session (the patched layout matches the clamp, so the
  // diff disappears on the next render).
  const healingRef = useRef<Set<string>>(new Set());

  const patchLayout = useMutation({
    mutationFn: async (args: { id: string; layout: TileLayout }) => {
      const res = await dashboardFetch(`/api/dashboard/tiles/${args.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: args.layout }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["dashboard-tiles"] });
      const prev = qc.getQueryData<{ tiles: TileRow[] }>(["dashboard-tiles"]);
      if (prev) {
        qc.setQueryData<{ tiles: TileRow[] }>(["dashboard-tiles"], {
          tiles: prev.tiles.map(t => t.id === args.id ? { ...t, layout: args.layout } : t),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard-tiles"], ctx.prev);
    },
  });

  // Run auto-heal once tiles + the patcher are ready. setTimeout 0 defers
  // the writes out of the render so we don't trigger a setState-in-effect
  // chain via the optimistic onMutate cache write. Heals both `h` (kind-
  // aware clamp) and `w` (KPIs default to 4 cols, others to 6).
  useEffect(() => {
    for (const t of tiles) {
      if (healingRef.current.has(t.id)) continue;
      const storedH = t.layout.h;
      const storedW = t.layout.w;
      const targetH = clampHFor(t.spec.kind, storedH);
      // Only rewrite width if it's still at an old chart default (6) but
      // the tile is a KPI — don't override a user's deliberate resize.
      const targetW = t.spec.kind === "kpi" && storedW === 6 ? 4 : storedW;
      if (storedH !== targetH || storedW !== targetW) {
        healingRef.current.add(t.id);
        setTimeout(() => {
          patchLayout.mutate({
            id: t.id,
            layout: { x: t.layout.x ?? 0, y: t.layout.y ?? 0, w: targetW, h: targetH },
          });
        }, 0);
      }
    }
    // patchLayout.mutate is a stable reference per useMutation instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  const removeTile = useMutation({
    mutationFn: async (id: string) => {
      const res = await dashboardFetch(`/api/dashboard/tiles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast.success("Unpinned");
      qc.invalidateQueries({ queryKey: ["dashboard-tiles"] });
    },
    onError: (e) => toast.error(`Remove failed: ${(e as Error).message}`),
  });

  function onLayoutChange(next: Layout[]) {
    const byId = new Map(layouts.map(l => [l.i, l]));
    for (const item of next) {
      const prev = byId.get(item.i);
      if (!prev) continue;
      if (prev.x !== item.x || prev.y !== item.y || prev.w !== item.w || prev.h !== item.h) {
        patchLayout.mutate({
          id: item.i,
          layout: { x: item.x, y: item.y, w: item.w, h: item.h },
        });
      }
    }
  }

  // The outer ref-bearing div is always rendered so the ResizeObserver has
  // something to measure regardless of which state we're in.
  return (
    <div ref={containerRef} className="w-full">
      {q.isLoading && (
        <div className="text-sm text-[#0A0A0A]/50">Loading dashboard…</div>
      )}
      {q.error && (
        <div className="text-sm text-red-600">Failed to load dashboard: {(q.error as Error).message}</div>
      )}
      {/* Empty state intentionally renders nothing — the AiSearchBar above
          is the visible CTA when no tiles exist. */}
      {!q.isLoading && !q.error && tiles.length > 0 && width > 0 && (
        <ReactGridLayout
          className="layout"
          layout={layouts}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={width}
          margin={MARGIN}
          draggableHandle=".tile-drag-handle"
          onLayoutChange={onLayoutChange}
          compactType="vertical"
          preventCollision={false}
          useCSSTransforms
        >
          {tiles.map(t => (
            <div key={t.id}>
              <DashboardTile tileId={t.id} spec={t.spec} onRemove={(id) => removeTile.mutate(id)} />
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}
