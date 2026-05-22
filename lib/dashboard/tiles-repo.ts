// Server-side data access for the dashboards/dashboard_tiles tables.
// All callers must pass a user_id; this module never falls back to "global".

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { ChartSpec } from "@/lib/dashboard/chart-spec";

export interface TileLayout { x: number; y: number; w: number; h: number }

export interface TileRow {
  id: string;
  dashboard_id: string;
  spec: ChartSpec;
  layout: TileLayout;
  created_at: string;
  updated_at: string;
}

// Defaults for a freshly-pinned tile. ROW_HEIGHT in DashboardGrid is 56px.
// KPI cards are short (~190px of content), so they get h: 3 and a narrower
// w: 4 to match the dashboard's 4-up KPI grid feel. Everything else gets the
// charty default of h: 6 ≈ 336px.
function defaultLayoutForKind(kind: ChartSpec["kind"]): Omit<TileLayout, "y"> {
  if (kind === "kpi") return { x: 0, w: 4, h: 3 };
  return { x: 0, w: 6, h: 6 };
}

// One dashboard per user (auto-created on first access). When we add
// multi-dashboard support, this becomes "default dashboard".
export async function getOrCreateDashboard(userId: string): Promise<{ id: string }> {
  const supabase = getSupabaseServiceClient();
  const { data: existing, error } = await supabase
    .from("dashboards")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing;

  const { data: created, error: cErr } = await supabase
    .from("dashboards")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);
  return created;
}

export async function listTiles(userId: string): Promise<TileRow[]> {
  const dash = await getOrCreateDashboard(userId);
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("dashboard_tiles")
    .select("*")
    .eq("dashboard_id", dash.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TileRow[];
}

export async function addTile(userId: string, spec: ChartSpec): Promise<TileRow> {
  const dash = await getOrCreateDashboard(userId);
  const supabase = getSupabaseServiceClient();

  // Stack new tiles at the bottom of the existing layout so they don't
  // collide with anything the user has arranged.
  const { data: existing } = await supabase
    .from("dashboard_tiles")
    .select("layout")
    .eq("dashboard_id", dash.id);
  const maxY = (existing ?? []).reduce((acc, row) => {
    const l = row.layout as TileLayout | null;
    if (!l) return acc;
    return Math.max(acc, (l.y ?? 0) + (l.h ?? 0));
  }, 0);

  const layout: TileLayout = { ...defaultLayoutForKind(spec.kind), y: maxY };

  const { data, error } = await supabase
    .from("dashboard_tiles")
    .insert({ dashboard_id: dash.id, spec, layout })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TileRow;
}

export async function updateTileLayout(userId: string, tileId: string, layout: TileLayout): Promise<void> {
  const dash = await getOrCreateDashboard(userId);
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("dashboard_tiles")
    .update({ layout })
    .eq("id", tileId)
    .eq("dashboard_id", dash.id);
  if (error) throw new Error(error.message);
}

export async function deleteTile(userId: string, tileId: string): Promise<void> {
  const dash = await getOrCreateDashboard(userId);
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("dashboard_tiles")
    .delete()
    .eq("id", tileId)
    .eq("dashboard_id", dash.id);
  if (error) throw new Error(error.message);
}

export async function getTile(userId: string, tileId: string): Promise<TileRow | null> {
  const dash = await getOrCreateDashboard(userId);
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("dashboard_tiles")
    .select("*")
    .eq("id", tileId)
    .eq("dashboard_id", dash.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as TileRow | null;
}
