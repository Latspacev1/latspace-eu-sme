// Single source of truth for server-side session + tenancy resolution.
//
// Identity comes from CLERK (auth() / currentUser() from @clerk/nextjs/server).
// Org membership lives in Supabase and is read with the SERVICE-ROLE client
// (these tables have RLS enabled with no policies, so the service role is the
// only read/write path).
//
// org_id used to scope existing data tables (parameters/data_points/...) is
// `organizations.id` rendered as TEXT (uuid::text). getActiveMembership()
// returns both the text form (orgId) and the raw uuid (orgUuid) for callers
// that need either shape. They are currently the same string.

import { auth, currentUser } from "@clerk/nextjs/server";

import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface SessionUser {
  /** Clerk user id (text, e.g. "user_2abc..."). */
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export type MembershipRole = "owner" | "admin" | "member";

export interface Membership {
  /** organizations.id rendered as TEXT (uuid::text) — used to scope data tables. */
  orgId: string;
  /** organizations.id as a raw uuid string. */
  orgUuid: string;
  role: MembershipRole;
  orgName: string;
}

/**
 * Resolve the current authenticated user from the Clerk session.
 * Returns null when there is no valid session.
 *
 * Uses currentUser() to surface email/name/avatar. If only the id is needed,
 * callers can use resolveUserId() (which uses the lighter auth()).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) {
    // Authenticated but profile fetch failed — still return the id.
    return { id: userId, email: null, fullName: null, avatarUrl: null };
  }

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    null;

  return {
    id: user.id,
    email: primaryEmail,
    fullName,
    avatarUrl: user.imageUrl || null,
  };
}

/**
 * Resolve the active membership for the current user. Picks the most recent
 * membership, joining organizations for name + uuid. Uses the service-role
 * client (these tables are service-role-only). Returns null when
 * unauthenticated or when the user has no membership.
 */
export async function getActiveMembership(): Promise<Membership | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from("memberships")
    .select("org_id, role, organizations:org_id(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // organizations:org_id(...) may come back as an object or a one-element array
  // depending on the relationship inference; normalize to a single record.
  const orgRel = (data as { organizations?: unknown }).organizations;
  const org = (Array.isArray(orgRel) ? orgRel[0] : orgRel) as
    | { id: string; name: string | null }
    | undefined;

  const orgUuid = org?.id ?? (data.org_id as string);
  if (!orgUuid) return null;

  return {
    orgId: String(orgUuid),
    orgUuid: String(orgUuid),
    role: (data.role as MembershipRole) ?? "member",
    orgName: org?.name ?? "",
  };
}

/**
 * Like getSessionUser() but throws when unauthenticated. Intended for server
 * actions where a missing session is a programmer/flow error rather than an
 * expected 401 branch.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}
