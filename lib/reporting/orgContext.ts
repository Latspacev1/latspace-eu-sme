// Reads the active org's self-authored business context (the "Business
// context" field on the AI Context page, stored in
// organizations.onboarding_profile). Used by the reporting agent routes to
// ground the chat/write agents in company specifics.
//
// Fail-soft by design: any auth or DB problem returns null so the agent still
// runs (just ungrounded) rather than blocking the user with a 401/500.

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/dashboard/auth";
import {
  normalizeStoredProfile,
  type OnboardingProfile,
} from "@/lib/types/onboarding";

export async function getOrgBusinessContext(
  req: Request,
): Promise<string | null> {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return null;

    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("organizations")
      .select("name, onboarding_profile")
      .eq("id", orgId)
      .maybeSingle();
    if (error || !data) return null;

    const stored = data.onboarding_profile as OnboardingProfile | null;
    if (!stored) return null;

    const profile = normalizeStoredProfile(stored, data.name ?? "");
    const ctx = profile.businessContext.trim();
    return ctx.length > 0 ? ctx : null;
  } catch {
    return null;
  }
}
