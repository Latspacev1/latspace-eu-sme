// Tenancy seam for dashboard / data-scoped routes.
//
// These resolve the calling user_id and org_id from the CLERK session
// (via @clerk/nextjs/server auth()). Org lookups delegate to
// lib/auth/session.ts, which is the single source of truth.
//
// NOTE: both functions are ASYNC. Call sites must `await` them. They take an
// optional `req` purely for signature compatibility with the previous
// header-based seam; resolution relies on the Clerk session, not on `req`.
//
// Contract: return `null` on no session / no membership. Routes translate a
// null into a 401. They never throw.

import { auth } from "@clerk/nextjs/server";

import { getActiveMembership } from "@/lib/auth/session";

/** The authenticated Clerk user id (text), or null when unauthenticated. */
export async function resolveUserId(_req?: Request): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * The active org_id as TEXT (organizations.id rendered as uuid::text) used to
 * scope data tables. Returns null when there is no session or no membership.
 */
export async function resolveOrgId(_req?: Request): Promise<string | null> {
  const membership = await getActiveMembership();
  return membership?.orgId ?? null;
}
