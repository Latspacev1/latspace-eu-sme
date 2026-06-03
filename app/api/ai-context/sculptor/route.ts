// POST /api/ai-context/sculptor — generate a business-context narrative for the
// active org by researching its company name + website with an LLM (Sculptor).
//
// This does NOT persist anything: it returns the generated text so the user can
// review and edit it on the AI Context page before saving via PATCH
// /api/ai-context. Server-only: org scoping via resolveOrgId; the Anthropic key
// never reaches the client.

import { NextResponse } from "next/server";

import { resolveOrgId } from "@/lib/dashboard/auth";
import { runSculptor } from "@/lib/ai/sculptor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Web search + synthesis can take a while; give it room.
export const maxDuration = 120;

export async function POST(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { companyName?: unknown; websiteUrl?: unknown };
  try {
    body = (await req.json()) as { companyName?: unknown; websiteUrl?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const companyName =
    typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (!companyName) {
    return NextResponse.json(
      { error: "Company name is required to research the business." },
      { status: 400 },
    );
  }

  const websiteUrl =
    typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Sculptor is not configured (missing API key)." },
      { status: 503 },
    );
  }

  try {
    const result = await runSculptor({
      companyName,
      websiteUrl: websiteUrl || undefined,
    });
    return NextResponse.json({
      ok: true,
      businessContext: result.businessContext,
      sources: result.sources,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sculptor failed to generate context.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
