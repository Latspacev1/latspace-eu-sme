// Small client-side helper that attaches the Bearer token + X-Org-Id to a
// fetch call so data-scoped routes can resolve the caller via resolveUserId /
// resolveOrgId. The tiles/metrics/extract routes scope all reads/writes, so
// these headers must be present for non-anonymous behaviour.

// Mirror of the server's resolveOrgId fallback: derive a stable per-user org
// from the demo token (`demo-token-<user_id>-<exp>`). Sending an explicit
// X-Org-Id keeps client and server in agreement and gives us one seam to swap
// for a real org claim later.
function orgIdFromToken(token: string | null): string | null {
  if (!token || !token.startsWith("demo-token-")) return null;
  const rest = token.slice("demo-token-".length);
  const lastDash = rest.lastIndexOf("-");
  if (lastDash <= 0) return null;
  return `org-${rest.slice(0, lastDash)}`;
}

export function dashboardFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  if (typeof window !== "undefined") {
    try {
      // Avoid a hard import dep — read directly from the persisted store.
      const raw = window.localStorage.getItem("ccts-app-store");
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
        token = parsed.state?.token ?? null;
      }
    } catch { /* ignore */ }
  }
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const orgId = orgIdFromToken(token);
  if (orgId && !headers["X-Org-Id"]) {
    headers["X-Org-Id"] = orgId;
  }
  return fetch(input, { ...init, headers });
}
