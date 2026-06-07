// PATCH /api/ai-context/checklist-selection — persist which checklist items the
// user has ticked off, as item titles. Kept separate from the main AI Context
// PATCH so toggling a checkbox is a cheap write that does NOT re-validate the
// whole profile or regenerate the checklist (no LLM call).
//
// Selections are stored on the org's onboarding_profile JSONB and pruned to
// titles that exist in the current checklist, so stale/removed items can't
// linger. Server-only: org scoping via resolveOrgId, service-role write.

import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import {
  normalizeStoredProfile,
  type OnboardingProfile,
} from "@/lib/types/onboarding";
import {
  normalizeChecklistSelection,
  allChecklistItems,
} from "@/lib/types/checklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { selected?: unknown };
  try {
    body = (await req.json()) as { selected?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.selected)) {
    return NextResponse.json(
      { error: "`selected` must be an array of item titles." },
      { status: 400 },
    );
  }

  const service = getSupabaseServiceClient();

  // Read the current profile so we (a) prune selections to existing checklist
  // titles and (b) write back without clobbering other profile fields.
  const { data, error: readErr } = await service
    .from("organizations")
    .select("name, onboarding_profile")
    .eq("id", orgId)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const profile: OnboardingProfile = normalizeStoredProfile(
    data?.onboarding_profile as Partial<OnboardingProfile> | null,
    data?.name ?? "",
  );

  const checklistSelected = normalizeChecklistSelection(
    body.selected,
    allChecklistItems(profile.checklist),
  );

  const next: OnboardingProfile = { ...profile, checklistSelected };

  const { error: writeErr } = await service
    .from("organizations")
    .update({ onboarding_profile: next })
    .eq("id", orgId);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checklistSelected });
}
