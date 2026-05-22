// Resolve the calling user_id for dashboard routes.
//
// This app uses a demo token of the shape `demo-token-<user_id>-<exp>`.
// The token is passed as a Bearer header by the apiClient on the client
// side. Server-side fetches (e.g. server components) forward cookies but
// the auth state lives in localStorage, so we accept the Bearer token here.
//
// We also accept a fallback X-User-Id header for local dev convenience.
// If neither is present, we fall back to the demo user — single-tenant
// behaviour matching how /api/chaincraft/* runs today.

import { DEMO_USER } from "@/lib/demo-user";

export function resolveUserId(req: Request): string {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    // demo-token-<user_id>-<exp>
    if (token.startsWith("demo-token-")) {
      const rest = token.slice("demo-token-".length);
      const lastDash = rest.lastIndexOf("-");
      if (lastDash > 0) return rest.slice(0, lastDash);
    }
  }
  const headerUser = req.headers.get("x-user-id");
  if (headerUser) return headerUser;
  return DEMO_USER.user_id;
}
