// GET /api/metrics?period=FY2025
// Returns the calculated output metrics for the org + period, grouped by
// section, with trace and unit info — what the dashboard tiles consume.
// Replaces the single-tenant /api/chaincraft/metrics route.

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import type { CurrentMetricRow } from "@/lib/supabase/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodCode = searchParams.get("period") ?? undefined;
  const orgId = resolveOrgId(req);

  // Server-only route — use the service-role client to bypass RLS. Our app's
  // auth is a custom JWT (not Supabase Auth), so the cookie-based client would
  // see no rows. Org scoping is enforced here in code via resolveOrgId.
  const supabase = getSupabaseServiceClient();

  // Resolve period within the org. "current" is per-org now.
  const periodQuery =
    periodCode && periodCode !== "current"
      ? supabase.from("reporting_periods").select("id, code, label, status").eq("org_id", orgId).eq("code", periodCode).maybeSingle()
      : supabase.from("reporting_periods").select("id, code, label, status").eq("org_id", orgId).eq("is_current", true).maybeSingle();

  const { data: period, error: pErr } = await periodQuery;
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!period) return NextResponse.json({ period: null, metrics: {}, stale_count: 0 });

  // Pull from the view (org-scoped).
  const { data, error } = await supabase
    .from("v_current_metrics")
    .select("*")
    .eq("org_id", orgId)
    .eq("period_id", period.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by section
  const grouped: Record<string, CurrentMetricRow[]> = {};
  for (const row of (data ?? []) as CurrentMetricRow[]) {
    (grouped[row.section] ??= []).push(row);
  }

  // Sort each group by parameter display_order.
  const { data: params } = await supabase
    .from("parameters")
    .select("code, display_order")
    .eq("org_id", orgId)
    .eq("category", "output");
  const order = new Map<string, number>((params ?? []).map(p => [p.code, p.display_order]));
  for (const sec of Object.keys(grouped)) {
    grouped[sec].sort((a, b) => (order.get(a.parameter_code) ?? 0) - (order.get(b.parameter_code) ?? 0));
  }

  return NextResponse.json({
    period,
    metrics: grouped,
    stale_count: (data ?? []).filter(r => r.is_stale).length,
  });
}
