// POST /api/onboarding
// Body: { name: string, profile?: OnboardingProfile }
// Creates a new organization and makes the current user its OWNER.
//
// Owner-creation sequence (service-role, RLS-safe per DB contract):
//   1) insert organizations { name, slug, created_by, onboarding_profile } .select('id').single()
//   2) insert memberships    { user_id: user.id, org_id: org.id, role: 'owner' }
//
// Idempotent: if the user already has a membership we do NOT create a second org.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getSessionUser, getActiveMembership } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  parseOnboardingProfile,
  type OnboardingProfile,
} from "@/lib/types/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding
// Returns the active organization's name for the current user, so the client
// can display the company name (rather than the user's own name). Returns
// orgName: null when the user has no membership yet.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const membership = await getActiveMembership();
  return NextResponse.json({ orgName: membership?.orgName ?? null });
}

/** lowercase, non-alphanumerics -> '-', collapse repeats, trim '-'. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Idempotent: user already belongs to an org — don't create another.
  const existing = await getActiveMembership();
  if (existing) {
    return NextResponse.json({ ok: true, orgId: existing.orgId });
  }

  let body: { name?: unknown; profile?: unknown } = {};
  try {
    body = (await req.json()) as { name?: unknown; profile?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Organization name is required." },
      { status: 400 },
    );
  }
  if (name.length > 120) {
    return NextResponse.json(
      { error: "Organization name must be 120 characters or fewer." },
      { status: 400 },
    );
  }

  // Validate the onboarding profile (optional — older clients may omit it).
  // When present, the company name in the profile is authoritative for the org
  // name so the two never drift.
  let profile: OnboardingProfile | null = null;
  if (body.profile !== undefined && body.profile !== null) {
    const parsed = parseOnboardingProfile(body.profile);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    profile = { ...parsed.profile, updatedAt: new Date().toISOString() };
  }

  const orgName = profile?.companyName ?? name;

  const service = getSupabaseServiceClient();

  // 1) Insert the organization. Slug is best-effort; on a unique violation
  // retry once with a short random suffix.
  let orgId: string | null = null;
  let slug = slugify(orgName) || randomUUID().slice(0, 6);

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await service
      .from("organizations")
      .insert({
        name: orgName,
        slug,
        created_by: user.id,
        onboarding_profile: profile,
      })
      .select("id")
      .single();

    if (!error && data) {
      orgId = data.id as string;
      break;
    }

    // Postgres unique_violation -> retry once with a suffix.
    const isUniqueViolation =
      (error as { code?: string } | null)?.code === "23505";
    if (isUniqueViolation && attempt === 0) {
      slug = `${slug}-${randomUUID().slice(0, 6)}`;
      continue;
    }

    return NextResponse.json(
      { error: error?.message ?? "Failed to create organization." },
      { status: 500 },
    );
  }

  if (!orgId) {
    return NextResponse.json(
      { error: "Failed to create organization." },
      { status: 500 },
    );
  }

  // 2) Insert the owner membership.
  const { error: membershipError } = await service.from("memberships").insert({
    user_id: user.id,
    org_id: orgId,
    role: "owner",
  });

  if (membershipError) {
    // Clean up the orphaned organization so the user can retry cleanly.
    await service.from("organizations").delete().eq("id", orgId);
    return NextResponse.json(
      {
        error:
          membershipError.message ??
          "Failed to assign ownership of the organization.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, orgId });
}
