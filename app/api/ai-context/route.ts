// GET  /api/ai-context — read the active org's onboarding profile.
// PATCH /api/ai-context — update it (from the AI Context page).
//
// The profile is the OnboardingProfile JSONB on organizations (migration 0006).
// Server-only: service-role client, org scoping via resolveOrgId. The company
// name in the profile is kept authoritative for organizations.name so the two
// never drift.

import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import {
  parseOnboardingProfile,
  emptyOnboardingProfile,
  type OnboardingProfile,
} from "@/lib/types/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from("organizations")
    .select("name, onboarding_profile")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profile =
    (data?.onboarding_profile as OnboardingProfile | null) ??
    emptyOnboardingProfile(data?.name ?? "");

  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseOnboardingProfile(
    (body as { profile?: unknown })?.profile ?? body,
  );
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const profile: OnboardingProfile = {
    ...parsed.profile,
    updatedAt: new Date().toISOString(),
  };

  const service = getSupabaseServiceClient();
  const { error } = await service
    .from("organizations")
    .update({ name: profile.companyName, onboarding_profile: profile })
    .eq("id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile });
}
