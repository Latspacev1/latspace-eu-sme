// PATCH  /api/dashboard/tiles/:id   → update layout { x, y, w, h }
// DELETE /api/dashboard/tiles/:id   → unpin

import { NextResponse } from "next/server";
import { z } from "zod";

import { updateTileLayout, deleteTile } from "@/lib/dashboard/tiles-repo";
import { resolveUserId } from "@/lib/dashboard/auth";

export const runtime = "nodejs";

const LayoutPatchSchema = z.object({
  layout: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(24),
    h: z.number().int().min(1).max(24),
  }),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = resolveUserId(req);
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = LayoutPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid layout", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    await updateTileLayout(userId, id, parsed.data.layout);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = resolveUserId(req);
  const { id } = await ctx.params;
  try {
    await deleteTile(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
