// GET  /api/dashboard/tiles            → list current user's tiles
// POST /api/dashboard/tiles            → pin a new chart from a ChartSpec
//
// The chat endpoint produces specs that pass ChartSpecSchema + validateSpec,
// but a client could call this directly, so we re-validate both.

import { NextResponse } from "next/server";

import { ChartSpecSchema } from "@/lib/dashboard/chart-spec";
import { validateSpec } from "@/lib/dashboard/validate-spec";
import { loadCatalogue } from "@/lib/dashboard/catalogue";
import { addTile, listTiles } from "@/lib/dashboard/tiles-repo";
import { resolveUserId } from "@/lib/dashboard/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = resolveUserId(req);
  try {
    const tiles = await listTiles(userId);
    return NextResponse.json({ tiles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = resolveUserId(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const specRaw = (body as { spec?: unknown }).spec;
  const parsed = ChartSpecSchema.safeParse(specRaw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid spec", issues: parsed.error.issues }, { status: 400 });
  }
  const cat = await loadCatalogue();
  const verdict = validateSpec(parsed.data, cat);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 400 });
  }
  try {
    const tile = await addTile(userId, parsed.data);
    return NextResponse.json({ tile }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
