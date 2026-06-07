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
import { runChecklist } from "@/lib/ai/checklist";
import {
  parseOnboardingProfile,
  emptyOnboardingProfile,
  normalizeStoredProfile,
  type OnboardingProfile,
} from "@/lib/types/onboarding";
import {
  normalizeStoredChecklist,
  normalizeChecklistSelection,
  allChecklistItems,
  type VsmeChecklist,
} from "@/lib/types/checklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The PATCH handler regenerates the VSME checklist via an LLM call, which needs
// more headroom than the default serverless timeout.
export const maxDuration = 60;

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

  // Normalize the stored blob so profiles written before a field existed (e.g.
  // businessContext) always come back with the full, current shape — the page
  // relies on every field being present (controlled inputs, .length reads).
  const stored = data?.onboarding_profile as OnboardingProfile | null;
  const profile = stored
    ? normalizeStoredProfile(stored, data?.name ?? "")
    : emptyOnboardingProfile(data?.name ?? "");

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

  const service = getSupabaseServiceClient();

  // Read the existing profile once: we use its stored checklist as a fallback if
  // regeneration fails, and its selections to carry the user's ticked items
  // forward across the save.
  const { data: existing } = await service
    .from("organizations")
    .select("onboarding_profile")
    .eq("id", orgId)
    .maybeSingle();
  const existingProfile =
    (existing?.onboarding_profile as Partial<OnboardingProfile> | null) ?? null;

  // Regenerate the VSME data checklist (best-effort). If the LLM call fails
  // (network/API key/etc.), keep whatever checklist was already stored so a
  // transient error never wipes a previously-generated list.
  let checklist: VsmeChecklist | undefined;
  try {
    checklist = await runChecklist({
      companyName: parsed.profile.companyName,
      businessContext: parsed.profile.businessContext,
      vsmeModules: parsed.profile.vsme?.modules,
    });
  } catch (err) {
    console.error("Checklist generation failed; preserving stored checklist", err);
    checklist = existingProfile?.checklist
      ? normalizeStoredChecklist(existingProfile.checklist)
      : undefined;
  }

  // Carry the user's selections forward, pruned to items that still exist in the
  // (possibly regenerated) checklist — surviving items stay ticked, removed ones
  // drop off.
  const checklistSelected = normalizeChecklistSelection(
    existingProfile?.checklistSelected,
    allChecklistItems(checklist),
  );

  const profile: OnboardingProfile = {
    ...parsed.profile,
    updatedAt: new Date().toISOString(),
    checklist,
    checklistSelected,
  };

  const { error } = await service
    .from("organizations")
    .update({ name: profile.companyName, onboarding_profile: profile })
    .eq("id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile });
}
