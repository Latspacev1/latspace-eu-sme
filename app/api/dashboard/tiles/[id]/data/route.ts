// GET /api/dashboard/tiles/:id/data
//
// Hydrate a pinned tile's spec with live data. Called by DashboardGrid per
// tile on mount so the grid shows current numbers (not a snapshot from when
// the chart was pinned).

import { NextResponse } from "next/server";

import { getTile } from "@/lib/dashboard/tiles-repo";
import { fetchChartData } from "@/lib/dashboard/fetch-chart-data";
import { resolveUserId, resolveOrgId } from "@/lib/dashboard/auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUserId(req);
  const orgId = await resolveOrgId(req);
  if (!userId || !orgId) return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const tile = await getTile(userId, id);
    if (!tile) return NextResponse.json({ error: "Tile not found" }, { status: 404 });
    const data = await fetchChartData(orgId, tile.spec);
    return NextResponse.json({ tile, data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
