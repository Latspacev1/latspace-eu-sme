// Small client-side helper that attaches the Bearer token to a fetch call
// so /api/dashboard/* routes can resolve the current user via resolveUserId.
// The tiles routes scope all reads/writes by user_id, so the token must
// always be present for non-anonymous behaviour.

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
  return fetch(input, { ...init, headers });
}
